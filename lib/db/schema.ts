import {
  sqliteTable,
  text,
  integer,
  real,
  index,
  uniqueIndex,
  check,
} from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: integer('email_verified', { mode: 'boolean' }).notNull().default(false),
  image: text('image'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
});
export const session = sqliteTable(
  'sessions',
  {
    id: text('id').primaryKey(),
    expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
    token: text('token').notNull().unique(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
  },
  (t) => [index('session_user_idx').on(t.userId)],
);
export const account = sqliteTable(
  'accounts',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: integer('access_token_expires_at', { mode: 'timestamp_ms' }),
    refreshTokenExpiresAt: integer('refresh_token_expires_at', { mode: 'timestamp_ms' }),
    scope: text('scope'),
    password: text('password'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (t) => [index('account_user_idx').on(t.userId)],
);
export const verification = sqliteTable(
  'verifications',
  {
    id: text('id').primaryKey(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }),
  },
  (t) => [index('verification_identifier_idx').on(t.identifier)],
);
export const rateLimit = sqliteTable('rate_limits', {
  id: text('id').primaryKey(),
  key: text('key').notNull().unique(),
  count: integer('count').notNull(),
  lastRequest: integer('last_request').notNull(),
});
export const userSettings = sqliteTable('user_settings', {
  userId: text('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  value: text('value').notNull(),
  updatedAt: text('updated_at').notNull(),
});
export const appPreferences = sqliteTable('app_preferences', {
  userId: text('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  theme: text('theme').notNull().default('light'),
  hero: text('hero').notNull().default('auto'),
});
const base = () => ({
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  date: text('date').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});
export const daily = sqliteTable(
  'daily_sadhana',
  {
    ...base(),
    mode: text('mode').notNull().default('ideal'),
    closed: integer('closed', { mode: 'boolean' }).notNull().default(false),
  },
  (t) => [uniqueIndex('daily_user_date').on(t.userId, t.date)],
);
export const wake = sqliteTable(
  'wake_records',
  {
    ...base(),
    actualTime: text('actual_time'),
    sleepTime: text('sleep_time'),
    bathCompleted: integer('bath_completed', { mode: 'boolean' }).default(false),
    programCompleted: integer('program_completed', { mode: 'boolean' }).default(false),
    practices: text('practices').notNull().default(''),
    phoneDiscipline: text('phone_discipline').default('Yes'),
  },
  (t) => [uniqueIndex('wake_user_date').on(t.userId, t.date)],
);
export const japa = sqliteTable(
  'japa_sessions',
  {
    ...base(),
    rounds: integer('rounds').notNull(),
    durationMinutes: real('duration_minutes').notNull().default(0),
    startTime: text('start_time'),
    endTime: text('end_time'),
    location: text('location'),
    attention: integer('attention'),
    interruptions: integer('interruptions').default(0),
    prayerfulMood: integer('prayerful_mood'),
    distractions: text('distractions'),
    helped: text('helped'),
    improve: text('improve'),
  },
  (t) => [
    index('japa_user_date').on(t.userId, t.date),
    check('japa_rounds_valid', sql`${t.rounds} >= 0`),
    check('japa_attention_valid', sql`${t.attention} BETWEEN 1 AND 5`),
    check('japa_duration_valid', sql`${t.durationMinutes} >= 0`),
  ],
);
export const hearing = sqliteTable(
  'hearing_sessions',
  {
    ...base(),
    speaker: text('speaker').notNull(),
    title: text('title').notNull(),
    type: text('type').notNull(),
    durationMinutes: real('duration_minutes').notNull(),
    url: text('url'),
    instruction: text('instruction'),
    isPrabhupada: integer('is_prabhupada', { mode: 'boolean' }).notNull().default(true),
  },
  (t) => [
    index('hearing_user_date').on(t.userId, t.date),
    index('hearing_user_type').on(t.userId, t.type),
    check('hearing_duration_valid', sql`${t.durationMinutes} >= 0`),
  ],
);
export const reading = sqliteTable(
  'reading_sessions',
  {
    ...base(),
    book: text('book').notNull(),
    chapter: text('chapter'),
    section: text('section'),
    pages: integer('pages').notNull().default(0),
    durationMinutes: real('duration_minutes').notNull(),
    verseRange: text('verse_range'),
    reflection: text('reflection'),
    isPrabhupada: integer('is_prabhupada', { mode: 'boolean' }).notNull().default(true),
  },
  (t) => [
    index('reading_user_date').on(t.userId, t.date),
    check('reading_duration_valid', sql`${t.durationMinutes} >= 0`),
    check('reading_pages_valid', sql`${t.pages} >= 0`),
  ],
);
export const krishna = sqliteTable(
  'krishna_book_sessions',
  {
    ...base(),
    startTime: text('start_time'),
    endTime: text('end_time'),
    durationMinutes: real('duration_minutes').notNull(),
    chapterNumber: integer('chapter_number'),
    chapterTitle: text('chapter_title'),
    startPage: integer('start_page'),
    endPage: integer('end_page'),
    pagesRead: integer('pages_read').notNull().default(0),
    chapterCompleted: integer('chapter_completed', { mode: 'boolean' }).notNull().default(false),
    reflection: text('reflection'),
  },
  (t) => [
    index('krishna_user_date').on(t.userId, t.date),
    check('krishna_pages_order', sql`${t.endPage} >= ${t.startPage}`),
    check('krishna_duration_valid', sql`${t.durationMinutes} >= 0`),
  ],
);
export const seva = sqliteTable(
  'seva_entries',
  {
    ...base(),
    service: text('service').notNull(),
    category: text('category').notNull(),
    durationMinutes: real('duration_minutes').default(0),
    attitude: text('attitude').notNull(),
    appreciation: text('appreciation'),
    reflection: text('reflection'),
  },
  (t) => [index('seva_user_date').on(t.userId, t.date)],
);
export const association = sqliteTable(
  'association_entries',
  {
    ...base(),
    person: text('person').notNull(),
    type: text('type').notNull(),
    durationMinutes: real('duration_minutes').notNull(),
    learned: text('learned'),
  },
  (t) => [index('association_user_date').on(t.userId, t.date)],
);
export const reflection = sqliteTable(
  'night_reflections',
  {
    ...base(),
    best: text('best'),
    careless: text('careless'),
    distraction: text('distraction'),
    avoid: text('avoid'),
    grateful: text('grateful'),
    prayer: text('prayer'),
    remembrance: text('remembrance').notNull().default('Sometimes'),
  },
  (t) => [uniqueIndex('reflection_user_date').on(t.userId, t.date)],
);
export const sankalpa = sqliteTable(
  'daily_sankalpas',
  { ...base(), text: text('text').notNull() },
  (t) => [uniqueIndex('sankalpa_user_date').on(t.userId, t.date)],
);
export const weekly = sqliteTable(
  'weekly_reviews',
  {
    ...base(),
    helped: text('helped'),
    weakened: text('weakened'),
    distractions: text('distractions'),
    improvement: text('improvement'),
    quality: text('quality'),
    sankalpa: text('sankalpa'),
  },
  (t) => [uniqueIndex('weekly_user_date').on(t.userId, t.date)],
);
export const monthly = sqliteTable(
  'monthly_reviews',
  {
    ...base(),
    realization: text('realization'),
    obstacle: text('obstacle'),
    strengthened: text('strengthened'),
    weakened: text('weakened'),
    quality: text('quality'),
    prayer: text('prayer'),
    sankalpa: text('sankalpa'),
  },
  (t) => [uniqueIndex('monthly_user_date').on(t.userId, t.date)],
);
export const jayanandaQualities = sqliteTable('jayananda_qualities', {
  id: text('id').primaryKey(),
  name: text('name').notNull().unique(),
  description: text('description'),
  source: text('source'),
  verified: integer('verified', { mode: 'boolean' }).notNull().default(false),
});
export const quality = sqliteTable(
  'quality_reflections',
  { ...base(), quality: text('quality').notNull(), reflection: text('reflection').notNull() },
  (t) => [index('quality_user_date').on(t.userId, t.date)],
);
export const prabhupada = sqliteTable(
  'prabhupada_reflections',
  {
    ...base(),
    instruction: text('instruction'),
    reflection: text('reflection'),
    prayer: text('prayer'),
  },
  (t) => [uniqueIndex('prabhupada_user_date').on(t.userId, t.date)],
);
export const purpose = sqliteTable(
  'personal_purpose',
  { ...base(), text: text('text').notNull() },
  (t) => [uniqueIndex('purpose_user').on(t.userId)],
);
export const goals = sqliteTable(
  'goals',
  {
    ...base(),
    title: text('title').notNull(),
    targetDate: text('target_date'),
    completed: integer('completed', { mode: 'boolean' }).notNull().default(false),
  },
  (t) => [index('goals_user_date').on(t.userId, t.date)],
);
export const reminders = sqliteTable(
  'reminders',
  {
    ...base(),
    message: text('message').notNull(),
    time: text('time').notNull(),
    enabled: integer('enabled', { mode: 'boolean' }).notNull().default(false),
  },
  (t) => [index('reminders_user_date').on(t.userId, t.date)],
);
export const tables = {
  daily,
  wake,
  japa,
  hearing,
  reading,
  krishna,
  seva,
  association,
  reflection,
  sankalpa,
  weekly,
  monthly,
  quality,
  prabhupada,
  purpose,
  goals,
  reminders,
};

export const habits = sqliteTable(
  'habits',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    intention: text('intention').notNull(),
    startDate: text('start_date').notNull(),
    endDate: text('end_date').notNull(),
    archived: integer('archived', { mode: 'boolean' }).notNull().default(false),
    starterKey: text('starter_key'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => [
    index('habits_user_dates').on(t.userId, t.startDate, t.endDate),
    uniqueIndex('habits_user_starter').on(t.userId, t.starterKey),
    check('habit_dates_order', sql`${t.endDate} >= ${t.startDate}`),
  ],
);
export const habitCheckins = sqliteTable(
  'habit_checkins',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    habitId: text('habit_id')
      .notNull()
      .references(() => habits.id, { onDelete: 'cascade' }),
    date: text('date').notNull(),
    completed: integer('completed', { mode: 'boolean' }).notNull().default(false),
    notes: text('notes').notNull().default(''),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => [
    uniqueIndex('habit_checkin_day').on(t.habitId, t.date),
    index('habit_checkin_user_date').on(t.userId, t.date),
    check('habit_completed_boolean', sql`${t.completed} IN (0, 1)`),
  ],
);
