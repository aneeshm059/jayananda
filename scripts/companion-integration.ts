import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { isDeepStrictEqual } from 'node:util';
import type { CompanionItem, Rhythm } from '../lib/domain/companion';

const base = process.env.TEST_BASE_URL || 'http://localhost:3000';
const baseUrl = new URL(base);
if (Number(process.versions.node.split('.')[0]) < 22)
  throw new Error('Use Node.js 22 or newer so local D1 cleanup can run before testing.');
if (
  !['localhost', '127.0.0.1', '[::1]'].includes(baseUrl.hostname) ||
  !['http:', 'https:'].includes(baseUrl.protocol) ||
  baseUrl.username ||
  baseUrl.password
)
  throw new Error('Companion integration tests are local-only.');

const fixturePassword = 'Local-Journal-Only-2026!';
type Session = {
  cookie: string;
  userId: string;
  original?: CompanionItem;
  written?: CompanionItem;
};
const sessions: Session[] = [];
let passed = 0;

function check(value: unknown, message: string) {
  assert.ok(value, message);
  passed++;
  console.log('✓ ' + message);
}

async function raw(
  path: string,
  method = 'GET',
  data?: unknown,
  cookie = '',
  origin = baseUrl.origin,
) {
  return fetch(new URL(path, baseUrl), {
    method,
    redirect: 'error',
    headers: { cookie, origin, 'Content-Type': 'application/json' },
    body: data === undefined ? undefined : JSON.stringify(data),
  });
}

async function api<T>(path: string, session: Session, method = 'GET', data?: unknown): Promise<T> {
  const response = await raw(path, method, data, session.cookie);
  assert.ok(response.ok, `${method} ${path} returned ${response.status}`);
  return response.json() as Promise<T>;
}

async function login(email: string): Promise<Session> {
  const response = await raw('/api/auth/sign-in/email', 'POST', {
    email,
    password: fixturePassword,
  });
  assert.equal(response.status, 200, 'Sign in with the seeded local fixture');
  const data = (await response.json()) as { user?: { id?: string } };
  assert.equal(typeof data.user?.id, 'string');
  const session: Session = {
    userId: data.user!.id!,
    cookie: response.headers
      .getSetCookie()
      .map((value) => value.split(';')[0])
      .join('; '),
  };
  assert.ok(session.cookie, 'Sign-in returns a session cookie');
  sessions.push(session);
  const { items } = await api<{ items: CompanionItem[] }>('/api/companion', session);
  session.original = items.find((item) => item.key === 'rhythm');
  return session;
}

async function items(session: Session) {
  return (await api<{ items: CompanionItem[] }>('/api/companion', session)).items;
}

async function write(session: Session, value: Rhythm) {
  const version = session.written?.version ?? session.original?.version ?? 0;
  const result = await api<CompanionItem>('/api/companion', session, 'PUT', {
    key: 'rhythm',
    value,
    version,
  });
  session.written = result;
  check(result.version === version + 1, 'Successful rhythm write advances the version');
  check(isDeepStrictEqual(result.value, value), 'Write response confirms the saved rhythm');
  return result;
}

const forbiddenKeys = new Set([
  'userid',
  'password',
  'passwordhash',
  'accesstoken',
  'refreshtoken',
  'idtoken',
  'token',
  'secret',
  'sessions',
  'accounts',
]);
function hasPrivateFields(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  return Object.entries(value).some(
    ([key, entry]) =>
      forbiddenKeys.has(key.replaceAll('_', '').toLowerCase()) || hasPrivateFields(entry),
  );
}

async function restore(session: Session) {
  if (!session.written) return;
  const current = (await items(session)).find((item) => item.key === 'rhythm');
  assert.ok(
    current && isDeepStrictEqual(current, session.written),
    'Rhythm changed outside this test; cleanup will not overwrite it',
  );
  if (session.original) {
    await api('/api/companion', session, 'PUT', {
      key: 'rhythm',
      value: session.original.value,
      version: current.version,
    });
  } else {
    // There is no HTTP delete endpoint. Remove only this test-created local item,
    // guarded by its owner, key, value and version; fixture users are never deleted.
    const sqlString = (value: string) => "'" + value.replaceAll("'", "''") + "'";
    execFileSync(
      process.execPath,
      [
        'node_modules/wrangler/bin/wrangler.js',
        'd1',
        'execute',
        'DB',
        '--local',
        '--command',
        `DELETE FROM companion_entries WHERE user_id=${sqlString(session.userId)} AND key='rhythm' AND version=${current.version} AND value=${sqlString(JSON.stringify(current.value))}`,
        '--json',
      ],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
    );
  }
  const restored = (await items(session)).find((item) => item.key === 'rhythm');
  check(
    session.original
      ? isDeepStrictEqual(restored?.value, session.original.value)
      : restored === undefined,
    'Original rhythm state restored without touching other companion items',
  );
}

let failure: unknown;
try {
  const session = await login('demo@example.test');
  const other = await login('other@example.test');
  const firstValue = { japaTime: '03:17', readingTime: '12:23', hearingTime: '17:41' };
  const secondValue = { japaTime: '04:19', readingTime: '13:29', hearingTime: '18:43' };
  const otherValue = { japaTime: '05:13', readingTime: '14:31', hearingTime: '19:47' };
  const payload = { key: 'rhythm', value: firstValue, version: session.original?.version ?? 0 };

  const [anonymousRead, anonymousWrite, foreignWrite] = await Promise.all([
    raw('/api/companion'),
    raw('/api/companion', 'PUT', payload),
    raw('/api/companion', 'PUT', payload, session.cookie, 'https://untrusted.example'),
  ]);
  check(anonymousRead.status === 401, 'Anonymous companion reads return 401');
  check(anonymousWrite.status === 401, 'Anonymous companion writes return 401');
  check(foreignWrite.status === 403, 'Cross-origin companion writes return 403');

  const invalid = [
    { ...payload, key: 'unknown-key' },
    { ...payload, value: { ...firstValue, japaTime: '25:00' } },
    { ...payload, version: -1 },
    { ...payload, userId: other.userId },
  ];
  for (const data of invalid) {
    check(
      (await raw('/api/companion', 'PUT', data, session.cookie)).status === 400,
      'Malformed key, time, version or ownership input is rejected with 400',
    );
  }

  const first = await write(session, firstValue);
  check(
    isDeepStrictEqual(
      (await items(session)).find((item) => item.key === 'rhythm'),
      first,
    ),
    'A fresh GET returns the persisted rhythm and version',
  );
  check(
    isDeepStrictEqual(
      (await items(other)).find((item) => item.key === 'rhythm'),
      other.original,
    ),
    'The first user’s write does not appear in the second account',
  );
  await write(other, otherValue);
  check(
    isDeepStrictEqual(
      (await items(session)).find((item) => item.key === 'rhythm'),
      first,
    ),
    'Writing the same key in another account cannot change the first user’s rhythm',
  );
  const updated = await write(session, secondValue);
  check(
    (
      await raw(
        '/api/companion',
        'PUT',
        { key: 'rhythm', value: firstValue, version: first.version },
        session.cookie,
      )
    ).status === 409,
    'A stale version returns 409',
  );
  check(
    isDeepStrictEqual(
      (await items(session)).find((item) => item.key === 'rhythm'),
      updated,
    ),
    'Rejected stale writes leave the latest saved value intact',
  );

  const exportedResponse = await raw('/api/export', 'GET', undefined, session.cookie);
  assert.equal(exportedResponse.status, 200);
  const exported = (await exportedResponse.json()) as { companion?: CompanionItem[] };
  const otherExport = await api<{ companion?: CompanionItem[] }>('/api/export', other);
  check(
    Array.isArray(exported.companion) &&
      isDeepStrictEqual(exported.companion, await items(session)),
    'JSON export includes the complete current user companion data',
  );
  check(
    isDeepStrictEqual(
      otherExport.companion?.find((item) => item.key === 'rhythm')?.value,
      otherValue,
    ),
    'The second user’s export contains only their own rhythm',
  );
  const exports = [exported, otherExport];
  check(
    exports.every((value) => !hasPrivateFields(value)),
    'Exports exclude ownership and authentication fields',
  );
  const privateValues = [
    fixturePassword,
    ...sessions.map((item) => item.userId),
    ...sessions.flatMap((item) =>
      item.cookie.split('; ').map((cookie) => cookie.slice(cookie.indexOf('=') + 1)),
    ),
  ].filter(Boolean);
  check(
    exports.every((value) =>
      privateValues.every((privateValue) => !JSON.stringify(value).includes(privateValue)),
    ),
    'Exports contain no fixture user IDs, passwords or session credentials',
  );
  check(
    exportedResponse.headers.get('cache-control')?.includes('private') &&
      exportedResponse.headers.get('cache-control')?.includes('no-store'),
    'Private exports are not cacheable',
  );
} catch (cause) {
  failure = cause;
} finally {
  for (const session of sessions) {
    try {
      await restore(session);
    } catch (cause) {
      failure = failure
        ? new AggregateError([failure, cause], 'Test or restoration failed')
        : cause;
    } finally {
      await raw('/api/auth/sign-out', 'POST', {}, session.cookie).catch(() => {});
    }
  }
}
if (failure) throw failure;
console.log(`\n${passed} companion integration assertions passed against local Workers + D1.`);
