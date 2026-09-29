import { and, asc, eq, inArray, lte, ne, sql } from 'drizzle-orm';
import type { BatchItem } from 'drizzle-orm/batch';
import { z } from 'zod';
import { database } from './client';
import { acharyaCatalog, acharyaStaging, acharyaSync, acharyaVideoCache } from './schema';
import {
  acharyaCatalogSnapshot,
  bundledAcharyaCandidates,
  bundledAcharyaLectures,
  selectAcharyaLecture,
  type AcharyaLecture,
  type AcharyaVideoCandidate,
} from '../domain/acharya-catalog';
import type { AcharyaLibraryResponse } from '../domain/acharya-sync';
import {
  fetchAcharyaPage,
  fetchAcharyaVideo,
  type AcharyaBrowseCursor,
} from '../server/acharya-source';

const id = 'the-acharya';
const cursorSchema = z.strictObject({
  token: z.string().max(16000),
  clientVersion: z.string().max(100),
});
const stateSchema = z.strictObject({
  runId: z.string(),
  status: z.enum(['idle', 'syncing', 'error']),
  lastSynced: z.string().nullable(),
  cursor: cursorSchema.nullable(),
  pending: z
    .array(z.object({ video: z.custom<AcharyaVideoCandidate>(), position: z.number().int() }))
    .max(100),
  scanned: z.number().int().nonnegative(),
  matched: z.number().int().nonnegative(),
  unverified: z.number().int().nonnegative(),
  pages: z.number().int().nonnegative(),
  error: z.string().max(500),
  notBefore: z.number().nonnegative(),
});
type SyncState = z.infer<typeof stateSchema>;
const initialState = (): SyncState => ({
  runId: '',
  status: 'idle',
  lastSynced: null,
  cursor: null,
  pending: [],
  scanned: 0,
  matched: 0,
  unverified: 0,
  pages: 0,
  error: '',
  notBefore: 0,
});
const seedPositions = new Map(
  bundledAcharyaLectures.map((lesson, index) => [lesson.id, index + 1]),
);
const seedCandidates = new Map(
  bundledAcharyaCandidates.map((candidate) => [candidate.id, candidate]),
);

async function syncRow() {
  const [row] = await database().select().from(acharyaSync).where(eq(acharyaSync.id, id));
  return row;
}
export async function getAcharyaLibrary(now = Date.now()): Promise<AcharyaLibraryResponse> {
  const db = database();
  const [row, catalog] = await Promise.all([
    syncRow(),
    db
      .select()
      .from(acharyaCatalog)
      .where(eq(acharyaCatalog.active, true))
      .orderBy(asc(acharyaCatalog.position), asc(acharyaCatalog.videoId)),
  ]);
  const state = row ? stateSchema.parse(JSON.parse(row.value)) : initialState();
  const source = state.lastSynced ? 'live' : 'bundled';
  const retryAfterSeconds = Math.max(
    0,
    Math.ceil((Math.max(row?.leaseUntil ?? 0, state.notBefore) - now) / 1000),
  );
  return {
    lessons:
      source === 'live'
        ? catalog.map((item) => JSON.parse(item.value) as AcharyaLecture)
        : [...bundledAcharyaLectures],
    source,
    lastSynced: state.lastSynced,
    status: state.status,
    canContinue: state.status === 'syncing' && retryAfterSeconds === 0,
    scanned: state.scanned,
    matched: state.matched,
    unverified: state.unverified,
    error: state.error,
    retryAfterSeconds,
  };
}

export async function syncAcharyaChunk(now = Date.now()): Promise<AcharyaLibraryResponse> {
  const db = database(),
    updatedAt = new Date(now).toISOString();
  await db
    .insert(acharyaSync)
    .values({
      id,
      value: JSON.stringify(initialState()),
      version: 0,
      leaseToken: '',
      leaseUntil: 0,
      updatedAt,
    })
    .onConflictDoNothing();
  const row = (await syncRow())!;
  const previous = stateSchema.parse(JSON.parse(row.value));
  if (row.leaseUntil > now || previous.notBefore > now) return getAcharyaLibrary(now);
  const state: SyncState =
    previous.status === 'idle'
      ? {
          ...initialState(),
          runId: crypto.randomUUID(),
          status: 'syncing',
          lastSynced: previous.lastSynced,
        }
      : { ...previous, status: 'syncing', error: '', notBefore: 0 };
  const lease = crypto.randomUUID(),
    version = row.version + 1;
  const claimed = await db
    .update(acharyaSync)
    .set({
      value: JSON.stringify(state),
      version,
      leaseToken: lease,
      leaseUntil: now + 90000,
      updatedAt,
    })
    .where(
      and(
        eq(acharyaSync.id, id),
        eq(acharyaSync.version, row.version),
        lte(acharyaSync.leaseUntil, now),
      ),
    )
    .returning({ version: acharyaSync.version });
  if (!claimed.length) return getAcharyaLibrary(now);
  const guard = sql`EXISTS(SELECT 1 FROM acharya_sync WHERE id=${id} AND version=${version} AND lease_token=${lease})`;
  try {
    if (!state.pending.length) {
      if (state.pages >= 100)
        throw new Error(
          'The channel is larger than this sync can safely scan. Your previous library is unchanged.',
        );
      const page = await fetchAcharyaPage(state.cursor as AcharyaBrowseCursor | null);
      const offset = state.scanned;
      state.scanned += page.videos.length;
      state.pages++;
      state.cursor = page.next;
      // YouTube's listing badge and player duration can differ by a second.
      state.pending = page.videos
        .map((video, index) => ({ video, position: offset + index + 1 }))
        .filter(
          ({ video }) =>
            video.durationSeconds != null &&
            video.durationSeconds >= 1798 &&
            video.durationSeconds <= 2702,
        );
    }
    const ids = state.pending.map(({ video }) => video.id);
    const cached = ids.length
      ? await db.select().from(acharyaVideoCache).where(inArray(acharyaVideoCache.videoId, ids))
      : [];
    const existingStage = ids.length
      ? await db
          .select()
          .from(acharyaStaging)
          .where(and(eq(acharyaStaging.runId, state.runId), inArray(acharyaStaging.videoId, ids)))
      : [];
    const cacheMap = new Map(cached.map((entry) => [entry.videoId, entry]));
    const priorVerdict = new Map(existingStage.map((entry) => [entry.videoId, entry.verdict]));
    let requests = 0;
    const work: {
        video: AcharyaVideoCandidate;
        position: number;
        cached: AcharyaVideoCandidate | null;
      }[] = [],
      remaining: typeof state.pending = [];
    for (const item of state.pending) {
      const cache = cacheMap.get(item.video.id);
      const cachedMetadata = cache ? (JSON.parse(cache.value) as AcharyaVideoCandidate) : null;
      const fresh =
        cache &&
        cachedMetadata &&
        (cachedMetadata.audioLanguage ||
          cachedMetadata.autoCaptionLanguage ||
          selectAcharyaLecture(cachedMetadata)) &&
        cachedMetadata.durationSeconds != null &&
        (cachedMetadata.playabilityStatus === undefined ||
          cachedMetadata.playabilityStatus === 'OK') &&
        now - Date.parse(cache.checkedAt) < 24 * 60 * 60 * 1000 &&
        cache.listedTitle === item.video.title &&
        Math.abs((cache.listedDuration ?? 0) - (item.video.durationSeconds ?? 0)) <= 2;
      const seed = seedCandidates.get(item.video.id);
      const verifiedSeed =
        seed &&
        (seed.audioLanguage || seed.autoCaptionLanguage) &&
        now - Date.parse(acharyaCatalogSnapshot.checkedAt) < 24 * 60 * 60 * 1000 &&
        seed.title === item.video.title &&
        Math.abs((seed.durationSeconds ?? 0) - (item.video.durationSeconds ?? 0)) <= 2;
      if (fresh) work.push({ ...item, cached: cachedMetadata });
      else if (verifiedSeed) work.push({ ...item, cached: seed });
      else if (requests < 4) {
        requests++;
        work.push({ ...item, cached: null });
      } else remaining.push(item);
    }
    const resolved = await Promise.all(
      work.map(async (item) => ({
        ...item,
        metadata: item.cached ?? (await fetchAcharyaVideo(item.video)),
      })),
    );
    const statements: BatchItem<'sqlite'>[] = [
      db.delete(acharyaStaging).where(and(ne(acharyaStaging.runId, state.runId), guard)),
    ];
    for (const item of resolved) {
      const lesson = selectAcharyaLecture(item.metadata);
      const evidence =
        item.metadata.audioLanguage ||
        item.metadata.autoCaptionLanguage ||
        (/\benglish\b/i.test(item.metadata.title) ? 'en' : '');
      const verdict = lesson
        ? ('eligible' as const)
        : !evidence ||
            item.metadata.durationSeconds == null ||
            (item.metadata.playabilityStatus !== undefined &&
              item.metadata.playabilityStatus !== 'OK')
          ? ('unknown' as const)
          : ('excluded' as const);
      const old = priorVerdict.get(item.video.id);
      if (old !== verdict) {
        if (old === 'eligible') state.matched--;
        if (old === 'unknown') state.unverified--;
        if (verdict === 'eligible') state.matched++;
        if (verdict === 'unknown') state.unverified++;
      }
      priorVerdict.set(item.video.id, verdict);
      const serialized = lesson ? JSON.stringify(lesson) : null;
      // INSERT ... SELECT guards every staged/cache write with the same lease.
      // A timed-out request cannot publish after another request takes its place.
      statements.push(
        db
          .insert(acharyaStaging)
          .select(
            sql`SELECT ${state.runId + ':' + item.video.id},${state.runId},${item.video.id},${verdict},${serialized},${item.position},${seedPositions.get(item.video.id) ?? null} WHERE ${guard}`,
          )
          .onConflictDoUpdate({
            target: [acharyaStaging.runId, acharyaStaging.videoId],
            set: { verdict, value: serialized },
          }),
      );
      if (!item.cached)
        statements.push(
          db
            .insert(acharyaVideoCache)
            .select(
              sql`SELECT ${item.video.id},${item.video.title},${item.video.durationSeconds},${JSON.stringify(item.metadata)},${updatedAt} WHERE ${guard}`,
            )
            .onConflictDoUpdate({
              target: acharyaVideoCache.videoId,
              set: {
                listedTitle: item.video.title,
                listedDuration: item.video.durationSeconds,
                value: JSON.stringify(item.metadata),
                checkedAt: updatedAt,
              },
            }),
        );
    }
    state.pending = remaining;
    if (!state.pending.length && !state.cursor) {
      if (!state.scanned)
        throw new Error('No uploads were scanned. The saved library is unchanged.');
      if (!state.matched && state.unverified && bundledAcharyaLectures.length)
        throw new Error(
          'English lecture metadata could not be verified. Your saved library is unchanged; try again later.',
        );
      const [maximum] = await db
        .select({
          position: sql<number>`COALESCE(MAX(${acharyaCatalog.position}),0)`.mapWith(Number),
        })
        .from(acharyaCatalog);
      const nextBase = Math.max(maximum?.position ?? 0, bundledAcharyaLectures.length);
      statements.push(db.update(acharyaCatalog).set({ active: false }).where(guard));
      statements.push(
        db
          .insert(acharyaCatalog)
          .select(
            sql`SELECT s.video_id,s.value,
        COALESCE((SELECT position FROM acharya_catalog c WHERE c.video_id=s.video_id),s.seed_position,${nextBase}+s.source_position),1,${updatedAt}
        FROM acharya_staging s WHERE s.run_id=${state.runId} AND s.verdict='eligible' AND ${guard}`,
          )
          .onConflictDoUpdate({
            target: acharyaCatalog.videoId,
            set: { value: sql`excluded.value`, active: true, updatedAt },
          }),
      );
      statements.push(
        db.delete(acharyaStaging).where(and(eq(acharyaStaging.runId, state.runId), guard)),
      );
      state.status = 'idle';
      state.lastSynced = updatedAt;
      state.error = '';
      state.notBefore = now + 60000;
    }
    const finish = db
      .update(acharyaSync)
      .set({
        value: JSON.stringify(state),
        version: version + 1,
        leaseToken: '',
        leaseUntil: 0,
        updatedAt,
      })
      .where(
        and(
          eq(acharyaSync.id, id),
          eq(acharyaSync.version, version),
          eq(acharyaSync.leaseToken, lease),
        ),
      )
      .returning({ version: acharyaSync.version });
    await db.batch([statements[0], ...statements.slice(1), finish]);
    return getAcharyaLibrary(now);
  } catch (cause) {
    const failed: SyncState = {
      ...previous,
      ...(previous.status === 'idle'
        ? {
            runId: state.runId,
            cursor: null,
            pending: [],
            pages: 0,
            scanned: 0,
            matched: 0,
            unverified: 0,
          }
        : {}),
      status: 'error',
      notBefore: now + 15000,
      error: (cause instanceof Error && !cause.message.startsWith('Failed query:')
        ? cause.message
        : 'The lecture sync could not finish. Try again later.'
      ).slice(0, 500),
    };
    await db
      .update(acharyaSync)
      .set({
        value: JSON.stringify(failed),
        version: version + 1,
        leaseToken: '',
        leaseUntil: 0,
        updatedAt,
      })
      .where(
        and(
          eq(acharyaSync.id, id),
          eq(acharyaSync.version, version),
          eq(acharyaSync.leaseToken, lease),
        ),
      );
    return getAcharyaLibrary(now);
  }
}
