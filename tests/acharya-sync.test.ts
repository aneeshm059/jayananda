import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import { drizzle } from 'drizzle-orm/sqlite-proxy';
import {
  ACHARYA_CHANNEL_ID,
  acharyaCatalogSnapshot,
  bundledAcharyaCandidates,
  bundledAcharyaLectures,
  selectAcharyaLecture,
  type AcharyaVideoCandidate,
} from '../lib/domain/acharya-catalog';

const { getDatabase, pageMock, videoMock } = vi.hoisted(() => ({
  getDatabase: vi.fn(),
  pageMock: vi.fn(),
  videoMock: vi.fn(),
}));
vi.mock('../lib/db/client', () => ({ database: getDatabase }));
vi.mock('../lib/server/acharya-source', async (original) => ({
  ...(await original<typeof import('../lib/server/acharya-source')>()),
  fetchAcharyaPage: pageMock,
  fetchAcharyaVideo: videoMock,
}));
import {
  embeddedJson,
  parseAcharyaInitial,
  parseAcharyaContinuation,
  parseAcharyaWatch,
  primaryAsrLanguage,
} from '../lib/server/acharya-source';
import { getAcharyaLibrary, syncAcharyaChunk } from '../lib/db/acharya';

const candidate = (id = 'abcdefghijk', language?: string): AcharyaVideoCandidate => ({
  id,
  title: `A lecture ${id}`,
  channelId: ACHARYA_CHANNEL_ID,
  durationSeconds: 2100,
  ...(language ? { autoCaptionLanguage: language } : {}),
});
const modern = (video: AcharyaVideoCandidate) => ({
  richItemRenderer: {
    content: {
      lockupViewModel: {
        contentId: video.id,
        contentType: 'LOCKUP_CONTENT_TYPE_VIDEO',
        metadata: { lockupMetadataViewModel: { title: { content: video.title } } },
        contentImage: {
          thumbnailViewModel: {
            overlays: [
              {
                thumbnailBottomOverlayViewModel: {
                  badges: [{ thumbnailBadgeViewModel: { text: '35:00' } }],
                },
              },
            ],
          },
        },
      },
    },
  },
});
const captionPlayer = (language: string) => ({
  captions: {
    playerCaptionsTracklistRenderer: {
      captionTracks: [{ kind: 'asr', languageCode: language }],
      audioTracks: [{ captionTrackIndices: [0] }],
    },
  },
});

describe('public YouTube metadata boundaries', () => {
  it('parses balanced embedded JSON even when a title contains the old regex delimiter', () => {
    expect(
      embeddedJson(
        'var ytInitialData = {"title":"}; and \\"quotes\\"","nested":{"a":1}}; next()',
        'ytInitialData',
      ),
    ).toEqual({ title: '}; and "quotes"', nested: { a: 1 } });
  });
  it('accepts only the selected upload tab of the exact channel', () => {
    const data = {
      metadata: { channelMetadataRenderer: { externalId: ACHARYA_CHANNEL_ID } },
      contents: {
        twoColumnBrowseResultsRenderer: {
          tabs: [
            {
              tabRenderer: {
                selected: true,
                content: {
                  richGridRenderer: {
                    contents: [
                      modern(candidate()),
                      {
                        continuationItemRenderer: {
                          continuationEndpoint: { continuationCommand: { token: 'next-page' } },
                        },
                      },
                    ],
                  },
                },
              },
            },
          ],
        },
      },
    };
    const html = `var ytInitialData = ${JSON.stringify(data)}; "INNERTUBE_CLIENT_VERSION":"2.20260925.08.00"`;
    const page = parseAcharyaInitial(html);
    expect(page.videos).toEqual([candidate()]);
    expect(page.next?.token).toBe('next-page');
    expect(() =>
      parseAcharyaInitial(html.replace(ACHARYA_CHANNEL_ID, 'another-channel')),
    ).toThrow();
  });
  it('rejects missing or repeated continuations rather than treating them as a completed catalog', () => {
    const cursor = { token: 'same-page', clientVersion: '2.0' };
    expect(() => parseAcharyaContinuation({}, cursor)).toThrow();
    expect(() =>
      parseAcharyaContinuation(
        {
          onResponseReceivedActions: [
            {
              appendContinuationItemsAction: {
                continuationItems: [
                  modern(candidate()),
                  {
                    continuationItemRenderer: {
                      continuationEndpoint: { continuationCommand: { token: 'same-page' } },
                    },
                  },
                ],
              },
            },
          ],
        },
        cursor,
      ),
    ).toThrow();
  });
  it('uses original primary ASR, never translations or manually uploaded English subtitles', () => {
    expect(primaryAsrLanguage(captionPlayer('hi'))).toBe('hi');
    expect(
      primaryAsrLanguage({
        captions: {
          playerCaptionsTracklistRenderer: {
            captionTracks: [{ languageCode: 'en' }],
            translationLanguages: [{ languageCode: 'en' }],
          },
        },
      }),
    ).toBeUndefined();
    const multi = {
      captions: {
        playerCaptionsTracklistRenderer: {
          captionTracks: [
            { kind: 'asr', languageCode: 'hi' },
            { kind: 'asr', languageCode: 'en' },
          ],
          audioTracks: [{ captionTrackIndices: [0] }, { captionTrackIndices: [1] }],
          defaultAudioTrackIndex: 0,
        },
      },
    };
    expect(primaryAsrLanguage(multi)).toBe('hi');
    delete (multi.captions.playerCaptionsTracklistRenderer as { defaultAudioTrackIndex?: number })
      .defaultAudioTrackIndex;
    expect(primaryAsrLanguage(multi)).toBeUndefined();
  });
  it('preserves actual playability and embedding restrictions', () => {
    const video = candidate();
    const player = {
      ...captionPlayer('en'),
      videoDetails: {
        videoId: video.id,
        channelId: ACHARYA_CHANNEL_ID,
        title: video.title,
        lengthSeconds: '2100',
      },
      playabilityStatus: { status: 'OK', playableInEmbed: false },
      microformat: { playerMicroformatRenderer: { isShortsEligible: false } },
    };
    const parsed = parseAcharyaWatch(
      `var ytInitialPlayerResponse = ${JSON.stringify(player)};`,
      video,
    );
    expect(parsed.embeddable).toBe(false);
    expect(selectAcharyaLecture(parsed)).toBe(null);
    expect(() =>
      parseAcharyaWatch(
        `var ytInitialPlayerResponse = ${JSON.stringify({ ...player, playabilityStatus: { status: 'LOGIN_REQUIRED', reason: 'Sign in to confirm you are not a bot' } })};`,
        video,
      ),
    ).toThrow(/blocked/);
  });
});

describe('resumable staged Acharya sync', () => {
  let sqlite: DatabaseSync;
  let failPublish: boolean;
  const now = Date.parse(acharyaCatalogSnapshot.checkedAt) + 1000;
  beforeEach(() => {
    failPublish = false;
    pageMock.mockReset();
    videoMock.mockReset();
    videoMock.mockImplementation(async (video: AcharyaVideoCandidate) => ({
      ...video,
      autoCaptionLanguage: 'en',
      playabilityStatus: 'OK',
      embeddable: true,
    }));
    sqlite = new DatabaseSync(':memory:');
    sqlite.exec('PRAGMA foreign_keys = ON');
    for (const file of readdirSync('migrations')
      .filter((name) => name.endsWith('.sql'))
      .sort())
      sqlite.exec(readFileSync(`migrations/${file}`, 'utf8'));
    const execute = (query: string, params: unknown[], method: string) => {
      if (failPublish && query.startsWith('insert into "acharya_catalog"'))
        throw new Error('Simulated publish failure');
      const statement = sqlite.prepare(query);
      if (method === 'run') {
        statement.run(...(params as (string | number | null)[]));
        return { rows: [] };
      }
      return {
        rows: statement
          .all(...(params as (string | number | null)[]))
          .map((row) => Object.values(row)),
      };
    };
    getDatabase.mockReturnValue(
      drizzle(
        async (query, params, method) => execute(query, params, method),
        async (batch) => {
          sqlite.exec('BEGIN');
          try {
            const results = batch.map(({ sql, params, method }) => execute(sql, params, method));
            sqlite.exec('COMMIT');
            return results;
          } catch (error) {
            sqlite.exec('ROLLBACK');
            throw error;
          }
        },
      ),
    );
  });
  afterEach(() => sqlite.close());

  it('keeps the published catalog intact until all bounded chunks complete', async () => {
    const videos = Array.from({ length: 8 }, (_, i) => candidate(String(i).padStart(11, '0')));
    pageMock.mockResolvedValue({ videos, next: null });
    const first = await syncAcharyaChunk(now);
    expect(first).toMatchObject({
      status: 'syncing',
      source: 'bundled',
      scanned: 8,
      matched: 4,
      canContinue: true,
      lastSynced: null,
    });
    expect(first.lessons).toEqual(bundledAcharyaLectures);
    expect(videoMock).toHaveBeenCalledTimes(4);
    const done = await syncAcharyaChunk(now + 1000);
    expect(done.status).toBe('idle');
    expect(done.source).toBe('live');
    expect(done.lessons.map((l) => l.id)).toEqual(videos.map((v) => v.id));
    expect(pageMock).toHaveBeenCalledTimes(1);
    expect(videoMock).toHaveBeenCalledTimes(8);
  });
  it('resumes the next channel page without publishing a partial catalog', async () => {
    pageMock
      .mockResolvedValueOnce({
        videos: [candidate()],
        next: { token: 'next', clientVersion: '2.0' },
      })
      .mockResolvedValueOnce({ videos: [candidate('lmnopqrstuv')], next: null });
    expect((await syncAcharyaChunk(now)).status).toBe('syncing');
    const done = await syncAcharyaChunk(now + 1000);
    expect(pageMock.mock.calls[1][0]).toEqual({ token: 'next', clientVersion: '2.0' });
    expect(done.lessons).toHaveLength(2);
  });
  it('preserves old order and appends new IDs even when source order changes', async () => {
    const a = candidate(),
      b = candidate('lmnopqrstuv'),
      c = candidate('zyxwvutsrqp');
    pageMock
      .mockResolvedValueOnce({ videos: [a, b], next: null })
      .mockResolvedValueOnce({ videos: [c, b, a], next: null });
    await syncAcharyaChunk(now);
    const result = await syncAcharyaChunk(now + 61000);
    expect(result.lessons.map((item) => item.id)).toEqual([a.id, b.id, c.id]);
    expect(videoMock).toHaveBeenCalledTimes(3);
  });
  it('retains the prior catalog and reports an error when source fetching fails', async () => {
    pageMock
      .mockResolvedValueOnce({ videos: [candidate()], next: null })
      .mockRejectedValueOnce(new Error('YouTube temporarily unavailable'));
    const original = await syncAcharyaChunk(now);
    const failed = await syncAcharyaChunk(now + 61000);
    expect(failed.status).toBe('error');
    expect(failed.lastSynced).toBe(original.lastSynced);
    expect(failed.lessons).toEqual(original.lessons);
    expect(failed.canContinue).toBe(false);
    await syncAcharyaChunk(now + 62000);
    expect(pageMock).toHaveBeenCalledTimes(2);
  });
  it('rolls back catalog retirement and insertion together when publishing fails', async () => {
    pageMock
      .mockResolvedValueOnce({ videos: [candidate()], next: null })
      .mockResolvedValueOnce({ videos: [candidate('lmnopqrstuv')], next: null });
    const original = await syncAcharyaChunk(now);
    failPublish = true;
    const failed = await syncAcharyaChunk(now + 61000);
    expect(failed.status).toBe('error');
    expect(failed.lessons).toEqual(original.lessons);
    expect(failed.lastSynced).toBe(original.lastSynced);
  });
  it('allows only one active network sync lease', async () => {
    let release: (value: unknown) => void = () => {};
    pageMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    );
    const first = syncAcharyaChunk(now);
    await vi.waitFor(() => expect(pageMock).toHaveBeenCalledTimes(1));
    const second = await syncAcharyaChunk(now + 1);
    expect(second).toMatchObject({ status: 'syncing', canContinue: false });
    expect(second.retryAfterSeconds).toBeGreaterThan(0);
    expect(pageMock).toHaveBeenCalledTimes(1);
    release({ videos: [candidate()], next: null });
    await first;
  });
  it('does not let an expired request overwrite a newer completed sync', async () => {
    let release: (value: unknown) => void = () => {};
    pageMock
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            release = resolve;
          }),
      )
      .mockResolvedValueOnce({ videos: [candidate('lmnopqrstuv')], next: null });
    const first = syncAcharyaChunk(now);
    await vi.waitFor(() => expect(pageMock).toHaveBeenCalledTimes(1));
    const replacement = await syncAcharyaChunk(now + 100000);
    release({ videos: [candidate()], next: null });
    await first;
    const result = await getAcharyaLibrary(now + 100000);
    expect(result.lessons).toEqual(replacement.lessons);
    expect(result.lessons[0].id).toBe('lmnopqrstuv');
  });
  it('reuses verified bundled metadata and retries unknown language on a later sync', async () => {
    const seed = bundledAcharyaCandidates.find((video) => selectAcharyaLecture(video))!;
    const unknown = candidate('lmnopqrstuv');
    pageMock.mockResolvedValue({
      videos: [{ ...seed, autoCaptionLanguage: undefined, audioLanguage: undefined }, unknown],
      next: null,
    });
    videoMock.mockImplementation(async (video: AcharyaVideoCandidate) => video);
    const first = await syncAcharyaChunk(now);
    expect(first.unverified).toBe(1);
    expect(videoMock).toHaveBeenCalledTimes(1);
    videoMock.mockImplementation(async (video: AcharyaVideoCandidate) => ({
      ...video,
      autoCaptionLanguage: 'en',
    }));
    const second = await syncAcharyaChunk(now + 61000);
    expect(second.unverified).toBe(0);
    expect(second.lessons).toHaveLength(2);
    expect(videoMock).toHaveBeenCalledTimes(2);
  });
});
