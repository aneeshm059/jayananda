import { z } from 'zod';
import { dateSchema } from './validation';
import { gitaReadingProgressSchema } from './gita-reading';

export const companionKeys = [
  'book',
  'instruction',
  'rhythm',
  'japa-draft',
  'course:soulful-japa',
  'course:happiness-pleasure',
  'course:prabhupada',
  'reading:bg',
] as const;
export type CompanionKey = (typeof companionKeys)[number];
export const companionKeySchema = z.enum(companionKeys);

const time = z.union([z.literal(''), z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)]);
const timestamp = z.iso.datetime();
const bookHosts = new Set(['prabhupadabooks.com', 'www.prabhupadabooks.com']);
const sourceHosts = new Set([
  ...bookHosts,
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'youtu.be',
]);

function trustedUrl(hosts: Set<string>) {
  return z
    .string()
    .max(2000)
    .refine((value) => {
      if (value === '') return true;
      try {
        const url = new URL(value);
        return (
          url.protocol === 'https:' &&
          hosts.has(url.hostname) &&
          !url.username &&
          !url.password &&
          (!url.port || url.port === '443')
        );
      } catch {
        return false;
      }
    }, 'Use an HTTPS link to the original source.');
}

export const bookBookmarkSchema = z.strictObject({
  bookId: z.string().min(1).max(100),
  location: z.string().max(300),
  url: trustedUrl(bookHosts),
  note: z.string().max(10000),
  updatedAt: timestamp,
});
export type BookBookmark = z.infer<typeof bookBookmarkSchema>;

export const savedInstructionSchema = z.strictObject({
  text: z.string().max(10000),
  source: z.string().max(300),
  sourceUrl: trustedUrl(sourceHosts),
});
export type SavedInstruction = z.infer<typeof savedInstructionSchema>;

const videoId = z.string().regex(/^[A-Za-z0-9_-]{11}$/);
const seconds = z.number().finite().min(0).max(86400);
const lessonSchema = z.strictObject({
  position: seconds,
  duration: seconds,
  completed: z.boolean(),
});
export const courseProgressSchema = z.strictObject({
  currentVideoId: z.union([z.literal(''), videoId]),
  lessons: z.record(videoId, lessonSchema).refine((value) => Object.keys(value).length <= 500),
  watchedByDay: z.record(dateSchema, seconds).refine((value) => Object.keys(value).length <= 2000),
  reminderTime: time,
  lastPracticedDate: z.union([z.literal(''), dateSchema]),
});
export type CourseProgress = z.infer<typeof courseProgressSchema>;

export const rhythmSchema = z.strictObject({
  japaTime: time,
  readingTime: time,
  hearingTime: time,
});
export type Rhythm = z.infer<typeof rhythmSchema>;

export const japaDraftSchema = z.strictObject({
  rounds: z.number().int().min(0).max(192),
  elapsedSeconds: seconds,
  startedAt: z.union([z.literal(''), timestamp]),
  pausedAt: z.union([z.literal(''), timestamp]),
  running: z.boolean(),
  date: dateSchema,
  note: z.string().max(10000),
  sessionId: z.string().min(1).max(100),
});
export type JapaDraft = z.infer<typeof japaDraftSchema>;

const valueSchemas = {
  book: bookBookmarkSchema.nullable(),
  instruction: savedInstructionSchema.nullable(),
  rhythm: rhythmSchema,
  'japa-draft': japaDraftSchema.nullable(),
  'course:soulful-japa': courseProgressSchema,
  'course:happiness-pleasure': courseProgressSchema,
  'course:prabhupada': courseProgressSchema,
  'reading:bg': gitaReadingProgressSchema,
} as const;

export function parseCompanionValue(key: CompanionKey, value: unknown): unknown {
  const parsed = valueSchemas[key].parse(value);
  // Leave space for the surrounding request object inside the HTTP body's 64 KiB limit.
  z.custom(
    (value) => new TextEncoder().encode(JSON.stringify(value)).byteLength <= 60000,
    'This saved item is too long.',
  ).parse(parsed);
  return parsed;
}

export const companionWriteSchema = z.strictObject({
  key: companionKeySchema.refine(
    (key) => key !== 'reading:bg',
    'Use the sequential reading flow to update this progress.',
  ),
  value: z.unknown(),
  version: z
    .number()
    .int()
    .min(0)
    .max(Number.MAX_SAFE_INTEGER - 1),
});
export type CompanionItem = { key: CompanionKey; value: unknown; version: number };
