import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

const source = readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8');
function worker() {
  const listeners = new Map<string, (event: Record<string, unknown>) => void>();
  const offline = new Response('Public offline message');
  const cache = {
    add: vi.fn().mockResolvedValue(undefined),
    match: vi.fn().mockResolvedValue(offline),
  };
  const caches = {
    open: vi.fn().mockResolvedValue(cache),
    keys: vi.fn().mockResolvedValue(['jayananda-pwa-v0', 'jayananda-pwa-v1', 'another-app']),
    delete: vi.fn().mockResolvedValue(true),
  };
  const fetch = vi.fn().mockResolvedValue(new Response('Private journal'));
  const claim = vi.fn().mockResolvedValue(undefined);
  runInNewContext(source, {
    URL,
    Response,
    caches,
    fetch,
    self: {
      location: { origin: 'https://journal.example' },
      clients: { claim },
      addEventListener: (name: string, handler: (event: Record<string, unknown>) => void) =>
        listeners.set(name, handler),
    },
  });
  return { listeners, offline, cache, caches, fetch, claim };
}
function navigation(url = 'https://journal.example/habits') {
  return { url, method: 'GET', mode: 'navigate' };
}

describe('PWA privacy and offline behavior', () => {
  it('pre-caches only the public offline message', async () => {
    const w = worker();
    let pending: Promise<unknown> | undefined;
    w.listeners.get('install')!({
      waitUntil: (p: Promise<unknown>) => {
        pending = p;
      },
    });
    await pending;
    expect(w.cache.add.mock.calls).toEqual([['/offline']]);
  });
  it('cleans up only older caches belonging to this PWA', async () => {
    const w = worker();
    let pending: Promise<unknown> | undefined;
    w.listeners.get('activate')!({
      waitUntil: (p: Promise<unknown>) => {
        pending = p;
      },
    });
    await pending;
    expect(w.caches.delete.mock.calls).toEqual([['jayananda-pwa-v0']]);
    expect(w.claim).toHaveBeenCalledOnce();
  });
  it.each([
    { ...navigation('https://journal.example/api/export'), mode: 'navigate' },
    {
      ...navigation('https://journal.example/api/habits/a/checkin'),
      method: 'PATCH',
      mode: 'cors',
    },
    { ...navigation('https://journal.example/api/auth/sign-in/email'), method: 'POST' },
    { ...navigation('https://journal.example/habits?_rsc=1'), mode: 'cors' },
    navigation('https://another.example/'),
  ])('does not intercept API, mutation, data or cross-origin requests: $url', (request) => {
    const w = worker(),
      respondWith = vi.fn();
    w.listeners.get('fetch')!({ request, respondWith });
    expect(respondWith).not.toHaveBeenCalled();
    expect(w.fetch).not.toHaveBeenCalled();
    expect(w.caches.open).not.toHaveBeenCalled();
  });
  it.each([200, 401, 503])(
    'returns the actual network response (%s) without caching personal pages',
    async (status) => {
      const w = worker(),
        response = new Response('Private response', { status });
      w.fetch.mockResolvedValue(response);
      let pending: Promise<Response> | undefined;
      w.listeners.get('fetch')!({
        request: navigation(),
        respondWith: (p: Promise<Response>) => {
          pending = p;
        },
      });
      expect(await pending).toBe(response);
      expect(w.caches.open).not.toHaveBeenCalled();
    },
  );
  it('returns the public offline page only on a failed navigation', async () => {
    const w = worker();
    w.fetch.mockRejectedValue(new TypeError('Network unavailable'));
    let pending: Promise<Response> | undefined;
    w.listeners.get('fetch')!({
      request: navigation(),
      respondWith: (p: Promise<Response>) => {
        pending = p;
      },
    });
    expect(await pending).toBe(w.offline);
    expect(w.cache.match).toHaveBeenCalledWith('/offline');
  });
});
