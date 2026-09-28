import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { isDeepStrictEqual } from 'node:util';
import type { GitaReadingResponse, GitaReadingProgress } from '../lib/domain/gita-reading';
import type { CompanionItem } from '../lib/domain/companion';

const base = new URL(process.env.TEST_BASE_URL || 'http://localhost:3000');
if (
  !['localhost', '127.0.0.1', '[::1]'].includes(base.hostname) ||
  !['http:', 'https:'].includes(base.protocol) ||
  base.username ||
  base.password
)
  throw new Error('Reading integration is local-only.');
if (Number(process.versions.node.split('.')[0]) < 22) throw new Error('Use Node.js 22 or newer.');
let cookie = '',
  userId = '',
  passed = 0;
const sessions = new Set<string>();
let original: CompanionItem | undefined;
let initialized = false;
function check(value: unknown, label: string) {
  assert.ok(value, label);
  passed++;
  console.log('✓ ' + label);
}
async function raw(
  method = 'GET',
  data?: unknown,
  auth = cookie,
  origin = base.origin,
  path = '/api/reading-progress',
) {
  return fetch(new URL(path, base), {
    method,
    headers: { cookie: auth, origin, 'Content-Type': 'application/json' },
    body: data === undefined ? undefined : JSON.stringify(data),
  });
}
async function api(method = 'GET', data?: unknown): Promise<GitaReadingResponse> {
  const response = await raw(method, data);
  assert.ok(response.ok, `${method} reading: ${response.status} ${await response.clone().text()}`);
  const result = (await response.json()) as GitaReadingResponse;
  if (result.progress?.session) sessions.add(result.progress.session.id);
  return result;
}
async function currentItem() {
  const response = await raw('GET', undefined, cookie, base.origin, '/api/companion');
  assert.equal(response.status, 200);
  return ((await response.json()) as { items: CompanionItem[] }).items.find(
    (item) => item.key === 'reading:bg',
  );
}
function localSql(command: string) {
  execFileSync(
    process.execPath,
    [
      'node_modules/wrangler/bin/wrangler.js',
      'd1',
      'execute',
      'DB',
      '--local',
      '--command',
      command,
      '--json',
    ],
    { stdio: ['ignore', 'pipe', 'pipe'] },
  );
}
const quote = (value: string) => "'" + value.replaceAll("'", "''") + "'";
try {
  const login = await raw(
    'POST',
    { email: 'other@example.test', password: 'Local-Journal-Only-2026!' },
    '',
    base.origin,
    '/api/auth/sign-in/email',
  );
  assert.equal(login.status, 200);
  userId = ((await login.json()) as { user: { id: string } }).user.id;
  cookie = login.headers
    .getSetCookie()
    .map((item) => item.split(';')[0])
    .join('; ');
  original = await currentItem();
  // Never overwrite a session that someone is using for an independent local review.
  if ((await api()).progress?.session)
    throw new Error(
      'The isolated fixture has an active reading session; finish it before running this test.',
    );
  initialized = true;
  check((await raw('GET', undefined, '')).status === 401, 'Anonymous reading progress is private');
  check(
    (await raw('POST', { action: 'start', version: 0, requestId: crypto.randomUUID() }, ''))
      .status === 401,
    'Anonymous reading submission is rejected',
  );
  check(
    (
      await raw(
        'POST',
        { action: 'start', version: 0, requestId: crypto.randomUUID() },
        cookie,
        'https://untrusted.example',
      )
    ).status === 403,
    'Cross-origin reading submission is rejected',
  );
  let state = await api();
  const startInput = {
    action: 'start',
    version: state.version,
    requestId: crypto.randomUUID(),
    start: { chapter: 2, verse: 9 },
  };
  state = await api('POST', startInput);
  const active = state.progress!.session!;
  check(
    active.start.chapter === 2 && active.start.verse === 9,
    'Starting verse is captured on the server',
  );
  check(
    state.progress!.bookId === 'bg' && /^\d{4}-\d{2}-\d{2}$/.test(active.date),
    'Book and local date are captured automatically',
  );
  check(
    (await api('POST', startInput)).progress?.session?.id === active.id,
    'Repeated start request returns the same session',
  );
  check(
    (await api()).progress?.session?.id === active.id,
    'Unfinished reading survives a fresh request',
  );
  const finishInput = {
    action: 'finish',
    version: state.version,
    requestId: crypto.randomUUID(),
    sessionId: active.id,
    end: { chapter: 2, verse: 10 },
    durationMinutes: 7,
    note: 'Local integration reading note',
  };
  check(
    (await raw('POST', { ...finishInput, end: { chapter: 2, verse: 8 } })).status === 400,
    'Ending before the captured start is rejected',
  );
  check(
    (await raw('POST', { ...finishInput, end: { chapter: 2, verse: 73 } })).status === 400,
    'Impossible verse is rejected',
  );
  check(
    (await raw('POST', { ...finishInput, userId: 'someone-else' })).status === 400,
    'Submitted ownership is rejected',
  );
  check(
    (await raw('POST', { ...finishInput, version: state.version - 1 })).status === 409,
    'Stale finish version cannot advance the bookmark',
  );
  check(
    (await api()).progress?.session?.id === active.id,
    'Rejected submissions keep the active session',
  );
  state = await api('POST', finishInput);
  check(
    state.progress?.cursor?.chapter === 2 &&
      state.progress.cursor.verse === 11 &&
      state.progress.session === null,
    'Finishing 2:10 makes 2:11 the next reading',
  );
  const journalId = state.journalId;
  check(Boolean(journalId), 'Completion confirms its journal entry');
  const retry = await api('POST', finishInput);
  check(
    retry.journalId === journalId && retry.version === state.version,
    'Retried finish neither duplicates the report nor advances twice',
  );
  const exportResponse = await raw('GET', undefined, cookie, base.origin, '/api/export');
  const exported = (await exportResponse.json()) as {
    records: {
      reading: Array<{ id: string; book: string; verseRange: string; reflection: string }>;
    };
    companion: CompanionItem[];
  };
  const reports = exported.records.reading.filter((item) => item.id === journalId);
  check(
    reports.length === 1 &&
      reports[0].verseRange.includes('2:9') &&
      reports[0].verseRange.includes('2:10') &&
      reports[0].reflection === 'Local integration reading note',
    'One complete report contains the captured range and note',
  );
  check(
    exported.companion.some((item) => item.key === 'reading:bg'),
    'Full export includes the next-verse bookmark',
  );
  const bypass = await raw(
    'PUT',
    { key: 'reading:bg', version: state.version, value: state.progress },
    cookie,
    base.origin,
    '/api/companion',
  );
  check(!bypass.ok, 'Generic companion writes cannot bypass reading transactions');
  const races = await Promise.all(
    [1, 2].map(() =>
      raw('POST', {
        action: 'start',
        version: state.version,
        requestId: crypto.randomUUID(),
        start: { chapter: 2, verse: 72 },
      }),
    ),
  );
  check(
    races.some((r) => r.ok) && races.every((r) => r.ok || r.status === 409),
    'Concurrent starts either resume the active session or reject a stale request',
  );
  state = await api();
  const boundary = state.progress!.session!;
  state = await api('POST', {
    action: 'finish',
    version: state.version,
    requestId: crypto.randomUUID(),
    sessionId: boundary.id,
    end: { chapter: 2, verse: 72 },
  });
  check(
    state.progress?.cursor?.chapter === 3 && state.progress.cursor.verse === 1,
    'Final verse of a chapter advances to the next chapter',
  );
  state = await api('POST', {
    action: 'start',
    version: state.version,
    requestId: crypto.randomUUID(),
    start: { chapter: 18, verse: 78 },
  });
  state = await api('POST', {
    action: 'finish',
    version: state.version,
    requestId: crypto.randomUUID(),
    sessionId: state.progress!.session!.id,
    end: { chapter: 18, verse: 78 },
  });
  check(
    state.progress?.completed && state.progress.cursor === null,
    'Final verse completes the book without wrapping',
  );
} finally {
  if (initialized) {
    const latest = await currentItem();
    if (latest) {
      const value = latest.value as GitaReadingProgress;
      const owner = value.session?.id ?? value.lastFinished?.sessionId;
      assert.ok(
        owner && sessions.has(owner),
        'Fixture changed outside this test; cleanup will not overwrite it',
      );
      const guard = `user_id=${quote(userId)} AND key='reading:bg' AND version=${latest.version} AND value=${quote(JSON.stringify(latest.value))}`;
      const restore = original
        ? `UPDATE companion_entries SET value=${quote(JSON.stringify(original.value))},version=${original.version} WHERE ${guard};`
        : `DELETE FROM companion_entries WHERE ${guard};`;
      const ids = [...sessions].map(quote).join(',');
      localSql(
        `${restore} ${ids ? `DELETE FROM reading_sessions WHERE user_id=${quote(userId)} AND id IN (${ids});` : ''}`,
      );
    }
    check(
      isDeepStrictEqual((await currentItem())?.value, original?.value),
      'Original fixture bookmark is restored',
    );
  }
}
console.log(`\n${passed} reading integration assertions passed on local Workers + D1.`);
