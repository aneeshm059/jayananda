import { ACHARYA_CHANNEL_ID, type AcharyaVideoCandidate } from '../domain/acharya-catalog';

type ObjectValue = Record<string, unknown>;
const object = (value: unknown): ObjectValue =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as ObjectValue) : {};
const array = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
const text = (value: unknown): string => (typeof value === 'string' ? value : '');
const path = (value: unknown, ...keys: string[]): unknown =>
  keys.reduce<unknown>((current, key) => object(current)[key], value);
const videoId = /^[A-Za-z0-9_-]{11}$/;
export type AcharyaBrowseCursor = { token: string; clientVersion: string };
export type AcharyaSourcePage = {
  videos: AcharyaVideoCandidate[];
  next: AcharyaBrowseCursor | null;
};

export function embeddedJson(
  html: string,
  variable: 'ytInitialData' | 'ytInitialPlayerResponse',
): unknown {
  const marker = new RegExp(`(?:var\\s+)?${variable}\\s*=\\s*\\{`).exec(html);
  if (!marker)
    throw new Error('YouTube did not return its public metadata. Try syncing again later.');
  const start = marker.index + marker[0].lastIndexOf('{');
  let depth = 0,
    quoted = false,
    escaped = false;
  for (let index = start; index < html.length; index++) {
    const character = html[index];
    if (quoted) {
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === '"') quoted = false;
    } else if (character === '"') quoted = true;
    else if (character === '{') depth++;
    else if (character === '}' && --depth === 0) return JSON.parse(html.slice(start, index + 1));
  }
  throw new Error('YouTube returned incomplete metadata. Your saved library is unchanged.');
}
function rendererText(value: unknown): string {
  const item = object(value);
  return (
    text(item.simpleText) ||
    text(item.content) ||
    array(item.runs)
      .map((run) => text(object(run).text))
      .join('')
  );
}
function duration(value: string): number | null {
  if (!/^\d{1,3}:\d{2}(?::\d{2})?$/.test(value)) return null;
  const parts = value.split(':').map(Number);
  if (parts.slice(1).some((part) => part >= 60)) return null;
  return parts.reduce((sum, part) => sum * 60 + part, 0);
}
export function parseAcharyaItems(items: unknown[], clientVersion: string): AcharyaSourcePage {
  if (items.length > 100) throw new Error('YouTube returned an unexpected page size.');
  const videos: AcharyaVideoCandidate[] = [];
  let token = '';
  for (const raw of items) {
    const continuation = path(
      raw,
      'continuationItemRenderer',
      'continuationEndpoint',
      'continuationCommand',
      'token',
    );
    if (typeof continuation === 'string') {
      token = continuation;
      continue;
    }
    const content = object(path(raw, 'richItemRenderer', 'content'));
    const modern = object(content.lockupViewModel),
      legacy = object(content.videoRenderer ?? object(raw).videoRenderer);
    let id = '',
      title = '',
      seconds: number | null = null;
    if (modern.contentType === 'LOCKUP_CONTENT_TYPE_VIDEO') {
      id = text(modern.contentId);
      title = rendererText(path(modern, 'metadata', 'lockupMetadataViewModel', 'title'));
      const overlays = array(path(modern, 'contentImage', 'thumbnailViewModel', 'overlays'));
      for (const overlay of overlays)
        for (const badge of array(path(overlay, 'thumbnailBottomOverlayViewModel', 'badges'))) {
          const parsed = duration(text(path(badge, 'thumbnailBadgeViewModel', 'text')));
          if (parsed != null) seconds = parsed;
        }
    } else if (legacy.videoId) {
      id = text(legacy.videoId);
      title = rendererText(legacy.title);
      seconds = duration(rendererText(legacy.lengthText));
    } else if (Object.keys(content).length)
      throw new Error('YouTube changed its upload format. The saved library is unchanged.');
    if (!id) continue;
    if (!videoId.test(id) || !title || title.length > 1000)
      throw new Error('YouTube returned invalid video metadata.');
    videos.push({ id, title, durationSeconds: seconds, channelId: ACHARYA_CHANNEL_ID });
  }
  if (!videos.length)
    throw new Error('YouTube returned an empty upload page. The saved library is unchanged.');
  if (token.length > 16000 || clientVersion.length > 100)
    throw new Error('YouTube returned an invalid continuation.');
  return { videos, next: token ? { token, clientVersion } : null };
}
export function parseAcharyaInitial(html: string): AcharyaSourcePage {
  const data = embeddedJson(html, 'ytInitialData');
  if (path(data, 'metadata', 'channelMetadataRenderer', 'externalId') !== ACHARYA_CHANNEL_ID)
    throw new Error('The returned channel did not match The Acharya.');
  const selected = array(path(data, 'contents', 'twoColumnBrowseResultsRenderer', 'tabs'))
    .map((tab) => object(object(tab).tabRenderer))
    .find((tab) => tab.selected === true);
  const items = path(selected, 'content', 'richGridRenderer', 'contents');
  const clientVersion = /"INNERTUBE_CLIENT_VERSION":"([^"\\]{1,100})"/.exec(html)?.[1];
  if (!Array.isArray(items) || !clientVersion)
    throw new Error('YouTube did not return a usable uploads page.');
  return parseAcharyaItems(items, clientVersion);
}
export function parseAcharyaContinuation(
  data: unknown,
  cursor: AcharyaBrowseCursor,
): AcharyaSourcePage {
  const actions = array(path(data, 'onResponseReceivedActions'));
  const itemLists = actions
    .map((action) => path(action, 'appendContinuationItemsAction', 'continuationItems'))
    .filter(Array.isArray);
  if (itemLists.length !== 1)
    throw new Error('YouTube did not return the next upload page. Try resuming the sync.');
  const page = parseAcharyaItems(itemLists[0] as unknown[], cursor.clientVersion);
  if (page.next?.token === cursor.token)
    throw new Error('YouTube repeated a page. The saved library is unchanged.');
  return page;
}

export function primaryAsrLanguage(player: unknown): string | undefined {
  const captions = object(path(player, 'captions', 'playerCaptionsTracklistRenderer'));
  const tracks = array(captions.captionTracks),
    audio = array(captions.audioTracks);
  let indices: number[] | undefined;
  if (audio.length) {
    const index =
      typeof captions.defaultAudioTrackIndex === 'number'
        ? captions.defaultAudioTrackIndex
        : audio.length === 1
          ? 0
          : -1;
    const selected = object(audio[index]);
    if (index < 0 || !audio[index]) return;
    indices = array(selected.captionTrackIndices).filter((value): value is number =>
      Number.isInteger(value),
    );
  }
  const original = tracks.filter(
    (track, index) => (!indices || indices.includes(index)) && object(track).kind === 'asr',
  );
  if (original.length !== 1) return;
  const language = text(object(original[0]).languageCode);
  return /^[a-z]{2,3}(?:-[A-Za-z0-9]+)*$/.test(language) ? language : undefined;
}
export function parseAcharyaWatch(
  html: string,
  expected: AcharyaVideoCandidate,
): AcharyaVideoCandidate {
  const player = embeddedJson(html, 'ytInitialPlayerResponse');
  const details = object(path(player, 'videoDetails'));
  const micro = object(path(player, 'microformat', 'playerMicroformatRenderer'));
  const playability = object(path(player, 'playabilityStatus'));
  if (/bot|unusual traffic|automated/i.test(text(playability.reason)))
    throw new Error(
      'YouTube temporarily blocked metadata requests. Your library is safe; try again later.',
    );
  if (!details.videoId && playability.status !== 'OK')
    return { ...expected, durationSeconds: null };
  if (details.videoId !== expected.id || details.channelId !== ACHARYA_CHANNEL_ID)
    throw new Error('A video did not match the requested channel.');
  const seconds = Number(details.lengthSeconds);
  const publishDate = text(micro.publishDate);
  const audioLanguage = text(details.defaultAudioLanguage) || text(micro.defaultAudioLanguage);
  return {
    id: expected.id,
    channelId: ACHARYA_CHANNEL_ID,
    title: text(details.title) || expected.title,
    playabilityStatus: text(playability.status),
    embeddable: playability.playableInEmbed !== false,
    isShort: micro.isShortsEligible === true,
    durationSeconds:
      Number.isFinite(seconds) && seconds > 0 && micro.isShortsEligible !== true ? seconds : null,
    ...(audioLanguage ? { audioLanguage } : {}),
    ...(primaryAsrLanguage(player) ? { autoCaptionLanguage: primaryAsrLanguage(player) } : {}),
    ...(publishDate && Number.isFinite(Date.parse(publishDate))
      ? { publishedAt: new Date(publishDate).toISOString() }
      : {}),
  };
}

async function sourceText(url: string, init?: RequestInit): Promise<string> {
  const response = await fetch(url, {
    ...init,
    redirect: 'manual',
    signal: AbortSignal.timeout(15000),
    headers: { 'Accept-Language': 'en-US,en;q=0.9', ...init?.headers },
  });
  if (!response.ok)
    throw new Error(`YouTube metadata is unavailable (HTTP ${response.status}). Try again later.`);
  const reader = response.body?.getReader();
  if (!reader) throw new Error('YouTube returned no metadata.');
  let bytes = 0;
  const chunks: Uint8Array[] = [];
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > 4 * 1024 * 1024) {
      await reader.cancel();
      throw new Error('YouTube returned an unexpectedly large page.');
    }
    chunks.push(value);
  }
  const joined = new Uint8Array(bytes);
  let offset = 0;
  for (const chunk of chunks) {
    joined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(joined);
}
export async function fetchAcharyaPage(
  cursor: AcharyaBrowseCursor | null,
): Promise<AcharyaSourcePage> {
  if (!cursor)
    return parseAcharyaInitial(
      await sourceText(`https://www.youtube.com/channel/${ACHARYA_CHANNEL_ID}/videos?hl=en`),
    );
  const data = JSON.parse(
    await sourceText('https://www.youtube.com/youtubei/v1/browse?prettyPrint=false', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        context: {
          client: { clientName: 'WEB', clientVersion: cursor.clientVersion, hl: 'en', gl: 'US' },
        },
        continuation: cursor.token,
      }),
    }),
  );
  return parseAcharyaContinuation(data, cursor);
}
export async function fetchAcharyaVideo(
  candidate: AcharyaVideoCandidate,
): Promise<AcharyaVideoCandidate> {
  if (candidate.channelId !== ACHARYA_CHANNEL_ID || !videoId.test(candidate.id))
    throw new Error('Invalid source video.');
  return parseAcharyaWatch(
    await sourceText(`https://www.youtube.com/watch?v=${candidate.id}&hl=en`),
    candidate,
  );
}
