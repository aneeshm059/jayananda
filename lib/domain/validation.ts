import { z } from 'zod';
import { morningOptions, qualities } from './model';
export const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((v) => {
    const d = new Date(v + 'T12:00:00Z');
    return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
  }, 'Use a valid calendar date.');
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  optionalTime = time.nullable().optional();
const text = z.string().trim().max(10000).default(''),
  title = z.string().trim().min(1).max(300),
  minutes = z.number().min(0).max(1440),
  count = z.number().int().min(0).max(10000),
  rating = z.number().int().min(1).max(5).nullable().optional();
const base = { date: dateSchema };
export const schemas = {
  daily: z.object({
    ...base,
    mode: z.enum(['ideal', 'minimum']),
    closed: z.boolean().default(false),
  }),
  wake: z.object({
    ...base,
    actualTime: optionalTime,
    sleepTime: optionalTime,
    bathCompleted: z.boolean().default(false),
    programCompleted: z.boolean().default(false),
    practices: z.string().max(2000).default(''),
    phoneDiscipline: z.enum(['Yes', 'Partially', 'No']).default('Yes'),
  }),
  japa: z.object({
    ...base,
    rounds: count.max(192),
    durationMinutes: minutes.default(0),
    startTime: optionalTime,
    endTime: optionalTime,
    location: text,
    attention: rating,
    interruptions: count.max(100).default(0),
    prayerfulMood: rating,
    distractions: text,
    helped: text,
    improve: text,
  }),
  hearing: z.object({
    ...base,
    speaker: title.default('Śrīla Prabhupāda'),
    title,
    type: z
      .enum([
        'Lecture',
        'Bhagavad-gītā',
        'Śrīmad-Bhāgavatam',
        'Conversation',
        'Morning Walk',
        'Festival Lecture',
        'Other',
      ])
      .default('Lecture'),
    durationMinutes: minutes,
    url: z.union([z.literal(''), z.url().refine((v) => /^https?:/.test(v))]).default(''),
    instruction: text,
    isPrabhupada: z.boolean().default(true),
  }),
  reading: z.object({
    ...base,
    book: title,
    chapter: text,
    section: text,
    pages: count.default(0),
    durationMinutes: minutes,
    verseRange: text,
    reflection: text,
    isPrabhupada: z.boolean().default(true),
  }),
  krishna: z
    .object({
      ...base,
      startTime: optionalTime,
      endTime: optionalTime,
      durationMinutes: minutes,
      chapterNumber: count.max(1000).nullable().optional(),
      chapterTitle: text,
      startPage: count.nullable().optional(),
      endPage: count.nullable().optional(),
      pagesRead: count.default(0),
      chapterCompleted: z.boolean().default(false),
      reflection: text,
    })
    .refine((v) => v.startPage == null || v.endPage == null || v.endPage >= v.startPage, {
      message: 'End page must follow start page.',
      path: ['endPage'],
    }),
  seva: z.object({
    ...base,
    service: title,
    category: z
      .enum([
        'Temple',
        'ISKCON Media',
        'Devotee Service',
        'Family Service',
        'Book Distribution',
        'Festival Service',
        'Outreach',
        'Cleaning',
        'Cooking',
        'Other',
      ])
      .default('Temple'),
    durationMinutes: minutes.default(0),
    attitude: z
      .enum(['Duty', 'Willing Service', 'Enthusiastic Service', 'Grateful Service'])
      .default('Willing Service'),
    appreciation: z.enum(['Yes', 'Sometimes', 'No']).default('No'),
    reflection: text,
  }),
  association: z.object({
    ...base,
    person: title,
    type: z
      .enum([
        'Sunday Satsang',
        'Temple Program',
        'Personal Association',
        'Bhāgavatam Class',
        'Kirtan',
        'Discussion',
        'Festival',
        'Other',
      ])
      .default('Personal Association'),
    durationMinutes: minutes,
    learned: text,
  }),
  reflection: z.object({
    ...base,
    best: text,
    careless: text,
    distraction: text,
    avoid: text,
    grateful: text,
    prayer: text,
    remembrance: z
      .enum(['Rarely', 'Sometimes', 'Frequently', 'Very Frequently'])
      .default('Sometimes'),
  }),
  sankalpa: z.object({ ...base, text: z.string().trim().min(1).max(2000) }),
  weekly: z.object({
    ...base,
    helped: text,
    weakened: text,
    distractions: text,
    improvement: text,
    quality: text,
    sankalpa: text,
  }),
  monthly: z.object({
    ...base,
    realization: text,
    obstacle: text,
    strengthened: text,
    weakened: text,
    quality: text,
    prayer: text,
    sankalpa: text,
  }),
  quality: z.object({ ...base, quality: title, reflection: z.string().trim().min(1).max(10000) }),
  prabhupada: z.object({ ...base, instruction: text, reflection: text, prayer: text }),
  purpose: z.object({ ...base, text: z.string().trim().min(1).max(10000) }),
  goals: z.object({
    ...base,
    title,
    targetDate: dateSchema.nullable().optional(),
    completed: z.boolean().default(false),
  }),
  reminders: z.object({ ...base, message: title, time, enabled: z.boolean().default(false) }),
};
const targets = z.object({
    japa: z.number().int().min(1).max(192),
    hearing: minutes,
    reading: minutes,
    krishna: minutes,
    morning: z.boolean(),
    seva: z.boolean(),
    reflection: z.boolean(),
    wake: z.boolean(),
  }),
  weight = z.number().min(0).max(100);
export const settingsSchema = z.object({
  name: title.max(80),
  timezone: z.string().refine((v) => {
    try {
      new Intl.DateTimeFormat('en', { timeZone: v });
      return true;
    } catch {
      return false;
    }
  }, 'Use an IANA timezone, for example Asia/Kolkata.'),
  appName: title.max(40),
  subtitle: title.max(80),
  wakeTarget: time,
  sleepTarget: time,
  workStart: time,
  eveningStart: time,
  ideal: targets,
  minimum: targets,
  weights: z
    .object({
      morning: weight,
      japa: weight,
      quality: weight,
      hearing: weight,
      reading: weight,
      krishna: weight,
      seva: weight,
      reflection: weight,
      association: weight,
    })
    .refine((v) => Object.values(v).some((n) => n > 0), 'At least one weight must be positive.'),
  morningProgram: z.array(z.enum(morningOptions)).max(6),
  theme: z.enum(['light', 'dark', 'system']),
  hero: z.enum(['auto', 'morning', 'minimal', 'none']),
  quality: z.enum(qualities),
  onboarded: z.boolean(),
});
