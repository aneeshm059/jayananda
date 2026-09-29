import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type Script = {
  id: string;
  src: string;
  async: boolean;
  onload: (() => void) | null;
  onerror: (() => void) | null;
  removed: boolean;
  remove(): void;
};

describe('YouTube API loading and recovery', () => {
  let scripts: Script[];
  let browser: {
    setTimeout: typeof setTimeout;
    clearTimeout: typeof clearTimeout;
    YT: Window['YT'];
    onYouTubeIframeAPIReady: Window['onYouTubeIframeAPIReady'];
  };
  const api = { Player: class {} } as unknown as NonNullable<Window['YT']>;

  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
    scripts = [];
    browser = { setTimeout, clearTimeout, YT: undefined, onYouTubeIframeAPIReady: undefined };
    vi.stubGlobal('window', browser);
    vi.stubGlobal('document', {
      getElementById: (id: string) => scripts.find((script) => !script.removed && script.id === id),
      createElement: () => ({
        id: '',
        src: '',
        async: false,
        onload: null,
        onerror: null,
        removed: false,
        remove(this: Script) {
          this.removed = true;
        },
      }),
      head: { appendChild: (script: Script) => scripts.push(script) },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('shares one loading script between course players and reuses a ready API', async () => {
    const { loadYouTube } = await import('../lib/youtube-player');
    const first = loadYouTube();
    expect(loadYouTube()).toBe(first);
    expect(scripts).toHaveLength(1);
    browser.YT = api;
    browser.onYouTubeIframeAPIReady!();
    await expect(first).resolves.toBe(api);
    await expect(loadYouTube()).resolves.toBe(api);
    expect(scripts).toHaveLength(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('does not start another network request when the API was prepared before mounting', async () => {
    browser.YT = api;
    const { loadYouTube } = await import('../lib/youtube-player');
    await expect(loadYouTube()).resolves.toBe(api);
    expect(scripts).toHaveLength(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('waits for Player to exist rather than treating the first script load as readiness', async () => {
    const { loadYouTube } = await import('../lib/youtube-player');
    const ready = vi.fn();
    const loading = loadYouTube();
    void loading.then(ready);
    scripts[0].onload!();
    await Promise.resolve();
    expect(ready).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(1);
    browser.YT = api;
    browser.onYouTubeIframeAPIReady!();
    await expect(loading).resolves.toBe(api);
    expect(ready).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('uses the script-load fallback without replacing a newer widget callback', async () => {
    const { loadYouTube } = await import('../lib/youtube-player');
    const loading = loadYouTube();
    const newerCallback = vi.fn();
    browser.onYouTubeIframeAPIReady = newerCallback;
    browser.YT = api;
    scripts[0].onload!();
    await expect(loading).resolves.toBe(api);
    expect(browser.onYouTubeIframeAPIReady).toBe(newerCallback);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('allows a clean retry after a blocked or failed script request', async () => {
    const { loadYouTube } = await import('../lib/youtube-player');
    const first = loadYouTube();
    const rejection = expect(first).rejects.toThrow('could not load');
    const oldFailure = scripts[0].onerror!;
    oldFailure();
    await rejection;
    expect(scripts[0].removed).toBe(true);
    const retry = loadYouTube();
    expect(scripts).toHaveLength(2);
    // A late error from the abandoned request must not reject the new request.
    oldFailure();
    browser.YT = api;
    browser.onYouTubeIframeAPIReady!();
    await expect(retry).resolves.toBe(api);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('times out a script that never becomes ready and removes its callback before retry', async () => {
    const { loadYouTube } = await import('../lib/youtube-player');
    const first = loadYouTube();
    const rejection = expect(first).rejects.toThrow('could not load');
    const abandonedReady = browser.onYouTubeIframeAPIReady!;
    vi.advanceTimersByTime(20000);
    await rejection;
    expect(browser.onYouTubeIframeAPIReady).toBeUndefined();
    const retry = loadYouTube();
    browser.YT = api;
    abandonedReady();
    expect(browser.onYouTubeIframeAPIReady).not.toBeUndefined();
    browser.onYouTubeIframeAPIReady!();
    await expect(retry).resolves.toBe(api);
  });

  it('allows recovery when a ready callback arrives without a usable Player constructor', async () => {
    const { loadYouTube } = await import('../lib/youtube-player');
    const first = loadYouTube();
    const rejection = expect(first).rejects.toThrow('could not load');
    browser.onYouTubeIframeAPIReady!();
    await rejection;
    expect(scripts[0].removed).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
    const retry = loadYouTube();
    browser.YT = api;
    browser.onYouTubeIframeAPIReady!();
    await expect(retry).resolves.toBe(api);
  });

  it('still becomes ready if an unrelated widget callback throws', async () => {
    const previous = vi.fn(() => {
      throw new Error('Unrelated widget');
    });
    browser.onYouTubeIframeAPIReady = previous;
    const { loadYouTube } = await import('../lib/youtube-player');
    const loading = loadYouTube();
    browser.YT = api;
    expect(() => browser.onYouTubeIframeAPIReady!()).not.toThrow();
    await expect(loading).resolves.toBe(api);
    expect(previous).toHaveBeenCalledOnce();
    expect(browser.onYouTubeIframeAPIReady).toBe(previous);
  });

  it('explains owner restrictions and missing client identity accurately', async () => {
    const { youtubePlaybackError } = await import('../lib/youtube-player');
    expect(youtubePlaybackError(101)).toContain('owner does not allow');
    expect(youtubePlaybackError(150)).toContain('owner does not allow');
    expect(youtubePlaybackError(153)).toContain('website identity');
    expect(youtubePlaybackError(5)).toContain('saved place is kept');
  });
});
