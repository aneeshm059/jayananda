import { writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { hashPassword } from 'better-auth/crypto';
import { defaultSettings, qualities } from '../lib/domain/model';
import { localDate, addDays } from '../lib/domain/dates';
// Deliberately local-only. There is no production/remote flag or database URL input.
if (process.argv.some((a) => /remote|production/.test(a)))
  throw new Error('Demo seeding is local-only.');
const uid = 'development-demo',
  second = 'development-other',
  password = 'Local-Journal-Only-2026!';
const q = (value: unknown): string =>
  value == null
    ? 'NULL'
    : typeof value === 'number'
      ? String(value)
      : typeof value === 'boolean'
        ? value
          ? '1'
          : '0'
        : "'" + String(value).replaceAll("'", "''") + "'";
const sql: string[] = [`DELETE FROM users WHERE id IN (${q(uid)},${q(second)});`];
const now = new Date().toISOString(),
  epoch = Date.now();
function insert(table: string, data: Record<string, unknown>) {
  sql.push(
    `INSERT INTO ${table} (${Object.keys(data).join(',')}) VALUES (${Object.values(data).map(q).join(',')});`,
  );
}
if (!process.argv.includes('--clear')) {
  for (const [id, email, name] of [
    [uid, 'demo@example.test', 'Aneesh'],
    [second, 'other@example.test', 'Isolation test'],
  ]) {
    insert('users', { id, email, name, email_verified: 0, created_at: epoch, updated_at: epoch });
    insert('accounts', {
      id: id + '-credential',
      account_id: id,
      provider_id: 'credential',
      user_id: id,
      password: await hashPassword(password),
      created_at: epoch,
      updated_at: epoch,
    });
    insert('user_settings', {
      user_id: id,
      value: JSON.stringify({ ...defaultSettings, name, onboarded: true }),
      updated_at: now,
    });
  }
  const today = localDate('Asia/Kolkata');
  for (let i = 13; i >= 0; i--) {
    const date = addDays(today, -i),
      base = { user_id: uid, date, created_at: date + 'T06:00:00.000Z', updated_at: now };
    const rounds = [12, 16, 16, 8, 14, 16, 10, 16, 12, 16, 8, 16, 14, 8][13 - i];
    insert('daily_sadhana', {
      ...base,
      id: 'demo-day-' + i,
      mode: i % 5 === 0 ? 'minimum' : 'ideal',
      closed: i > 0 && i % 4 !== 0,
    });
    insert('wake_records', {
      ...base,
      id: 'demo-wake-' + i,
      actual_time: ['05:00', '05:12', '06:20', '04:50', '07:30'][i % 5],
      sleep_time: '22:15',
      program_completed: i % 3 !== 0,
      bath_completed: true,
      phone_discipline: i % 4 ? 'Yes' : 'Partially',
      practices: 'Personal prayer',
    });
    insert('japa_sessions', {
      ...base,
      id: 'demo-japa-' + i,
      rounds,
      duration_minutes: rounds * 7,
      start_time: i % 3 ? '05:30' : '07:15',
      end_time: i % 3 ? '07:00' : '09:00',
      attention: 2 + (i % 4),
      interruptions: i % 3,
      prayerful_mood: 3 + (i % 3),
      helped: i % 2 ? 'I kept the phone in another room.' : 'A quiet place helped me listen.',
    });
    if (i % 4 !== 0)
      insert('hearing_sessions', {
        ...base,
        id: 'demo-hearing-' + i,
        speaker: 'Śrīla Prabhupāda',
        title: 'Morning hearing · development sample',
        type: 'Lecture',
        duration_minutes: 20 + i * 2,
        is_prabhupada: true,
        instruction:
          'Make time to hear attentively. (Personal sample reflection, not a quotation.)',
      });
    if (i % 3 !== 0)
      insert('reading_sessions', {
        ...base,
        id: 'demo-reading-' + i,
        book: i % 2 ? 'Bhagavad-gītā As It Is' : 'Śrīmad-Bhāgavatam',
        chapter: 'Chapter 2',
        pages: 3 + (i % 8),
        duration_minutes: 10 + i,
        is_prabhupada: true,
        reflection: 'I want to carry one instruction into my day.',
      });
    if (i > 0 && i % 4 !== 0)
      insert('krishna_book_sessions', {
        ...base,
        id: 'demo-krishna-' + i,
        start_time: '21:00',
        end_time: '21:22',
        duration_minutes: 15 + i,
        chapter_number: 25 + Math.floor((13 - i) / 3),
        chapter_title: '',
        start_page: 100 + (13 - i) * 5,
        end_page: 104 + (13 - i) * 5,
        pages_read: 5,
        chapter_completed: i % 3 === 0,
        reflection: 'A peaceful moment before sleep.',
      });
    if (i % 2 === 1)
      insert('seva_entries', {
        ...base,
        id: 'demo-seva-' + i,
        service: i % 3 ? 'Helped with temple preparations' : 'Edited a devotional video',
        category: i % 3 ? 'Temple' : 'ISKCON Media',
        duration_minutes: 30 + i * 3,
        attitude: 'Willing Service',
        appreciation: 'Sometimes',
        reflection: 'I can offer the service without waiting for appreciation.',
      });
    if (i % 4 === 1)
      insert('association_entries', {
        ...base,
        id: 'demo-association-' + i,
        person: 'Devotees at the temple',
        type: 'Discussion',
        duration_minutes: 35,
        learned: 'The value of showing up consistently.',
      });
    if (i > 0 && i % 4 !== 0)
      insert('night_reflections', {
        ...base,
        id: 'demo-reflection-' + i,
        best: 'A few attentive rounds in the morning.',
        grateful: 'The opportunity to begin again.',
        prayer: 'Please help me serve with a little more attention.',
        remembrance: 'Sometimes',
      });
  }
  for (let i = 0; i < qualities.length; i++)
    sql.push(
      `INSERT OR IGNORE INTO jayananda_qualities (id,name,description,verified) VALUES (${q('quality-' + i)},${q(qualities[i])},'Personal reflection theme; verified source content has not been added.',0);`,
    );
  insert('japa_sessions', {
    id: 'other-private-entry',
    user_id: second,
    date: today,
    created_at: now,
    updated_at: now,
    rounds: 3,
    duration_minutes: 21,
  });
}
mkdirSync('.local', { recursive: true });
writeFileSync('.local/seed.sql', 'PRAGMA foreign_keys = ON;\n' + sql.join('\n'), { mode: 0o600 });
execFileSync('npx', ['wrangler', 'd1', 'execute', 'DB', '--local', '--file', '.local/seed.sql'], {
  stdio: 'pipe',
});
if (!process.argv.includes('--clear'))
  writeFileSync(
    '.local/demo-login.txt',
    `LOCAL DEVELOPMENT ONLY\nEmail: demo@example.test\nPassword: ${password}\n`,
    { mode: 0o600 },
  );
console.log(
  process.argv.includes('--clear')
    ? 'Development accounts and sample data removed from local D1.'
    : '14 sample days added to local D1. Credentials: .local/demo-login.txt',
);
