import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import { drizzle } from 'drizzle-orm/sqlite-proxy';
import { defaultSettings } from '../lib/domain/model';
import { companionWriteSchema } from '../lib/domain/companion';
import {
  gitaPositionSchema,
  gitaReadingActionSchema,
  gitaUrl,
  gitaVerseCounts,
  nextGitaPosition,
  suggestedGitaStart,
} from '../lib/domain/gita-reading';

const { getDatabase } = vi.hoisted(() => ({ getDatabase: vi.fn() }));
vi.mock('../lib/db/client', () => ({ database: getDatabase }));
vi.mock('../lib/auth', () => ({ auth: vi.fn() }));
import { getGitaReading, saveGitaReading } from '../lib/db/gita-reading';

describe('Prabhupada Books Gita positions', () => {
  it('uses the verified 1972 chapter numbering and finishes without wrapping', () => {
    expect(gitaVerseCounts.reduce((total, count) => total + count, 0)).toBe(700);
    expect(gitaPositionSchema.safeParse({ chapter: 1, verse: 47 }).success).toBe(false);
    expect(gitaPositionSchema.parse({ chapter: 13, verse: 35 })).toEqual({
      chapter: 13,
      verse: 35,
    });
    expect(nextGitaPosition({ chapter: 1, verse: 46 })).toEqual({ chapter: 2, verse: 1 });
    expect(nextGitaPosition({ chapter: 18, verse: 78 })).toBe(null);
  });
  it('opens the real grouped-verse page without assuming all of it was read', () => {
    expect(gitaUrl({ chapter: 1, verse: 17 })).toBe('https://prabhupadabooks.com/bg/1/16-18');
    expect(gitaUrl({ chapter: 13, verse: 2 })).toBe('https://prabhupadabooks.com/bg/13/1-2');
    expect(gitaUrl({ chapter: 18, verse: 52 })).toBe('https://prabhupadabooks.com/bg/18/51-53');
    expect(nextGitaPosition({ chapter: 1, verse: 17 })).toEqual({ chapter: 1, verse: 18 });
    expect(gitaUrl({ chapter: 2, verse: 9 })).toBe('https://prabhupadabooks.com/bg/2/9');
  });
  it('suggests a valid old bookmark without claiming it was completed', () => {
    expect(suggestedGitaStart({ bookId: 'bg', url: 'https://prabhupadabooks.com/bg/2/9' })).toEqual(
      { chapter: 2, verse: 9 },
    );
    expect(suggestedGitaStart({ bookId: 'bg', location: 'Chapter 2, verse 9' })).toEqual({
      chapter: 2,
      verse: 9,
    });
    expect(suggestedGitaStart({ bookId: 'sb', location: '2:9' })).toBeUndefined();
    expect(
      suggestedGitaStart({ bookId: 'bg', url: 'https://attacker.example/bg/2/9' }),
    ).toBeUndefined();
  });
  it('rejects ownership/date injection and generic progress bypass', () => {
    const finish = {
      action: 'finish',
      version: 1,
      requestId: crypto.randomUUID(),
      sessionId: crypto.randomUUID(),
      end: { chapter: 2, verse: 10 },
    };
    expect(gitaReadingActionSchema.safeParse({ ...finish, date: '2026-01-01' }).success).toBe(
      false,
    );
    expect(gitaReadingActionSchema.safeParse({ ...finish, userId: 'other' }).success).toBe(false);
    expect(gitaReadingActionSchema.safeParse({ ...finish, durationMinutes: 1441 }).success).toBe(
      false,
    );
    expect(
      companionWriteSchema.safeParse({ key: 'reading:bg', version: 0, value: {} }).success,
    ).toBe(false);
  });
});

describe('atomic Gita reading journal and next verse', () => {
  let sqlite: DatabaseSync;
  let failJournal: boolean;
  const startClock = new Date('2026-09-28T18:29:00Z');
  beforeEach(() => {
    failJournal = false;
    sqlite = new DatabaseSync(':memory:');
    sqlite.exec('PRAGMA foreign_keys = ON');
    for (const file of readdirSync('migrations')
      .filter((name) => name.endsWith('.sql'))
      .sort())
      sqlite.exec(readFileSync(`migrations/${file}`, 'utf8'));
    const insert = sqlite.prepare(
      'INSERT INTO users (id,name,email,email_verified,created_at,updated_at) VALUES (?,?,?,0,0,0)',
    );
    for (const id of ['alice', 'bob']) {
      insert.run(id, id, `${id}@example.test`);
      sqlite
        .prepare('INSERT INTO user_settings(user_id,value,updated_at) VALUES (?,?,?)')
        .run(
          id,
          JSON.stringify({ ...defaultSettings, timezone: 'Asia/Kolkata' }),
          startClock.toISOString(),
        );
    }
    const execute = (query: string, params: unknown[], method: string) => {
      if (failJournal && query.startsWith('insert into "reading_sessions"'))
        throw new Error('Simulated journal write failure');
      const statement = sqlite.prepare(query);
      if (method === 'run') {
        statement.run(...(params as (string | number | null)[]));
        return { rows: [] };
      }
      return {
        rows: statement
          .all(...(params as (string | number | null)[]))
          .map((row) => Object.values(row)),
      };
    };
    getDatabase.mockReturnValue(
      drizzle(
        async (query, params, method) => execute(query, params, method),
        async (batch) => {
          sqlite.exec('BEGIN');
          try {
            const results = batch.map(({ sql, params, method }) => execute(sql, params, method));
            sqlite.exec('COMMIT');
            return results;
          } catch (error) {
            sqlite.exec('ROLLBACK');
            throw error;
          }
        },
      ),
    );
  });
  afterEach(() => sqlite.close());
  const start = (
    userId = 'alice',
    position = { chapter: 2, verse: 9 },
    version = 0,
    requestId = crypto.randomUUID(),
  ) =>
    saveGitaReading(userId, { action: 'start', version, requestId, start: position }, startClock);
  const journal = () => sqlite.prepare('SELECT * FROM reading_sessions').all();

  it('captures the selected starting verse and account-local day before reading', async () => {
    const result = await start();
    expect(result.version).toBe(1);
    expect(result.progress?.session).toMatchObject({
      start: { chapter: 2, verse: 9 },
      date: '2026-09-28',
    });
    expect(result.progress?.cursor).toEqual({ chapter: 2, verse: 9 });
    expect(journal()).toHaveLength(0);
  });
  it('records 2:9–2:10 and advances to 2:11 atomically, keeping the captured date across midnight', async () => {
    const opened = await start();
    const result = await saveGitaReading(
      'alice',
      {
        action: 'finish',
        version: opened.version,
        requestId: crypto.randomUUID(),
        sessionId: opened.progress!.session!.id,
        end: { chapter: 2, verse: 10 },
        durationMinutes: 15,
        note: 'My reflection',
      },
      new Date('2026-09-28T18:45:00Z'),
    );
    expect(result.progress?.cursor).toEqual({ chapter: 2, verse: 11 });
    expect(result.progress?.session).toBe(null);
    expect(result.version).toBe(2);
    expect(journal()).toMatchObject([
      {
        id: result.journalId,
        date: '2026-09-28',
        book: 'Bhagavad-gītā As It Is',
        chapter: '2',
        verse_range: '2:9–2:10',
        duration_minutes: 15,
        reflection: 'My reflection',
      },
    ]);
  });
  it('rolls back the next verse if the journal insertion fails', async () => {
    const opened = await start();
    failJournal = true;
    await expect(
      saveGitaReading('alice', {
        action: 'finish',
        version: 1,
        requestId: crypto.randomUUID(),
        sessionId: opened.progress!.session!.id,
        end: { chapter: 2, verse: 10 },
      }),
    ).rejects.toThrow();
    expect(await getGitaReading('alice')).toEqual(opened);
    expect(journal()).toHaveLength(0);
  });
  it('allows safe start/finish retries without duplicate records or repeated advancement', async () => {
    const startId = crypto.randomUUID();
    const opened = await start('alice', { chapter: 2, verse: 9 }, 0, startId);
    expect(await start('alice', { chapter: 2, verse: 9 }, 0, startId)).toEqual(opened);
    const input = {
      action: 'finish',
      version: 1,
      requestId: crypto.randomUUID(),
      sessionId: startId,
      end: { chapter: 2, verse: 10 },
    };
    const finished = await saveGitaReading('alice', input);
    expect(await saveGitaReading('alice', input)).toEqual(finished);
    expect(journal()).toHaveLength(1);
    expect((await start('alice', { chapter: 2, verse: 9 }, 0, startId)).progress?.session).toBe(
      null,
    );
  });
  it('resumes an active session, while rejecting a changed start, reversed end, or stale finish', async () => {
    const opened = await start();
    expect(
      await saveGitaReading('alice', {
        action: 'start',
        version: 0,
        requestId: crypto.randomUUID(),
      }),
    ).toEqual(opened);
    await expect(start('alice', { chapter: 3, verse: 1 }, 1)).rejects.toMatchObject({
      status: 409,
    });
    const input = {
      action: 'finish',
      version: 1,
      requestId: crypto.randomUUID(),
      sessionId: opened.progress!.session!.id,
      end: { chapter: 2, verse: 8 },
    };
    await expect(saveGitaReading('alice', input)).rejects.toMatchObject({ status: 400 });
    await expect(
      saveGitaReading('alice', { ...input, version: 0, end: { chapter: 2, verse: 10 } }),
    ).rejects.toMatchObject({ status: 409 });
    expect(journal()).toHaveLength(0);
  });
  it('keeps user state isolated and cannot finish another account’s session', async () => {
    const opened = await start();
    expect(await getGitaReading('bob')).toEqual({ progress: null, version: 0 });
    await expect(
      saveGitaReading('bob', {
        action: 'finish',
        version: 0,
        requestId: crypto.randomUUID(),
        sessionId: opened.progress!.session!.id,
        end: { chapter: 2, verse: 10 },
      }),
    ).rejects.toMatchObject({ status: 409 });
    await start('bob', { chapter: 1, verse: 1 });
    expect((await getGitaReading('alice')).progress?.cursor).toEqual({ chapter: 2, verse: 9 });
  });
  it('commits only one of two concurrent different finish ranges', async () => {
    const opened = await start();
    const common = { action: 'finish', version: 1, sessionId: opened.progress!.session!.id };
    const results = await Promise.allSettled([
      saveGitaReading('alice', {
        ...common,
        requestId: crypto.randomUUID(),
        end: { chapter: 2, verse: 10 },
      }),
      saveGitaReading('alice', {
        ...common,
        requestId: crypto.randomUUID(),
        end: { chapter: 2, verse: 11 },
      }),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    expect(journal()).toHaveLength(1);
    expect((await getGitaReading('alice')).version).toBe(2);
  });
  it('treats concurrent identical finish retries as a single committed result', async () => {
    const opened = await start();
    const input = {
      action: 'finish',
      version: 1,
      sessionId: opened.progress!.session!.id,
      requestId: crypto.randomUUID(),
      end: { chapter: 2, verse: 10 },
    };
    const results = await Promise.all([
      saveGitaReading('alice', input),
      saveGitaReading('alice', input),
    ]);
    expect(results[0]).toEqual(results[1]);
    expect(journal()).toHaveLength(1);
  });
  it('supports cross-chapter ranges and a final verse with no automatic restart', async () => {
    const opened = await start('alice', { chapter: 17, verse: 28 });
    const finished = await saveGitaReading('alice', {
      action: 'finish',
      version: 1,
      sessionId: opened.progress!.session!.id,
      requestId: crypto.randomUUID(),
      end: { chapter: 18, verse: 78 },
    });
    expect(finished.progress).toMatchObject({ cursor: null, completed: true, session: null });
    expect(journal()).toMatchObject([{ chapter: '17–18', verse_range: '17:28–18:78' }]);
    await expect(
      saveGitaReading('alice', { action: 'start', version: 2, requestId: crypto.randomUUID() }),
    ).rejects.toMatchObject({ status: 409 });
  });
  it('does not resurrect a journal entry that the user deliberately deleted', async () => {
    const opened = await start();
    const input = {
      action: 'finish',
      version: 1,
      sessionId: opened.progress!.session!.id,
      requestId: crypto.randomUUID(),
      end: { chapter: 2, verse: 10 },
    };
    await saveGitaReading('alice', input);
    sqlite
      .prepare('DELETE FROM reading_sessions WHERE id=? AND user_id=?')
      .run(input.sessionId, 'alice');
    await expect(saveGitaReading('alice', input)).rejects.toMatchObject({ status: 409 });
    expect(journal()).toHaveLength(0);
    expect((await getGitaReading('alice')).progress?.cursor).toEqual({ chapter: 2, verse: 11 });
  });
});
