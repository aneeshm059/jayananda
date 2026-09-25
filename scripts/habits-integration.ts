import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { type AppState } from '../lib/domain/model';
import { type Habit, type HabitReport, type HabitCheckin } from '../lib/domain/habits';
import { addDays, localDate } from '../lib/domain/dates';

const base = 'http://localhost:3000';
let passed = 0;
const check = (value: unknown, message: string) => {
  assert.ok(value, message);
  passed++;
  console.log('✓ ' + message);
};
async function login(email: string) {
  const r = await fetch(base + '/api/auth/sign-in/email', {
    method: 'POST',
    headers: { origin: base, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'Local-Journal-Only-2026!' }),
  });
  assert.equal(r.status, 200);
  return r.headers
    .getSetCookie()
    .map((v) => v.split(';')[0])
    .join('; ');
}
const cookie = await login('demo@example.test'),
  otherCookie = await login('other@example.test');
async function raw(
  path: string,
  method = 'GET',
  body?: unknown,
  headers: Record<string, string> = {},
) {
  return fetch(base + path, {
    method,
    headers: { cookie, origin: base, 'Content-Type': 'application/json', ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
}
async function api<T>(
  path: string,
  method = 'GET',
  body?: unknown,
  headers: Record<string, string> = {},
): Promise<T> {
  const r = await raw(path, method, body, headers);
  assert.ok(r.ok, `${method} ${path}: ${r.status} ${await r.clone().text()}`);
  return r.json() as Promise<T>;
}
const created: string[] = [];
function localSql(statement: string) {
  return JSON.parse(
    execFileSync(
      'npx',
      ['wrangler', 'd1', 'execute', 'DB', '--local', '--command', statement, '--json'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
    ),
  );
}
try {
  await api('/api/habits/starter', 'POST', {});
  await api('/api/habits/starter', 'POST', {});
  let state = await api<AppState>('/api/state');
  const today = state.today,
    yesterday = addDays(today, -1),
    headers = { 'x-habit-day': today };
  check(
    state.habits.habits.filter((h) => h.starterKey).length === 3,
    'Three starter habits, without duplicates after retries',
  );
  check(
    state.habits.habits.some((h) => h.name === 'Brahmacharya'),
    'Brahmacharya starter is available',
  );
  const input = {
    name: 'Integration commitment',
    intention: 'Test a daily promise',
    startDate: yesterday,
    endDate: addDays(today, 365),
  };
  const habit = await api<Habit>('/api/habits', 'POST', input);
  created.push(habit.id);
  check(Boolean(habit.id), 'A custom habit persists');
  const path = `/api/habits/${habit.id}`,
    endpoint = path + '/checkin';
  check(
    (await raw('/api/habits', 'POST', { ...input, endDate: addDays(yesterday, -1) })).status ===
      400,
    'Reversed commitment dates rejected',
  );
  check(
    (await raw(endpoint, 'PATCH', { completed: true }, { cookie: '', ...headers })).status === 401,
    'Anonymous check-ins rejected',
  );
  check(
    (
      await raw(
        endpoint,
        'PATCH',
        { completed: true },
        { ...headers, origin: 'https://untrusted.example' },
      )
    ).status === 403,
    'Cross-origin habit mutations rejected',
  );
  check(
    (await raw(path, 'GET', undefined, { cookie: otherCookie })).status === 404,
    'Habit history is private to its owner',
  );
  check(
    (await raw(path, 'PATCH', { ...input, name: 'Intruder' }, { cookie: otherCookie })).status ===
      404,
    'Another user cannot edit habit definitions',
  );
  check(
    (await raw(endpoint, 'PATCH', { completed: true }, { cookie: otherCookie, ...headers }))
      .status === 404,
    'Another user cannot check in to this habit',
  );
  check(
    (await raw(endpoint, 'PATCH', { completed: true, date: yesterday }, headers)).status === 400,
    'Clients cannot submit a date for a daily check-in',
  );
  check(
    (await raw(endpoint, 'PATCH', { completed: true }, { 'x-habit-day': yesterday })).status ===
      409,
    'An overnight stale page cannot silently save under a new day',
  );
  const first = await api<HabitCheckin>(endpoint, 'PATCH', { completed: true }, headers);
  check(
    first.date === localDate(state.settings.timezone),
    'The server assigns the current local calendar date',
  );
  await api(endpoint, 'PATCH', { completed: true }, headers);
  let report = await api<HabitReport>(path + '?year=' + today.slice(0, 4));
  check(
    report.checkins.filter((e) => e.date === today).length === 1,
    'Repeated taps produce one record per habit/day',
  );
  const note = '=Private test note';
  await api(endpoint, 'PATCH', { notes: note }, headers);
  const off = await api<HabitCheckin>(endpoint, 'PATCH', { completed: false }, headers);
  check(off.notes === note && !off.completed, 'Unticking retains extra notes');
  const editedNote = await api<HabitCheckin>(
    endpoint,
    'PATCH',
    { notes: note + ' amended' },
    headers,
  );
  check(!editedNote.completed, 'Saving notes never changes the toggle');
  await api(endpoint, 'PATCH', { completed: true }, headers);
  await api(path, 'PATCH', { ...input, name: 'Renamed commitment' });
  report = await api<HabitReport>(path + '?year=' + today.slice(0, 4));
  check(
    report.habit.name === 'Renamed commitment' && report.checkins[0].notes.endsWith('amended'),
    'Editing a habit preserves its check-in history',
  );
  check(
    (await raw(path, 'PATCH', { ...input, startDate: addDays(today, 1) })).status === 409,
    'Date edits cannot exclude existing notes',
  );
  await api(path, 'PATCH', { archived: true });
  check(
    (await raw(endpoint, 'PATCH', { completed: true }, headers)).status === 409,
    'Archived habits cannot receive daily submissions',
  );
  report = await api<HabitReport>(path);
  check(
    report.habit.archived && report.checkins.length === 1,
    'Archive preserves the full daily record',
  );
  await api(path, 'PATCH', { archived: false });
  await api(endpoint, 'PATCH', { completed: true }, headers);
  const upcoming = await api<Habit>('/api/habits', 'POST', {
    ...input,
    startDate: addDays(today, 1),
  });
  created.push(upcoming.id);
  check(
    (await raw(`/api/habits/${upcoming.id}/checkin`, 'PATCH', { completed: true }, headers))
      .status === 409,
    'Future commitments cannot be marked early',
  );
  const ended = await api<Habit>('/api/habits', 'POST', { ...input, endDate: yesterday });
  created.push(ended.id);
  check(
    (await raw(`/api/habits/${ended.id}/checkin`, 'PATCH', { completed: true }, headers)).status ===
      409,
    'Finished commitments cannot receive new daily submissions',
  );
  assert.match(habit.id, /^[a-zA-Z0-9-]+$/);
  localSql(
    `INSERT INTO habit_checkins (id,user_id,habit_id,date,completed,notes,updated_at) VALUES ('${crypto.randomUUID()}','development-demo','${habit.id}','${yesterday}',1,'Previous day fixture','2026-09-25T00:00:00Z')`,
  );
  state = await api<AppState>('/api/state');
  check(
    state.habits.habits.find((h) => h.id === habit.id)?.followedDays === 1,
    'Long-term totals include past days and exclude pending today',
  );
  check(
    state.habits.checkins.some((e) => e.habitId === habit.id && e.date === today && e.completed),
    'Dashboard receives today’s confirmed check-in',
  );
  const exported = await api<{ habits: { habits: Habit[]; checkins: HabitCheckin[] } }>(
    '/api/export',
  );
  check(
    exported.habits.checkins.some((e) => e.habitId === habit.id && e.notes === note + ' amended'),
    'JSON exports contain private habit notes',
  );
  const csv = await (await raw('/api/export?collection=habits')).text();
  check(csv.includes("'=Private test note amended"), 'Habit CSV neutralizes spreadsheet formulas');
  const otherExport = await api<{ habits: { checkins: HabitCheckin[] } }>(
    '/api/export',
    'GET',
    undefined,
    { cookie: otherCookie },
  );
  check(
    !otherExport.habits.checkins.some((e) => e.habitId === habit.id),
    'Exports never leak another user’s habit notes',
  );
  console.log(`\n${passed} habit integration assertions passed on local Workers + D1.`);
} finally {
  for (const id of created) {
    assert.match(id, /^[a-zA-Z0-9-]+$/);
    localSql(`DELETE FROM habits WHERE id='${id}' AND user_id='development-demo'`);
  }
}
