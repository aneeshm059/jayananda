export type YouTubePlayer = {
  getCurrentTime(): number;
  getDuration(): number;
  getPlayerState(): number;
  getPlaybackRate(): number;
  playVideo(): void;
  pauseVideo(): void;
  cueVideoById(options: { videoId: string; startSeconds: number }): void;
  seekTo(seconds: number, allow: boolean): void;
  destroy(): void;
};
type PlayerEvent = { target: YouTubePlayer; data: number };
type YouTubeAPI = {
  Player: new (
    element: HTMLElement,
    options: {
      videoId: string;
      width: string;
      height: string;
      host?: string;
      playerVars: Record<string, string | number>;
      events: {
        onReady(e: { target: YouTubePlayer }): void;
        onStateChange(e: PlayerEvent): void;
        onError(e: PlayerEvent): void;
        onAutoplayBlocked?(): void;
      };
    },
  ) => YouTubePlayer;
};
declare global {
  interface Window {
    YT?: YouTubeAPI;
    onYouTubeIframeAPIReady?: () => void;
  }
}
let pending: Promise<YouTubeAPI> | undefined;
export function loadYouTube(): Promise<YouTubeAPI> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (pending) return pending;
  pending = new Promise<YouTubeAPI>((resolve, reject) => {
    let settled = false;
    const previous = window.onYouTubeIframeAPIReady;
    const script = document.createElement('script');
    const cleanup = () => {
      window.clearTimeout(timeout);
      script.onerror = null;
      script.onload = null;
      if (window.onYouTubeIframeAPIReady === ready) window.onYouTubeIframeAPIReady = previous;
    };
    const fail = () => {
      if (settled) return;
      settled = true;
      cleanup();
      script.remove();
      pending = undefined;
      reject(
        new Error('YouTube could not load. Check your connection or open the original lesson.'),
      );
    };
    const timeout = window.setTimeout(fail, 20000);
    const ready = () => {
      if (settled) return;
      if (!window.YT?.Player) {
        fail();
        return;
      }
      settled = true;
      cleanup();
      pending = undefined;
      resolve(window.YT);
      // A callback installed by another widget must not leave our promise pending.
      try {
        previous?.();
      } catch {
        // This player's API is ready even if an unrelated widget fails.
      }
    };
    window.onYouTubeIframeAPIReady = ready;
    document.getElementById('youtube-player-api')?.remove();
    script.id = 'youtube-player-api';
    script.src = 'https://www.youtube.com/iframe_api';
    script.async = true;
    script.onerror = fail;
    script.onload = () => {
      if (window.YT?.Player) ready();
    };
    document.head.appendChild(script);
  });
  return pending;
}

export function youtubePlaybackError(code: number): string {
  const reasons: Record<number, string> = {
    2: 'YouTube could not recognize this video request.',
    5: 'YouTube could not start playback in this browser.',
    100: 'This video is unavailable or private on YouTube.',
    101: 'The video owner does not allow playback outside YouTube.',
    150: 'The video owner does not allow playback outside YouTube.',
    153: 'YouTube could not verify this player’s website identity.',
  };
  return `${reasons[code] || 'YouTube could not play this lesson.'} (YouTube ${code}) Your saved place is kept.`;
}
