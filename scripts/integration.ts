import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { type Collection, type AppState, type Entry } from '../lib/domain/model';
import { totals, health, onDate } from '../lib/domain/calculations';
const base = process.env.TEST_BASE_URL || 'http://localhost:3000';
if (!['localhost', '127.0.0.1'].includes(new URL(base).hostname))
  throw new Error('Integration tests are local-only.');
let passed = 0;
function check(condition: unknown, message: string) {
  assert.ok(condition, message);
  console.log('✓ ' + message);
  passed++;
}
const raw = async (path: string, options: RequestInit = {}) => fetch(base + path, options);
const anonymous = await raw('/api/state');
check(anonymous.status === 401, 'Personal API rejects anonymous access');
const page = await raw('/', { redirect: 'manual' });
check(
  [302, 303, 307, 308].includes(page.status) && page.headers.get('location')?.includes('/login'),
  'Private pages redirect to sign-in',
);
const auth = await raw('/api/auth/sign-in/email', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', origin: base },
  body: JSON.stringify({ email: 'demo@example.test', password: 'Local-Journal-Only-2026!' }),
});
const authBody = await auth.text();
check(auth.status === 200, 'Better Auth password sign-in works: ' + auth.status);
const cookies = auth.headers
  .getSetCookie()
  .map((v) => v.split(';')[0])
  .join('; ');
check(cookies.includes('session_token'), 'Session cookie issued');
check(
  auth.headers.getSetCookie().some((v) => v.includes('HttpOnly') && v.includes('SameSite=Lax')),
  'Session cookie uses HttpOnly and SameSite',
);
async function api<T>(
  path: string,
  method = 'GET',
  data?: unknown,
  extra: Record<string, string> = {},
): Promise<T> {
  const response = await raw(path, {
    method,
    headers: { cookie: cookies, origin: base, 'Content-Type': 'application/json', ...extra },
    body: data ? JSON.stringify(data) : undefined,
  });
  const body = await response.json();
  assert.ok(response.ok, `${method} ${path}: ${response.status} ${JSON.stringify(body)}`);
  return body as T;
}
let state = await api<AppState>('/api/state');
const date = state.today;
check(state.records.japa.length >= 14, '14 days of local demo data load from D1');
check(
  !state.records.japa.some((e) => e.id === 'other-private-entry'),
  'Reads are scoped to signed-in user',
);
const blocked = await raw('/api/data/japa', {
  method: 'POST',
  headers: {
    cookie: cookies,
    'Content-Type': 'application/json',
    origin: 'https://untrusted.example',
  },
  body: JSON.stringify({ date, rounds: 1 }),
});
check(blocked.status === 403, 'Cross-origin mutation blocked');
const invalid = await raw('/api/data/krishna', {
  method: 'POST',
  headers: { cookie: cookies, 'Content-Type': 'application/json', origin: base },
  body: JSON.stringify({ date, durationMinutes: 5, startPage: 20, endPage: 5 }),
});
check(invalid.status === 400, 'Invalid page range rejected');
const negative = await raw('/api/data/japa', {
  method: 'POST',
  headers: { cookie: cookies, 'Content-Type': 'application/json', origin: base },
  body: JSON.stringify({ date, rounds: -1 }),
});
check(negative.status === 400, 'Negative rounds rejected');
const privateEdit = await raw('/api/data/japa?id=other-private-entry', {
  method: 'PATCH',
  headers: { cookie: cookies, 'Content-Type': 'application/json', origin: base },
  body: JSON.stringify({ date, rounds: 7 }),
});
check(privateEdit.status === 404, 'Cannot edit another user’s record');
const privateDelete = await raw('/api/data/japa?id=other-private-entry', {
  method: 'DELETE',
  headers: { cookie: cookies, origin: base },
});
check(privateDelete.status === 404, 'Cannot delete another user’s record');
const retryId = crypto.randomUUID();
const once = await api<Entry>('/api/data/japa', 'POST', { date, rounds: 1, _requestId: retryId });
const twice = await api<Entry>('/api/data/japa', 'POST', { date, rounds: 1, _requestId: retryId });
check(once.id === twice.id, 'Retried saves do not duplicate Japa rounds');
await api('/api/data/japa?id=' + once.id, 'DELETE');
const before = totals(onDate(state.records, date), state.settings).rounds;
const score = health(onDate(state.records, date), state.settings);
const fixtures: Partial<Record<Collection, Record<string, unknown>>> = {
  japa: { rounds: 4, attention: 4, durationMinutes: 28 },
  hearing: { title: 'Integration hearing', durationMinutes: 30 },
  reading: { book: 'Bhagavad-gītā As It Is', durationMinutes: 20, pages: 5 },
  krishna: {
    durationMinutes: 23,
    chapterNumber: 27,
    startPage: 148,
    endPage: 158,
    chapterCompleted: true,
  },
  seva: { service: 'Integration service', category: 'Temple', attitude: 'Willing Service' },
  association: { person: 'Integration group', durationMinutes: 30 },
  quality: { quality: 'Humility', reflection: 'A little service.' },
  goals: { title: 'Integration intention' },
  reminders: { message: 'Integration cue', time: '05:30', enabled: false },
};
const created: Array<[Collection, string]> = [];
for (const [collection, fixture] of Object.entries(fixtures)) {
  const entry = await api<Entry>('/api/data/' + collection, 'POST', { date, ...fixture });
  created.push([collection as Collection, entry.id]);
  check(Boolean(entry.id), `${collection} creates a real D1 record`);
}
state = await api<AppState>('/api/state');
check(
  totals(onDate(state.records, date), state.settings).rounds === before + 4,
  'Japa persists after a fresh request',
);
check(
  health(onDate(state.records, date), state.settings) >= score,
  'Sādhana Health recalculates from saved records',
);
check(
  state.records.krishna.some((e) => e.pagesRead === 11 && e.chapterNumber === 27),
  'Krishna Book page count calculated server-side',
);
const jid = created.find(([c]) => c === 'japa')![1];
await api('/api/data/japa?id=' + jid, 'PATCH', {
  date,
  rounds: 6,
  durationMinutes: 42,
  attention: 3,
});
state = await api<AppState>('/api/state');
check(
  state.records.japa.some((e) => e.id === jid && e.rounds === 6),
  'Edits persist in D1',
);
const settings = state.settings;
await api('/api/settings', 'PUT', { ...settings, theme: 'dark' });
state = await api<AppState>('/api/state');
check(state.settings.theme === 'dark', 'Settings persist');
await api('/api/settings', 'PUT', settings);
const daily = await api<Entry>('/api/data/sankalpa', 'POST', { date, text: 'First intention' });
const updated = await api<Entry>('/api/data/sankalpa', 'POST', { date, text: 'Revised intention' });
check(daily.id === updated.id, 'Daily duplicates intentionally upsert');
await api('/api/data/sankalpa?id=' + daily.id, 'DELETE');
const night = await api<Entry>('/api/data/reflection', 'POST', {
  date,
  grateful: 'Integration gratitude',
  prayer: 'Integration prayer',
});
state = await api<AppState>('/api/state');
check(
  state.records.reflection.some((e) => e.id === night.id),
  'Night reflection saves',
);
check(
  state.records.daily.some((e) => e.date === date && e.closed),
  'Offering the day atomically closes it',
);
await api('/api/data/reflection?id=' + night.id, 'DELETE');
const json = await api<{ records: AppState['records'] }>('/api/export');
check(
  Boolean(json.records.japa.length) && !JSON.stringify(json).includes('session_token'),
  'JSON export contains personal records without auth secrets',
);
const csv = await raw('/api/export?collection=japa', { headers: { cookie: cookies } });
check(
  csv.status === 200 && csv.headers.get('content-type')?.includes('text/csv'),
  'CSV export works',
);
for (const [collection, fixture] of Object.entries({
  wake: { actualTime: '05:12', programCompleted: true },
  weekly: { helped: 'A quiet morning', sankalpa: 'Listen carefully' },
  monthly: { realization: 'Consistency matters', prayer: 'Please help me serve' },
  prabhupada: { instruction: 'Remember to hear', prayer: 'Please guide me' },
  purpose: { text: 'Integration purpose' },
})) {
  const testDate = '2020-01-01';
  const entry = await api<Entry>('/api/data/' + collection, 'POST', { date: testDate, ...fixture });
  const read = await api<Entry[]>(
    '/api/data/' + collection + '?from=' + testDate + '&to=' + testDate,
  );
  check(
    read.some((e) => e.id === entry.id),
    collection + ' persists and reads correctly',
  );
  await api('/api/data/' + collection + '?id=' + entry.id, 'DELETE');
}
for (const [collection, id] of created)
  await api('/api/data/' + collection + '?id=' + id, 'DELETE');
state = await api<AppState>('/api/state');
check(!state.records.japa.some((e) => e.id === jid), 'Deletes persist');
const signup = await raw('/api/auth/sign-up/email', {
  method: 'POST',
  headers: { origin: base, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'attacker@example.test',
    password: 'Test-password-12345',
    name: 'Unauthorized',
  }),
});
check(signup.status === 403, 'Public registration disabled');
await api('/api/auth/sign-out', 'POST', {});
const expired = await raw('/api/state', { headers: { cookie: cookies } });
check(expired.status === 401, 'Sign-out invalidates server-side session');
console.log(`\n${passed} integration assertions passed against local Workers + D1.`);
