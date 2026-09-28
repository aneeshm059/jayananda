import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import { drizzle } from 'drizzle-orm/sqlite-proxy';
import {
  companionWriteSchema,
  parseCompanionValue,
  type BookBookmark,
  type CourseProgress,
} from '../lib/domain/companion';

const { getDatabase } = vi.hoisted(() => ({ getDatabase: vi.fn() }));
vi.mock('../lib/db/client', () => ({ database: getDatabase }));
vi.mock('../lib/auth', () => ({ auth: vi.fn() }));
import { companionItems, saveCompanionItem } from '../lib/db/companion';

const bookmark: BookBookmark = {
  bookId: 'bg',
  location: 'Chapter 2, verse 13',
  url: 'https://prabhupadabooks.com/bg/2/13',
  note: 'Remember this passage.',
  updatedAt: '2026-09-28T10:00:00.000Z',
};
const progress: CourseProgress = {
  currentVideoId: 'abcdefghijk',
  lessons: { abcdefghijk: { position: 1800, duration: 3600, completed: false } },
  watchedByDay: { '2026-09-28': 1800 },
  reminderTime: '19:30',
  lastPracticedDate: '2026-09-28',
};

describe('companion boundaries', () => {
  it('preserves an unfinished lesson and independently recorded daily watch time', () => {
    expect(parseCompanionValue('course:soulful-japa', progress)).toEqual(progress);
  });
  it('accepts physical-book bookmarks and explicit resets', () => {
    expect(
      parseCompanionValue('book', { ...bookmark, url: '', note: '', location: '' }),
    ).toMatchObject({ url: '' });
    expect(parseCompanionValue('book', null)).toBe(null);
    expect(parseCompanionValue('instruction', null)).toBe(null);
    expect(parseCompanionValue('japa-draft', null)).toBe(null);
  });
  it.each([
    'javascript:alert(1)',
    'http://prabhupadabooks.com/bg',
    'https://prabhupadabooks.com.attacker.example/bg',
    'https://prabhupadabooks.com@attacker.example/bg',
    'https://user:pass@prabhupadabooks.com/bg',
    'https://prabhupadabooks.com:444/bg',
  ])('rejects an untrusted reading link: %s', (url) => {
    expect(() => parseCompanionValue('book', { ...bookmark, url })).toThrow();
  });
  it('accepts source links only on supported source hosts', () => {
    expect(
      parseCompanionValue('instruction', {
        text: 'My own takeaway',
        source: 'Lesson 1',
        sourceUrl: 'https://www.youtube.com/watch?v=abcdefghijk',
      }),
    ).toMatchObject({ source: 'Lesson 1' });
    expect(() =>
      parseCompanionValue('instruction', {
        text: 'A takeaway',
        source: 'Unknown',
        sourceUrl: 'https://attacker.example',
      }),
    ).toThrow();
  });
  it('rejects impossible dates, durations, and malformed lesson identities', () => {
    expect(() =>
      parseCompanionValue('course:soulful-japa', {
        ...progress,
        watchedByDay: { '2026-02-30': 1800 },
      }),
    ).toThrow();
    expect(() =>
      parseCompanionValue('course:soulful-japa', {
        ...progress,
        lessons: { abcdefghijk: { position: -5, duration: Infinity, completed: false } },
      }),
    ).toThrow();
    expect(() =>
      parseCompanionValue('course:soulful-japa', {
        ...progress,
        currentVideoId: '../arbitrary-id',
      }),
    ).toThrow();
  });
  it('rejects unknown keys, unbounded data, and submitted ownership', () => {
    expect(companionWriteSchema.safeParse({ key: 'users', value: {}, version: 0 }).success).toBe(
      false,
    );
    expect(
      companionWriteSchema.safeParse({ key: 'book', value: bookmark, version: 0, userId: 'other' })
        .success,
    ).toBe(false);
    expect(() => parseCompanionValue('book', { ...bookmark, note: 'x'.repeat(10001) })).toThrow();
    expect(() =>
      parseCompanionValue('course:prabhupada', {
        ...progress,
        lessons: Object.fromEntries(
          Array.from({ length: 501 }, (_, i) => [
            String(i).padStart(11, '0'),
            { position: 0, duration: 0, completed: false },
          ]),
        ),
      }),
    ).toThrow();
  });
  it('preserves a resumable japa draft and rejects unknown timer fields', () => {
    const draft = {
      rounds: 4,
      elapsedSeconds: 2400,
      startedAt: '2026-09-28T10:00:00.000Z',
      pausedAt: '',
      running: true,
      date: '2026-09-28',
      note: '',
      sessionId: 'session-one',
    };
    expect(parseCompanionValue('japa-draft', draft)).toEqual(draft);
    expect(() => parseCompanionValue('japa-draft', { ...draft, userId: 'other' })).toThrow();
  });
});

describe('companion persistence and isolation', () => {
  let sqlite: DatabaseSync;
  beforeEach(() => {
    sqlite = new DatabaseSync(':memory:');
    sqlite.exec('PRAGMA foreign_keys = ON');
    for (const migration of readdirSync('migrations')
      .filter((file) => file.endsWith('.sql'))
      .sort())
      sqlite.exec(readFileSync(`migrations/${migration}`, 'utf8'));
    const insert = sqlite.prepare(
      'INSERT INTO users (id, name, email, email_verified, created_at, updated_at) VALUES (?, ?, ?, 0, 0, 0)',
    );
    for (const id of ['alice', 'bob']) insert.run(id, id, `${id}@example.test`);
    getDatabase.mockReturnValue(
      drizzle(async (query, params, method) => {
        const statement = sqlite.prepare(query);
        if (method === 'run') {
          statement.run(...params);
          return { rows: [] };
        }
        return { rows: statement.all(...params).map((row) => Object.values(row)) };
      }),
    );
  });
  afterEach(() => sqlite.close());

  it('stores independent bookmarks per user and never lists another account', async () => {
    await saveCompanionItem('alice', { key: 'book', value: bookmark, version: 0 });
    await saveCompanionItem('bob', {
      key: 'book',
      value: { ...bookmark, note: 'Bob only' },
      version: 0,
    });
    expect(await companionItems('alice')).toEqual([{ key: 'book', value: bookmark, version: 1 }]);
    expect(await companionItems('bob')).toEqual([
      { key: 'book', value: { ...bookmark, note: 'Bob only' }, version: 1 },
    ]);
  });
  it('rejects stale and racing creates without overwriting a saved item', async () => {
    const results = await Promise.allSettled([
      saveCompanionItem('alice', { key: 'book', value: bookmark, version: 0 }),
      saveCompanionItem('alice', {
        key: 'book',
        value: { ...bookmark, note: 'Stale' },
        version: 0,
      }),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    const failure = results.find((result) => result.status === 'rejected');
    expect(failure?.status === 'rejected' && failure.reason.status).toBe(409);
    expect((await companionItems('alice'))[0].version).toBe(1);
  });
  it('allows exactly one update of a known version and preserves other course progress', async () => {
    await saveCompanionItem('alice', { key: 'course:soulful-japa', value: progress, version: 0 });
    await saveCompanionItem('alice', {
      key: 'course:happiness-pleasure',
      value: progress,
      version: 0,
    });
    const next = {
      ...progress,
      lessons: { abcdefghijk: { position: 2400, duration: 3600, completed: false } },
    };
    expect(
      await saveCompanionItem('alice', { key: 'course:soulful-japa', value: next, version: 1 }),
    ).toMatchObject({ version: 2 });
    await expect(
      saveCompanionItem('alice', { key: 'course:soulful-japa', value: progress, version: 1 }),
    ).rejects.toMatchObject({ status: 409 });
    expect(await companionItems('alice')).toEqual(
      expect.arrayContaining([
        { key: 'course:soulful-japa', value: next, version: 2 },
        { key: 'course:happiness-pleasure', value: progress, version: 1 },
      ]),
    );
  });
  it('cannot use another user’s version to create or mutate an entry', async () => {
    await saveCompanionItem('alice', { key: 'book', value: bookmark, version: 0 });
    await expect(
      saveCompanionItem('bob', { key: 'book', value: bookmark, version: 1 }),
    ).rejects.toMatchObject({ status: 409 });
    expect(await companionItems('bob')).toEqual([]);
  });
  it('clearing a draft preserves version history so an old tab cannot restore it', async () => {
    await saveCompanionItem('alice', { key: 'book', value: bookmark, version: 0 });
    await saveCompanionItem('alice', { key: 'book', value: null, version: 1 });
    await expect(
      saveCompanionItem('alice', { key: 'book', value: bookmark, version: 1 }),
    ).rejects.toMatchObject({ status: 409 });
    expect(await companionItems('alice')).toEqual([{ key: 'book', value: null, version: 2 }]);
  });
});
