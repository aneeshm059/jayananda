import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { buildSoulfulImport } from './import-soulful-japa';
import {
  soulfulDatasetSchema,
  type SoulfulLibraryResponse,
  type SoulfulModuleResponse,
  type SoulfulProgress,
  type SoulfulProgressResponse,
} from '../lib/domain/soulful-reading';

const base = new URL(process.env.TEST_BASE_URL || 'http://localhost:3000');
if (
  !['localhost', '127.0.0.1', '[::1]'].includes(base.hostname) ||
  !['http:', 'https:'].includes(base.protocol) ||
  base.username ||
  base.password
)
  throw new Error('Written Soulful Japa integration checks are local-only.');
if (Number(process.versions.node.split('.')[0]) < 22) throw new Error('Use Node.js 22 or newer.');
const dataset = soulfulDatasetSchema.parse(
  JSON.parse(readFileSync('data/soulful-japa-modules.json', 'utf8')),
);
const expectedVersion = buildSoulfulImport(dataset).contentVersion;
const numbered = dataset.modules.filter((module) => module.kind === 'module');
assert.ok(numbered.length >= 2);
const targets = numbered
  .filter((module) => module.number === 105 || module.number === 106)
  .map((module) => module.id);
assert.equal(targets.length, 2, 'Expected isolated local fixture modules 105 and 106');
const endpoint = '/api/soulful-japa';
type SqlRow = Record<string, string | number | null>;
let passed = 0;
function check(value: unknown, message: string) {
  assert.ok(value, message);
  passed++;
  console.log(`✓ ${message}`);
}
const sqlValue = (value: string | number | null) =>
  value === null
    ? 'NULL'
    : typeof value === 'number'
      ? String(value)
      : `CAST(X'${Buffer.from(value, 'utf8').toString('hex')}' AS TEXT)`;
function localSql(sql: string): { results: SqlRow[] }[] {
  const directory = mkdtempSync(join(tmpdir(), 'jayananda-soulful-check-'));
  try {
    const file = join(directory, 'query.sql');
    writeFileSync(file, sql, { mode: 0o600 });
    return JSON.parse(
      execFileSync(
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
      ),
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}
async function raw(
  path: string,
  method = 'GET',
  input?: unknown,
  cookie = '',
  origin = base.origin,
) {
  const response = await fetch(new URL(path, base), {
    method,
    redirect: 'error',
    headers: { cookie, origin, 'content-type': 'application/json' },
    body: input === undefined ? undefined : JSON.stringify(input),
  });
  // Consume even intentionally rejected responses before reusing connections.
  // Otherwise a long validation sequence can retain unread proxy streams.
  return new Response(await response.arrayBuffer(), {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
}
async function json<T>(path: string, cookie: string, method = 'GET', input?: unknown): Promise<T> {
  const response = await raw(path, method, input, cookie);
  assert.equal(
    response.status,
    200,
    `${method} ${path} returned ${response.status}: ${response.status === 200 ? '' : await response.text()}`,
  );
  return response.json() as Promise<T>;
}
async function signIn(email: string) {
  const response = await raw('/api/auth/sign-in/email', 'POST', {
    email,
    password: 'Local-Journal-Only-2026!',
  });
  assert.equal(response.status, 200, 'Local fixture sign-in');
  const value = (await response.json()) as { user: { id: string } };
  return {
    userId: value.user.id,
    cookie: response.headers
      .getSetCookie()
      .map((part) => part.split(';')[0])
      .join('; '),
  };
}
const ownedRequestIds = new Set<string>();
const action = (version: number, values: object) => {
  const requestId = crypto.randomUUID();
  ownedRequestIds.add(requestId);
  return { version, requestId, contentVersion: expectedVersion, ...values };
};
let fixture: { userId: string; cookie: string } | undefined;
let other: { userId: string; cookie: string } | undefined;
let original: SqlRow[] | undefined;
let failure: unknown;
const fixtureRows = () =>
  localSql(
    `SELECT * FROM soulful_reading_progress WHERE user_id=${sqlValue(fixture!.userId)} AND module_id IN(${targets.map(sqlValue).join(',')}) ORDER BY module_id;`,
  )[0].results;

try {
  check((await raw(endpoint)).status === 401, 'Anonymous index is protected');
  check(
    (await raw(`${endpoint}/${targets[0]}`)).status === 401,
    'Anonymous module content is protected',
  );
  check(
    (await raw(`${endpoint}/${targets[0]}`, 'PUT', action(0, { opened: true }))).status === 401,
    'Anonymous progress is protected',
  );
  fixture = await signIn('other@example.test');
  other = await signIn('demo@example.test');
  original = fixtureRows();
  const before = await json<SoulfulLibraryResponse>(endpoint, fixture.cookie);
  const otherBefore = await json<SoulfulLibraryResponse>(endpoint, other.cookie);
  check(
    before.source?.contentVersion === expectedVersion,
    'Active local D1 source matches the complete extracted dataset',
  );
  check(
    before.source?.sha256 === dataset.source.sha256 &&
      before.source.pageCount === dataset.source.pageCount,
    'Source PDF hash and all 583 pages are identified',
  );
  check(
    /^[a-f0-9]{64}$/.test(before.readerKey) && before.readerKey !== otherBefore.readerKey,
    'Pending request recovery keys are private to each account',
  );
  const metadata = dataset.modules.map(
    ({ id, kind, number, label, title, startPage, endPage, blocks }) => ({
      id,
      kind,
      number,
      label,
      title,
      startPage,
      endPage,
      blockCount: blocks.length,
    }),
  );
  check(
    isDeepStrictEqual(before.modules, metadata),
    'Every numbered module and supplement has exact lightweight metadata',
  );
  let blocks = 0;
  for (const expected of dataset.modules) {
    const actual: SoulfulModuleResponse = await json<SoulfulModuleResponse>(
      `${endpoint}/${expected.id}`,
      fixture.cookie,
    );
    assert.deepEqual(actual.module, expected, `Exact content for ${expected.id}`);
    assert.equal(actual.source.contentVersion, expectedVersion);
    blocks += actual.module.blocks.length;
  }
  check(
    true,
    `All ${dataset.modules.length} lazy module bodies and ${blocks} blocks exactly match the extracted source JSON`,
  );
  check(
    isDeepStrictEqual(fixtureRows(), original),
    'Index and all content GETs create no progress rows or changes',
  );
  check(
    (await raw(`${endpoint}/sj-module-999`, 'GET', undefined, fixture.cookie)).status === 404,
    'Unknown module ID returns 404',
  );
  check(
    (await raw(`${endpoint}/invalid`, 'GET', undefined, fixture.cookie)).status === 400,
    'Malformed module ID returns 400',
  );
  check(
    (
      await raw(
        `${endpoint}/${targets[0]}`,
        'PUT',
        action(0, { opened: true }),
        fixture.cookie,
        'https://untrusted.example',
      )
    ).status === 403,
    'Cross-origin progress writes are rejected',
  );
  for (const injection of [
    { userId: other.userId },
    { title: 'Replacement content' },
    { completedAt: '1999-01-01' },
  ])
    check(
      (
        await raw(
          `${endpoint}/${targets[0]}`,
          'PUT',
          { ...action(0, { opened: true }), ...injection },
          fixture.cookie,
        )
      ).status === 400,
      'Ownership, content and date injection are rejected',
    );
  const malformed = await fetch(new URL(`${endpoint}/${targets[0]}`, base), {
    method: 'PUT',
    redirect: 'error',
    headers: { cookie: fixture.cookie, origin: base.origin, 'content-type': 'application/json' },
    body: '{bad',
  });
  await malformed.arrayBuffer();
  check(malformed.status === 400, 'Invalid JSON is rejected');
  check(
    isDeepStrictEqual(fixtureRows(), original),
    'Rejected requests preserve all original fixture progress',
  );

  const old = before.progress.find((item) => item.moduleId === targets[0]);
  const openAction = action(old?.version ?? 0, { opened: true, completed: false });
  const opened = await json<SoulfulProgressResponse>(
    `${endpoint}/${targets[0]}`,
    fixture.cookie,
    'PUT',
    openAction,
  );
  check(
    opened.progress.lastOpenedAt !== null && opened.progress.version === (old?.version ?? 0) + 1,
    'Opening saves a private bookmark with the current version',
  );
  check(opened.resumeModuleId === targets[0], 'Continue resumes the unfinished opened module');
  check(
    isDeepStrictEqual(
      await json<SoulfulProgressResponse>(
        `${endpoint}/${targets[0]}`,
        fixture.cookie,
        'PUT',
        openAction,
      ),
      opened,
    ),
    'An identical bookmark retry is idempotent',
  );
  check(
    isDeepStrictEqual(
      (await json<SoulfulModuleResponse>(`${endpoint}/${targets[0]}`, fixture.cookie)).progress,
      opened.progress,
    ),
    'Reload returns the saved bookmark',
  );
  const completeAction = action(opened.progress.version, { completed: true });
  const completed = await json<SoulfulProgressResponse>(
    `${endpoint}/${targets[0]}`,
    fixture.cookie,
    'PUT',
    completeAction,
  );
  check(
    completed.progress.completed && Boolean(completed.progress.completedAt),
    'Completion saves the server completion timestamp',
  );
  check(
    (
      await raw(
        `${endpoint}/${targets[0]}`,
        'PUT',
        action(opened.progress.version, { completed: false }),
        fixture.cookie,
      )
    ).status === 409,
    'A stale device cannot overwrite completion',
  );
  const secondOld = before.progress.find((item) => item.moduleId === targets[1]);
  const [uncompleted, second] = await Promise.all([
    json<SoulfulProgressResponse>(
      `${endpoint}/${targets[0]}`,
      fixture.cookie,
      'PUT',
      action(completed.progress.version, { completed: false }),
    ),
    json<SoulfulProgressResponse>(
      `${endpoint}/${targets[1]}`,
      fixture.cookie,
      'PUT',
      action(secondOld?.version ?? 0, { completed: true }),
    ),
  ]);
  check(
    !uncompleted.progress.completed &&
      uncompleted.progress.completedAt === null &&
      second.progress.completed,
    'Different modules update independently and completion is reversible',
  );
  const race = await Promise.all([
    raw(
      `${endpoint}/${targets[0]}`,
      'PUT',
      action(uncompleted.progress.version, { completed: true }),
      fixture.cookie,
    ),
    raw(
      `${endpoint}/${targets[0]}`,
      'PUT',
      action(uncompleted.progress.version, { anchor: 0 }),
      fixture.cookie,
    ),
  ]);
  check(
    race.filter((response) => response.status === 200).length === 1 &&
      race.filter((response) => response.status === 409).length === 1,
    'Only one competing edit of the same module can commit',
  );
  const after = await json<SoulfulLibraryResponse>(endpoint, fixture.cookie);
  const afterOther = await json<SoulfulLibraryResponse>(endpoint, other.cookie);
  check(
    isDeepStrictEqual(
      afterOther.progress.filter((item) => targets.includes(item.moduleId)),
      otherBefore.progress.filter((item) => targets.includes(item.moduleId)),
    ),
    'Second account progress for the tested modules remains isolated',
  );
  const exported = await json<{ soulfulJapaReading: SoulfulProgress[] }>(
    '/api/export',
    fixture.cookie,
  );
  check(
    isDeepStrictEqual(exported.soulfulJapaReading, after.progress),
    'Full JSON export includes the fixture’s private written-module progress',
  );
  check(
    !JSON.stringify(exported.soulfulJapaReading).includes('userId') &&
      !JSON.stringify(exported.soulfulJapaReading).includes('lastRequest'),
    'Progress export excludes ownership and internal retry fields',
  );
  check((await raw('/api/export')).status === 401, 'Anonymous exports remain protected');
  check(
    (await raw(endpoint, 'GET', undefined, fixture.cookie)).headers.get('cache-control') ===
      'private, no-store',
    'Private library responses cannot be cached across accounts',
  );
  // Miniflare's local ProxyWorker can lose its next upstream connection after an
  // early 413 with an unread large request body. Test the bound last, after all
  // normal persistence requests; it is not a reader payload (which is <1 KiB).
  const beforeOversize = fixtureRows();
  check(
    (
      await raw(
        `${endpoint}/${targets[0]}`,
        'PUT',
        { ...action(0, { opened: true }), extra: 'x'.repeat(70_000) },
        fixture.cookie,
      )
    ).status === 413,
    'Oversized request bodies are rejected',
  );
  check(
    isDeepStrictEqual(fixtureRows(), beforeOversize),
    'Oversized requests cannot modify saved progress',
  );
} catch (error) {
  failure = error;
} finally {
  if (fixture && original) {
    try {
      const current = fixtureRows();
      for (const row of current) {
        const previous: SqlRow | undefined = original.find(
          (item) => item.module_id === row.module_id,
        );
        assert.ok(
          isDeepStrictEqual(row, previous) || ownedRequestIds.has(String(row.last_request_id)),
          'Fixture was edited outside this test; refusing to overwrite it',
        );
      }
      const restore: string[] = [];
      for (const moduleId of targets) {
        const row = current.find((item) => item.module_id === moduleId);
        if (!row || !ownedRequestIds.has(String(row.last_request_id))) continue;
        restore.push(
          `DELETE FROM soulful_reading_progress WHERE user_id=${sqlValue(fixture.userId)} AND module_id=${sqlValue(moduleId)} AND version=${row.version} AND last_request_id=${sqlValue(row.last_request_id)};`,
        );
        const previous = original.find((item) => item.module_id === moduleId);
        if (previous) {
          const columns = Object.keys(previous);
          restore.push(
            `INSERT INTO soulful_reading_progress(${columns.map((column) => `"${column}"`).join(',')}) VALUES(${columns.map((column) => sqlValue(previous[column])).join(',')});`,
          );
        }
      }
      if (restore.length) localSql(restore.join('\n'));
      check(
        isDeepStrictEqual(fixtureRows(), original),
        'Only test-owned fixture progress is restored exactly',
      );
    } catch (error) {
      failure = failure
        ? new AggregateError([failure, error], 'Test or fixture cleanup failed')
        : error;
    }
  }
  for (const session of [fixture, other])
    if (session?.cookie) {
      const signedOut = await raw('/api/auth/sign-out', 'POST', {}, session.cookie).catch(
        () => null,
      );
      // Sign-out is idempotent; retry the local proxy transport failure only.
      if (!signedOut || signedOut.status >= 500)
        await raw('/api/auth/sign-out', 'POST', {}, session.cookie).catch(() => {});
    }
}
if (failure) throw failure;
console.log(`\n${passed} written Soulful Japa assertions passed against local Workers + D1.`);
