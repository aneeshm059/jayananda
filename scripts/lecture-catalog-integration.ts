import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import {
  ACHARYA_MIN_DURATION_SECONDS,
  ACHARYA_MAX_DURATION_SECONDS,
} from '../lib/domain/acharya-catalog';
import type { AcharyaLibraryResponse } from '../lib/domain/acharya-sync';
import type { CompanionItem, CourseProgress } from '../lib/domain/companion';

const base = new URL(process.env.TEST_BASE_URL || 'http://localhost:3000');
if (Number(process.versions.node.split('.')[0]) < 22)
  throw new Error('Use Node.js 22 or newer for the local D1 test harness.');
if (
  !['localhost', '127.0.0.1', '[::1]'].includes(base.hostname) ||
  !['http:', 'https:'].includes(base.protocol) ||
  base.username ||
  base.password
)
  throw new Error('Lecture catalog integration tests are local-only.');

// Run while no other local lecture sync is underway. This takes one bounded
// public-source chunk, then restores just its shared catalog tables and fixture progress.
const tables = [
  'acharya_sync',
  'acharya_video_cache',
  'acharya_staging',
  'acharya_catalog',
] as const;
type SqlRow = Record<string, string | number | null>;
type CatalogState = Record<(typeof tables)[number], SqlRow[]>;
let passed = 0;
function check(value: unknown, message: string) {
  assert.ok(value, message);
  passed++;
  console.log('✓ ' + message);
}
function localSql(sql: string): { results: SqlRow[] }[] {
  const directory = mkdtempSync(join(tmpdir(), 'jayananda-lecture-check-'));
  try {
    const file = join(directory, 'query.sql');
    writeFileSync(file, sql, { mode: 0o600 });
    const result = execFileSync(
      process.execPath,
      [
        'node_modules/wrangler/bin/wrangler.js',
        'd1',
        'execute',
        'DB',
        '--local',
        '--file',
        file,
        '--json',
      ],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
    );
    return JSON.parse(result) as { results: SqlRow[] }[];
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}
function sqlValue(value: string | number | null): string {
  return value === null
    ? 'NULL'
    : typeof value === 'number'
      ? String(value)
      : "'" + value.replaceAll("'", "''") + "'";
}
function catalogState(): CatalogState {
  const results = localSql(tables.map((table) => `SELECT * FROM ${table};`).join('\n'));
  return Object.fromEntries(
    tables.map((table, index) => [
      table,
      (results[index]?.results ?? []).sort((a, b) =>
        JSON.stringify(a).localeCompare(JSON.stringify(b)),
      ),
    ]),
  ) as CatalogState;
}
function restoreCatalog(original: CatalogState, expected: CatalogState) {
  assert.ok(
    isDeepStrictEqual(catalogState(), expected),
    'Shared sync state changed outside this test; refusing to overwrite it',
  );
  const statements: string[] = [];
  for (const table of [...tables].reverse()) statements.push(`DELETE FROM ${table};`);
  for (const table of tables)
    for (const row of original[table]) {
      const columns = Object.keys(row);
      statements.push(
        `INSERT INTO ${table} (${columns.map((column) => '"' + column.replaceAll('"', '""') + '"').join(',')}) VALUES (${columns.map((column) => sqlValue(row[column])).join(',')});`,
      );
    }
  localSql(statements.join('\n'));
  check(
    isDeepStrictEqual(catalogState(), original),
    'Original shared catalog and sync state restored',
  );
}
async function raw(
  path: string,
  method = 'GET',
  value?: unknown,
  cookie = '',
  origin = base.origin,
) {
  return fetch(new URL(path, base), {
    method,
    redirect: 'error',
    headers: { cookie, origin, 'Content-Type': 'application/json' },
    body: value === undefined ? undefined : JSON.stringify(value),
  });
}
async function json<T>(path: string, cookie: string, method = 'GET', value?: unknown): Promise<T> {
  const response = await raw(path, method, value, cookie);
  assert.equal(response.status, 200, `${method} ${path} returned ${response.status}`);
  return response.json() as Promise<T>;
}
function validateLibrary(value: AcharyaLibraryResponse) {
  check(
    Array.isArray(value.lessons) && value.lessons.length > 0,
    'Catalog response contains a usable lecture library',
  );
  check(
    value.lessons.every(
      (lesson) =>
        /^[A-Za-z0-9_-]{11}$/.test(lesson.id) &&
        typeof lesson.title === 'string' &&
        lesson.title.trim() &&
        Number.isFinite(lesson.durationSeconds) &&
        lesson.durationSeconds >= ACHARYA_MIN_DURATION_SECONDS &&
        lesson.durationSeconds <= ACHARYA_MAX_DURATION_SECONDS &&
        lesson.language === 'en' &&
        ['title', 'audio-language', 'asr-captions'].includes(lesson.languageEvidence),
    ),
    'Every exposed lecture has an English evidence tag and a 30–45 minute duration',
  );
  check(
    new Set(value.lessons.map((lesson) => lesson.id)).size === value.lessons.length,
    'Catalog video IDs are unique',
  );
  check(
    ['live', 'bundled'].includes(value.source) &&
      ['idle', 'syncing', 'error'].includes(value.status) &&
      (value.lastSynced === null || Number.isFinite(Date.parse(value.lastSynced))) &&
      typeof value.canContinue === 'boolean' &&
      typeof value.error === 'string' &&
      [value.scanned, value.matched, value.unverified, value.retryAfterSeconds].every(
        (count) => Number.isInteger(count) && count >= 0,
      ),
    'Catalog status and continuation metadata have the documented shape',
  );
  const allowed = [
    'lessons',
    'source',
    'lastSynced',
    'status',
    'canContinue',
    'scanned',
    'matched',
    'unverified',
    'error',
    'retryAfterSeconds',
  ];
  check(
    Object.keys(value).every((key) => allowed.includes(key)),
    'Response does not expose internal sync tokens or ownership fields',
  );
}

const endpoint = '/api/lectures/acharya';
let cookie = '',
  userId = '';
let originalCatalog: CatalogState | undefined, afterSync: CatalogState | undefined;
let originalProgress: CompanionItem | undefined, writtenProgress: CompanionItem | undefined;
let failure: unknown;
try {
  check((await raw(endpoint)).status === 401, 'Anonymous catalog GET returns 401');
  check(
    (await raw(endpoint, 'POST', { action: 'sync' })).status === 401,
    'Anonymous sync returns 401',
  );
  const signIn = await raw('/api/auth/sign-in/email', 'POST', {
    email: 'other@example.test',
    password: 'Local-Journal-Only-2026!',
  });
  assert.equal(signIn.status, 200, 'Sign in with the second seeded local fixture');
  const account = (await signIn.json()) as { user: { id: string } };
  userId = account.user.id;
  cookie = signIn.headers
    .getSetCookie()
    .map((value) => value.split(';')[0])
    .join('; ');
  assert.ok(cookie && userId);

  originalCatalog = catalogState();
  const before = await json<AcharyaLibraryResponse>(endpoint, cookie);
  validateLibrary(before);
  const repeated = await json<AcharyaLibraryResponse>(endpoint, cookie);
  check(isDeepStrictEqual(repeated, before), 'Repeated GET returns the same saved catalog');
  check(
    isDeepStrictEqual(catalogState(), originalCatalog),
    'Authenticated GET performs no catalog or sync-state writes',
  );
  check(
    (await raw(endpoint, 'POST', { action: 'sync' }, cookie, 'https://untrusted.example'))
      .status === 403,
    'Cross-origin sync returns 403',
  );
  for (const value of [
    {},
    { action: 'invalid' },
    { action: 'sync', sourceUrl: 'https://untrusted.example' },
    [],
  ])
    check(
      (await raw(endpoint, 'POST', value, cookie)).status === 400,
      'Malformed sync bodies return 400',
    );
  const malformed = await fetch(new URL(endpoint, base), {
    method: 'POST',
    headers: { cookie, origin: base.origin, 'Content-Type': 'application/json' },
    body: '{',
    redirect: 'error',
  });
  check(malformed.status === 400, 'Invalid JSON returns 400');
  check(
    isDeepStrictEqual(catalogState(), originalCatalog),
    'Rejected requests leave the shared catalog unchanged',
  );

  const companionBefore = await json<{ items: CompanionItem[] }>('/api/companion', cookie);
  originalProgress = companionBefore.items.find((item) => item.key === 'course:prabhupada');
  const previous = originalProgress?.value as CourseProgress | undefined;
  const lesson = before.lessons[0];
  const marked: CourseProgress = {
    currentVideoId: lesson.id,
    lessons: {
      ...previous?.lessons,
      [lesson.id]: { position: 127, duration: lesson.durationSeconds, completed: true },
    },
    watchedByDay: previous?.watchedByDay ?? {},
    reminderTime: previous?.reminderTime ?? '',
    lastPracticedDate: previous?.lastPracticedDate ?? '',
  };
  writtenProgress = await json<CompanionItem>('/api/companion', cookie, 'PUT', {
    key: 'course:prabhupada',
    value: marked,
    version: originalProgress?.version ?? 0,
  });
  const checkpoint = await json<{ items: CompanionItem[] }>('/api/companion', cookie);

  console.log('Checking one public-source sync chunk against the local Worker…');
  const syncedResponse = await raw(endpoint, 'POST', { action: 'sync' }, cookie);
  afterSync = catalogState();
  assert.equal(
    syncedResponse.status,
    200,
    'One authorized sync chunk completes with a safe response',
  );
  const synced = (await syncedResponse.json()) as AcharyaLibraryResponse;
  validateLibrary(synced);
  if (synced.status !== 'idle')
    check(
      isDeepStrictEqual(synced.lessons, before.lessons),
      'Partial or unavailable-source sync keeps the last published library',
    );
  check(
    isDeepStrictEqual(await json<{ items: CompanionItem[] }>('/api/companion', cookie), checkpoint),
    'Sync preserves completed lessons, resume positions and every other personal companion item',
  );
  if (synced.status === 'error')
    console.log(
      `Source returned a recoverable error: ${synced.error} The existing library remained available.`,
    );
} catch (cause) {
  failure = cause;
} finally {
  if (originalCatalog && afterSync) {
    try {
      restoreCatalog(originalCatalog, afterSync);
    } catch (cause) {
      failure = failure
        ? new AggregateError([failure, cause], 'Test or catalog restoration failed')
        : cause;
    }
  }
  if (writtenProgress) {
    try {
      const current = (await json<{ items: CompanionItem[] }>('/api/companion', cookie)).items.find(
        (item) => item.key === 'course:prabhupada',
      );
      assert.ok(
        isDeepStrictEqual(current, writtenProgress),
        'Fixture progress changed outside this test; refusing to overwrite it',
      );
      if (originalProgress)
        await json('/api/companion', cookie, 'PUT', {
          key: 'course:prabhupada',
          value: originalProgress.value,
          version: writtenProgress.version,
        });
      else
        localSql(
          `DELETE FROM companion_entries WHERE user_id=${sqlValue(userId)} AND key='course:prabhupada' AND version=${writtenProgress.version} AND value=${sqlValue(JSON.stringify(writtenProgress.value))};`,
        );
      const restored = (
        await json<{ items: CompanionItem[] }>('/api/companion', cookie)
      ).items.find((item) => item.key === 'course:prabhupada');
      check(
        originalProgress
          ? isDeepStrictEqual(restored?.value, originalProgress.value)
          : restored === undefined,
        'Original fixture listening progress restored',
      );
    } catch (cause) {
      failure = failure
        ? new AggregateError([failure, cause], 'Test or progress restoration failed')
        : cause;
    }
  }
  if (cookie) await raw('/api/auth/sign-out', 'POST', {}, cookie).catch(() => {});
}
if (failure) throw failure;
console.log(
  `\n${passed} lecture catalog integration assertions passed against local Workers + D1.`,
);
