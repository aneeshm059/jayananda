import { z } from 'zod';
import { dateSchema } from './validation';

// Verified against each chapter index at https://prabhupadabooks.com/bg on 2026-09-28.
// This site's 1972 edition numbers chapter 1 through 46 and chapter 13 through 35.
export const gitaVerseCounts = [
  46, 72, 43, 42, 29, 47, 30, 28, 34, 42, 55, 20, 35, 27, 20, 24, 28, 78,
] as const;
const groupedVerses: Record<number, readonly (readonly [number, number])[]> = {
  1: [
    [16, 18],
    [21, 22],
    [32, 35],
    [37, 38],
  ],
  2: [[42, 43]],
  5: [
    [8, 9],
    [27, 28],
  ],
  6: [
    [11, 12],
    [13, 14],
    [20, 23],
  ],
  10: [
    [4, 5],
    [12, 13],
  ],
  11: [
    [10, 11],
    [26, 27],
    [41, 42],
  ],
  12: [
    [3, 4],
    [6, 7],
    [13, 14],
    [18, 19],
  ],
  13: [
    [1, 2],
    [6, 7],
    [8, 12],
  ],
  14: [[22, 25]],
  15: [[3, 4]],
  16: [
    [1, 3],
    [11, 12],
    [13, 15],
  ],
  17: [
    [5, 6],
    [8, 10],
    [26, 27],
  ],
  18: [
    [13, 14],
    [36, 37],
    [51, 53],
  ],
};
export const gitaPositionSchema = z
  .strictObject({
    chapter: z.number().int().min(1).max(18),
    verse: z.number().int().min(1).max(78),
  })
  .refine(
    ({ chapter, verse }) => verse <= gitaVerseCounts[chapter - 1],
    'Choose a verse in this chapter.',
  );
export type GitaPosition = z.infer<typeof gitaPositionSchema>;
export function gitaLabel(position: GitaPosition) {
  return `${position.chapter}:${position.verse}`;
}
export function compareGitaPositions(a: GitaPosition, b: GitaPosition) {
  return a.chapter - b.chapter || a.verse - b.verse;
}
export function gitaRangeLabel(start: GitaPosition, end: GitaPosition) {
  return compareGitaPositions(start, end) === 0
    ? gitaLabel(start)
    : `${gitaLabel(start)}–${gitaLabel(end)}`;
}
export function gitaUrl(input: GitaPosition): string {
  const position = gitaPositionSchema.parse(input);
  const group = groupedVerses[position.chapter]?.find(
    ([start, end]) => position.verse >= start && position.verse <= end,
  );
  return `https://prabhupadabooks.com/bg/${position.chapter}/${group ? group.join('-') : position.verse}`;
}
export function nextGitaPosition(input: GitaPosition): GitaPosition | null {
  const { chapter, verse } = gitaPositionSchema.parse(input);
  if (verse < gitaVerseCounts[chapter - 1]) return { chapter, verse: verse + 1 };
  return chapter < 18 ? { chapter: chapter + 1, verse: 1 } : null;
}

export const gitaReadingSessionSchema = z.strictObject({
  id: z.uuid(),
  start: gitaPositionSchema,
  date: dateSchema,
  startedAt: z.iso.datetime(),
});
export const gitaReadingProgressSchema = z
  .strictObject({
    bookId: z.literal('bg'),
    cursor: gitaPositionSchema.nullable(),
    completed: z.boolean(),
    session: gitaReadingSessionSchema.nullable(),
    updatedAt: z.iso.datetime(),
    lastFinished: z
      .strictObject({
        sessionId: z.uuid(),
        requestId: z.uuid(),
        end: gitaPositionSchema,
        finishedAt: z.iso.datetime(),
      })
      .nullable(),
  })
  .refine(
    (value) => value.completed === (value.cursor === null),
    'Completion and next verse must agree.',
  )
  .refine(
    (value) =>
      !value.session ||
      (value.cursor && compareGitaPositions(value.cursor, value.session.start) === 0),
    'An active session must match its saved starting place.',
  );
export type GitaReadingProgress = z.infer<typeof gitaReadingProgressSchema>;
export type GitaReadingResponse = {
  progress: GitaReadingProgress | null;
  version: number;
  journalId?: string;
  suggestedStart?: GitaPosition;
};

const version = z
  .number()
  .int()
  .min(0)
  .max(Number.MAX_SAFE_INTEGER - 1);
export const gitaReadingActionSchema = z.discriminatedUnion('action', [
  z.strictObject({
    action: z.literal('start'),
    version,
    requestId: z.uuid(),
    start: gitaPositionSchema.optional(),
  }),
  z.strictObject({
    action: z.literal('finish'),
    version,
    requestId: z.uuid(),
    sessionId: z.uuid(),
    end: gitaPositionSchema,
    durationMinutes: z.number().finite().min(0).max(1440).default(0),
    note: z.string().max(10000).default(''),
  }),
]);
export type GitaReadingAction = z.infer<typeof gitaReadingActionSchema>;

// A legacy bookmark is only a suggestion for where to start, never evidence of reading.
export function suggestedGitaStart(book: unknown): GitaPosition | undefined {
  if (!book || typeof book !== 'object' || !('bookId' in book) || book.bookId !== 'bg') return;
  if ('url' in book && typeof book.url === 'string') {
    try {
      const url = new URL(book.url);
      const match = url.pathname.match(/^\/bg\/(\d+)\/(\d+)(?:-\d+)?\/?$/);
      if (
        url.protocol === 'https:' &&
        ['prabhupadabooks.com', 'www.prabhupadabooks.com'].includes(url.hostname) &&
        match
      ) {
        const parsed = gitaPositionSchema.safeParse({
          chapter: Number(match[1]),
          verse: Number(match[2]),
        });
        if (parsed.success) return parsed.data;
      }
    } catch {
      /* A handwritten location may still contain a valid verse reference. */
    }
  }
  if ('location' in book && typeof book.location === 'string') {
    const match = book.location.match(/(?:chapter\s*)?(\d+)\s*(?:[:.]|,?\s+verse\s+)\s*(\d+)/i);
    if (match) {
      const parsed = gitaPositionSchema.safeParse({
        chapter: Number(match[1]),
        verse: Number(match[2]),
      });
      if (parsed.success) return parsed.data;
    }
  }
}
