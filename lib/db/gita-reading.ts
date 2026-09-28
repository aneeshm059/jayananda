import { and, eq, sql } from 'drizzle-orm';
import { database } from './client';
import { companionEntries, reading } from './schema';
import { getSettings } from './repository';
import { HttpError } from '../http';
import { localDate } from '../domain/dates';
import {
  compareGitaPositions,
  gitaLabel,
  gitaRangeLabel,
  gitaReadingActionSchema,
  gitaReadingProgressSchema,
  nextGitaPosition,
  suggestedGitaStart,
  type GitaReadingAction,
  type GitaReadingProgress,
  type GitaReadingResponse,
} from '../domain/gita-reading';

const key = 'reading:bg' as const;
const bookTitle = 'Bhagavad-gītā As It Is';
const conflict = () =>
  new HttpError(
    409,
    'Your reading place changed on another device or tab. Reload it before continuing.',
  );

export async function getGitaReading(userId: string): Promise<GitaReadingResponse> {
  const [row] = await database()
    .select()
    .from(companionEntries)
    .where(and(eq(companionEntries.userId, userId), eq(companionEntries.key, key)));
  if (row)
    return {
      progress: gitaReadingProgressSchema.parse(JSON.parse(row.value)),
      version: row.version,
    };
  const [book] = await database()
    .select({ value: companionEntries.value })
    .from(companionEntries)
    .where(and(eq(companionEntries.userId, userId), eq(companionEntries.key, 'book')));
  return {
    progress: null,
    version: 0,
    ...(book ? { suggestedStart: suggestedGitaStart(JSON.parse(book.value)) } : {}),
  };
}

async function ownedJournalEntry(userId: string, id: string) {
  const [entry] = await database()
    .select({
      id: reading.id,
      book: reading.book,
      verseRange: reading.verseRange,
      durationMinutes: reading.durationMinutes,
      reflection: reading.reflection,
    })
    .from(reading)
    .where(and(eq(reading.userId, userId), eq(reading.id, id)));
  return entry;
}

type FinishAction = Extract<GitaReadingAction, { action: 'finish' }>;
async function finishedReplay(
  userId: string,
  input: FinishAction,
): Promise<GitaReadingResponse | undefined> {
  const entry = await ownedJournalEntry(userId, input.sessionId);
  if (!entry) return;
  const recordedEnd = entry.verseRange?.split('–').at(-1);
  if (
    entry.book !== bookTitle ||
    recordedEnd !== gitaLabel(input.end) ||
    entry.durationMinutes !== input.durationMinutes ||
    (entry.reflection ?? '') !== input.note
  )
    throw new HttpError(
      409,
      'This reading session has already been recorded with different details. Reload your reading place and review the journal entry.',
    );
  return { ...(await getGitaReading(userId)), journalId: entry.id };
}

export async function saveGitaReading(
  userId: string,
  rawInput: unknown,
  clock = new Date(),
): Promise<GitaReadingResponse> {
  const input = gitaReadingActionSchema.parse(rawInput);
  if (input.action === 'finish') {
    const replay = await finishedReplay(userId, input);
    if (replay) return replay;
  }
  const current = await getGitaReading(userId);
  const { progress, version } = current;
  const now = clock.toISOString();
  const db = database();

  if (input.action === 'start') {
    // The start request ID becomes the session/journal ID. Repeating a completed
    // start cannot silently create a fresh session, even after later sessions.
    const recorded = await ownedJournalEntry(userId, input.requestId);
    if (recorded) return { ...current, journalId: recorded.id };
    if (progress?.lastFinished?.sessionId === input.requestId) return current;
    if (progress?.session) {
      if (input.start && compareGitaPositions(input.start, progress.session.start) !== 0)
        throw new HttpError(
          409,
          'Finish the reading session already in progress before choosing another starting verse.',
        );
      return current;
    }
    if (input.version !== version) throw conflict();
    if (progress?.completed && !input.start)
      throw new HttpError(
        409,
        'You have reached the end of this book. Choose a starting verse explicitly to read it again.',
      );
    const start = input.start ?? progress?.cursor ?? { chapter: 1, verse: 1 };
    const settings = await getSettings(userId);
    const next: GitaReadingProgress = {
      bookId: 'bg',
      cursor: start,
      completed: false,
      session: {
        id: input.requestId,
        start,
        date: localDate(settings.timezone, clock),
        startedAt: now,
      },
      updatedAt: now,
      lastFinished: progress?.lastFinished ?? null,
    };
    const update = { value: JSON.stringify(next), version: version + 1, updatedAt: now };
    const rows =
      version === 0
        ? await db
            .insert(companionEntries)
            .values({ id: crypto.randomUUID(), userId, key, ...update })
            .onConflictDoNothing({ target: [companionEntries.userId, companionEntries.key] })
            .returning({ version: companionEntries.version })
        : await db
            .update(companionEntries)
            .set(update)
            .where(
              and(
                eq(companionEntries.userId, userId),
                eq(companionEntries.key, key),
                eq(companionEntries.version, version),
              ),
            )
            .returning({ version: companionEntries.version });
    if (!rows.length) {
      const latest = await getGitaReading(userId);
      if (latest.progress?.session?.id === input.requestId) return latest;
      throw conflict();
    }
    return { progress: next, version: version + 1 };
  }

  if (input.version !== version) throw conflict();
  const session = progress?.session;
  if (!progress || !session || session.id !== input.sessionId)
    throw new HttpError(409, 'This reading session is no longer active. Reload your saved place.');
  if (compareGitaPositions(input.end, session.start) < 0)
    throw new HttpError(400, 'The last verse read must be at or after the starting verse.');
  const cursor = nextGitaPosition(input.end);
  const next: GitaReadingProgress = {
    ...progress,
    cursor,
    completed: cursor === null,
    session: null,
    updatedAt: now,
    lastFinished: {
      sessionId: session.id,
      requestId: input.requestId,
      end: input.end,
      finishedAt: now,
    },
  };
  const advance = db
    .update(companionEntries)
    .set({ value: JSON.stringify(next), version: version + 1, updatedAt: now })
    .where(
      and(
        eq(companionEntries.userId, userId),
        eq(companionEntries.key, key),
        eq(companionEntries.version, version),
      ),
    )
    .returning({ version: companionEntries.version });
  // INSERT ... SELECT is guarded by the exact operation that won the version
  // update. D1 batch commits both statements or rolls both back on an error.
  const report = db
    .insert(reading)
    .select(
      db
        .select({
          id: sql<string>`${session.id}`.as('id'),
          userId: sql<string>`${userId}`.as('userId'),
          date: sql<string>`${session.date}`.as('date'),
          createdAt: sql<string>`${now}`.as('createdAt'),
          updatedAt: sql<string>`${now}`.as('updatedAt'),
          book: sql<string>`${bookTitle}`.as('book'),
          chapter:
            sql<string>`${session.start.chapter === input.end.chapter ? String(session.start.chapter) : `${session.start.chapter}–${input.end.chapter}`}`.as(
              'chapter',
            ),
          section: sql<string>`'Sequential reading'`.as('section'),
          pages: sql<number>`0`.as('pages'),
          durationMinutes: sql<number>`${input.durationMinutes}`.as('durationMinutes'),
          verseRange: sql<string>`${gitaRangeLabel(session.start, input.end)}`.as('verseRange'),
          reflection: sql<string>`${input.note}`.as('reflection'),
          isPrabhupada: sql<boolean>`1`.as('isPrabhupada'),
        })
        .from(companionEntries)
        .where(
          and(
            eq(companionEntries.userId, userId),
            eq(companionEntries.key, key),
            eq(companionEntries.version, version + 1),
            sql`json_extract(${companionEntries.value}, '$.lastFinished.sessionId') = ${session.id}`,
            sql`json_extract(${companionEntries.value}, '$.lastFinished.requestId') = ${input.requestId}`,
          ),
        ),
    )
    .returning({ id: reading.id });
  try {
    const [advanced, recorded] = await db.batch([advance, report]);
    if (advanced.length && recorded.length)
      return { progress: next, version: version + 1, journalId: session.id };
  } catch (error) {
    // A concurrent identical retry may hit the journal ID's unique constraint;
    // only an already committed, matching entry can turn that into success.
    const replay = await finishedReplay(userId, input);
    if (replay) return replay;
    throw error;
  }
  const replay = await finishedReplay(userId, input);
  if (replay) return replay;
  throw conflict();
}
