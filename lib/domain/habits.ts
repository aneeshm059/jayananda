import { z } from 'zod';
import { dateSchema } from './validation';
import { addDays, daysBetween } from './dates';

export interface Habit {
  id: string;
  name: string;
  intention: string;
  startDate: string;
  endDate: string;
  archived: boolean;
  starterKey: string | null;
  createdAt: string;
  updatedAt: string;
  followedDays: number;
}
export interface HabitCheckin {
  habitId: string;
  date: string;
  completed: boolean;
  notes: string;
  updatedAt: string;
}
export interface HabitBundle {
  habits: Habit[];
  checkins: HabitCheckin[];
}
export interface HabitReport {
  habit: Habit;
  checkins: HabitCheckin[];
  year: number;
  today: string;
}
const habitDateSchema = dateSchema.refine((date) => date >= '1900-01-01' && date <= '9998-12-31', {
  message: 'Choose a date between 1900 and 9998.',
});
export const habitSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    intention: z.string().trim().min(1).max(2000),
    startDate: habitDateSchema,
    endDate: habitDateSchema,
  })
  .strict()
  .refine((v) => v.endDate >= v.startDate, {
    message: 'End date must be on or after the start date.',
    path: ['endDate'],
  });
export type HabitInput = z.infer<typeof habitSchema>;
export const habitCheckinSchema = z
  .object({
    completed: z.boolean().optional(),
    notes: z.string().trim().max(10000).optional(),
  })
  .strict()
  .refine(
    (v) => v.completed !== undefined || v.notes !== undefined,
    'Choose a toggle or add notes.',
  );
export type HabitCheckinInput = z.infer<typeof habitCheckinSchema>;
export const starterHabits = [
  {
    key: 'brahmacharya',
    name: 'Brahmacharya',
    intention: 'Follow my personal commitment to brahmacharya today.',
  },
  {
    key: 'soulful-japa',
    name: 'Soulful Japa',
    intention: 'Chant with care and attention, returning my mind to hearing the Holy Name.',
  },
  {
    key: 'social-media',
    name: 'Away from Social Media',
    intention: 'Protect my attention by avoiding unnecessary social-media browsing.',
  },
] as const;
export function oneYearEnd(start: string): string {
  const year = Number(start.slice(0, 4)) + 1;
  const anniversary = `${year}${start.slice(4)}`;
  // A leap-day commitment lasts through February 28 in the following year.
  return dateSchema.safeParse(anniversary).success ? addDays(anniversary, -1) : `${year}-02-28`;
}
export function habitStatus(
  habit: Pick<Habit, 'archived' | 'startDate' | 'endDate'>,
  today: string,
) {
  return habit.archived
    ? 'Archived'
    : today < habit.startDate
      ? 'Upcoming'
      : today > habit.endDate
        ? 'Finished'
        : 'Active';
}
export function calendarDayCount(from: string, to: string): number {
  if (to < from) return 0;
  return (
    Math.round((Date.parse(to + 'T12:00:00Z') - Date.parse(from + 'T12:00:00Z')) / 86400000) + 1
  );
}
export function elapsedHabitDays(
  habit: Pick<Habit, 'startDate' | 'endDate'>,
  today: string,
): number {
  const yesterday = addDays(today, -1);
  return calendarDayCount(habit.startDate, habit.endDate < yesterday ? habit.endDate : yesterday);
}
export function habitMonthSummary(
  habit: Pick<Habit, 'startDate' | 'endDate'>,
  checkins: HabitCheckin[],
  from: string,
  to: string,
  today: string,
) {
  const begin = from > habit.startDate ? from : habit.startDate;
  const end = [to, habit.endDate, addDays(today, -1)].sort()[0];
  const days = calendarDayCount(begin, end);
  const followed = new Set(
    checkins.filter((e) => e.completed && e.date >= begin && e.date <= end).map((e) => e.date),
  ).size;
  return { days, followed, percent: days ? Math.round((followed / days) * 100) : null };
}
export function recentHabitDays(today: string) {
  return daysBetween(addDays(today, -6), today);
}
