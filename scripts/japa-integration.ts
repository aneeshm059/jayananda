import assert from 'node:assert/strict';
import type { AppState, Entry } from '../lib/domain/model';
import { todayReport } from '../lib/domain/today-report';
const base = process.env.TEST_BASE_URL || 'http://localhost:3000';
if (!['localhost', '127.0.0.1'].includes(new URL(base).hostname))
  throw new Error('Tests are local-only.');
let passed = 0;
function check(value: unknown, message: string) {
  assert.ok(value, message);
  console.log('✓ ' + message);
  passed++;
}
async function login(email: string) {
  const response = await fetch(base + '/api/auth/sign-in/email', {
    method: 'POST',
    headers: { origin: base, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'Local-Journal-Only-2026!' }),
  });
  assert.equal(response.status, 200);
  return response.headers
    .getSetCookie()
    .map((value) => value.split(';')[0])
    .join('; ');
}
const cookie = await login('demo@example.test');
const other = await login('other@example.test');
async function raw(path: string, method = 'GET', data?: unknown, session = cookie, origin = base) {
  return fetch(base + path, {
    method,
    headers: { cookie: session, origin, 'Content-Type': 'application/json' },
    body: data === undefined ? undefined : JSON.stringify(data),
  });
}
async function api<T>(path: string, method = 'GET', data?: unknown): Promise<T> {
  const response = await raw(path, method, data);
  assert.ok(response.ok, `${method} ${path}: ${response.status}`);
  return response.json() as Promise<T>;
}
const payload = (entry: Entry) => ({
  id: entry.id,
  date: entry.date,
  expectedRounds: entry.rounds,
  expectedUpdatedAt: entry.updatedAt,
});
let created: Entry | undefined;
try {
  const state = await api<AppState>('/api/state');
  const before = todayReport(state).values.rounds;
  created = await api<Entry>('/api/data/japa', 'POST', {
    date: state.today,
    rounds: 2,
    durationMinutes: 19,
    attention: 4,
    startTime: '05:00',
    endTime: '05:19',
    location: 'Test room',
    helped: 'Keep this reflection.',
    distractions: 'Keep this too.',
    interruptions: 1,
  });
  const original = payload(created);
  check(
    (await raw('/api/japa/decrement', 'POST', original, '')).status === 401,
    'Anonymous correction rejected',
  );
  check(
    (await raw('/api/japa/decrement', 'POST', original, other)).status === 404,
    'Another user cannot correct this session',
  );
  check(
    (await raw('/api/japa/decrement', 'POST', original, cookie, 'https://untrusted.example'))
      .status === 403,
    'Cross-origin correction rejected',
  );
  check(
    (await raw('/api/japa/decrement', 'POST', { ...original, date: '2020-01-01' })).status === 404,
    'Correction cannot target the wrong date',
  );
  check(
    (await raw('/api/japa/decrement', 'POST', { ...original, expectedRounds: -1 })).status === 400,
    'Invalid negative expectation rejected',
  );
  const responses = await Promise.all([
    raw('/api/japa/decrement', 'POST', original),
    raw('/api/japa/decrement', 'POST', original),
  ]);
  check(
    responses.filter((r) => r.status === 200).length === 1 &&
      responses.filter((r) => r.status === 409).length === 1,
    'Concurrent or retried clicks subtract exactly one round',
  );
  const updated = (await responses.find((r) => r.status === 200)!.json()) as Entry;
  check(updated.rounds === 1, 'One click removes one round');
  check(
    updated.durationMinutes === 19 &&
      updated.attention === 4 &&
      updated.startTime === '05:00' &&
      updated.endTime === '05:19' &&
      updated.helped === 'Keep this reflection.' &&
      updated.distractions === 'Keep this too.' &&
      updated.location === 'Test room' &&
      updated.interruptions === 1,
    'Correction preserves session times, duration, attention and notes',
  );
  check(!('userId' in updated), 'Correction response excludes owner identifier');
  const fresh = await api<AppState>('/api/state');
  check(
    todayReport(fresh).values.rounds === before + 1,
    'Fresh today report reflects corrected total',
  );
  const zero = await api<Entry>('/api/japa/decrement', 'POST', payload(updated));
  check(
    zero.rounds === 0 && zero.helped === created.helped,
    'Last round can be removed while retaining the session',
  );
  check(
    (await raw('/api/japa/decrement', 'POST', payload(zero))).status === 400,
    'Zero cannot be decremented below zero',
  );
  check(
    (await raw('/api/japa/decrement', 'POST', payload(updated))).status === 409,
    'A stale retry cannot subtract again',
  );
  const final = await api<AppState>('/api/state');
  check(todayReport(final).values.rounds === before, 'Corrected total persists across fresh reads');
  const reportPage = await raw('/today-report');
  check(reportPage.status === 200, 'Today Report route is available when signed in');
  const anonymous = await fetch(base + '/today-report', { redirect: 'manual' });
  check(
    [302, 303, 307, 308].includes(anonymous.status) &&
      anonymous.headers.get('location')?.includes('/login'),
    'Today Report remains private',
  );
} finally {
  if (created) await raw('/api/data/japa?id=' + encodeURIComponent(created.id), 'DELETE');
  await raw('/api/auth/sign-out', 'POST', {});
  await raw('/api/auth/sign-out', 'POST', {}, other);
}
console.log(`\n${passed} Japa/report integration assertions passed against local Workers + D1.`);
