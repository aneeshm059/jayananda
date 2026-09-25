import { and, eq, gte, lte, sql, asc } from 'drizzle-orm';
import { database } from './client';
import { habits, habitCheckins } from './schema';
import {
  habitSchema,
  habitCheckinSchema,
  starterHabits,
  oneYearEnd,
  habitStatus,
  type Habit,
  type HabitBundle,
} from '../domain/habits';
import { addDays } from '../domain/dates';
import { HttpError } from '../http';

const checkinColumns = {
  habitId: habitCheckins.habitId,
  date: habitCheckins.date,
  completed: habitCheckins.completed,
  notes: habitCheckins.notes,
  updatedAt: habitCheckins.updatedAt,
};
export async function ensureStarterHabits(userId: string, today: string) {
  const now = new Date().toISOString();
  await database()
    .insert(habits)
    .values(
      starterHabits.map((h) => ({
        id: crypto.randomUUID(),
        userId,
        name: h.name,
        intention: h.intention,
        starterKey: h.key,
        startDate: today,
        endDate: oneYearEnd(today),
        createdAt: now,
        updatedAt: now,
      })),
    )
    .onConflictDoNothing({ target: [habits.userId, habits.starterKey] });
}
export async function ownedHabit(userId: string, id: string) {
  const [habit] = await database()
    .select()
    .from(habits)
    .where(and(eq(habits.userId, userId), eq(habits.id, id)));
  if (!habit) throw new HttpError(404, 'This habit could not be found.');
  return habit;
}
export async function listHabits(userId: string, today: string): Promise<Habit[]> {
  const rows = await database()
    .select({
      habit: habits,
      followedDays: sql<number>`count(${habitCheckins.id})`.mapWith(Number),
    })
    .from(habits)
    .leftJoin(
      habitCheckins,
      and(
        eq(habitCheckins.habitId, habits.id),
        eq(habitCheckins.userId, userId),
        eq(habitCheckins.completed, true),
        gte(habitCheckins.date, habits.startDate),
        lte(habitCheckins.date, habits.endDate),
        lte(habitCheckins.date, addDays(today, -1)),
      ),
    )
    .where(eq(habits.userId, userId))
    .groupBy(habits.id)
    .orderBy(asc(habits.createdAt), asc(habits.name));
  return rows.map(({ habit: { userId: _owner, ...habit }, followedDays }) => ({
    ...habit,
    followedDays,
  }));
}
export async function checkins(userId: string, from?: string, to?: string, habitId?: string) {
  return database()
    .select(checkinColumns)
    .from(habitCheckins)
    .where(
      and(
        eq(habitCheckins.userId, userId),
        from ? gte(habitCheckins.date, from) : undefined,
        to ? lte(habitCheckins.date, to) : undefined,
        habitId ? eq(habitCheckins.habitId, habitId) : undefined,
      ),
    )
    .orderBy(asc(habitCheckins.date));
}
export async function habitBundle(userId: string, today: string): Promise<HabitBundle> {
  const [all, recent] = await Promise.all([
    listHabits(userId, today),
    checkins(userId, addDays(today, -6), today),
  ]);
  return { habits: all, checkins: recent };
}
export async function saveHabit(userId: string, input: unknown, id?: string) {
  const data = habitSchema.parse(input),
    db = database(),
    now = new Date().toISOString();
  if (id) {
    await ownedHabit(userId, id);
    // Date changes must not silently place existing notes outside the commitment.
    const outside = await db
      .select({ id: habitCheckins.id })
      .from(habitCheckins)
      .where(
        and(
          eq(habitCheckins.userId, userId),
          eq(habitCheckins.habitId, id),
          sql`(${habitCheckins.date} < ${data.startDate} OR ${habitCheckins.date} > ${data.endDate})`,
        ),
      )
      .limit(1);
    if (outside.length)
      throw new HttpError(
        409,
        'Keep the dates of your existing check-ins within this habit. You can archive it and start a new commitment.',
      );
    const [row] = await db
      .update(habits)
      .set({ ...data, updatedAt: now })
      .where(and(eq(habits.userId, userId), eq(habits.id, id)))
      .returning();
    const { userId: _owner, ...habit } = row;
    return habit;
  }
  const [row] = await db
    .insert(habits)
    .values({ id: crypto.randomUUID(), userId, ...data, createdAt: now, updatedAt: now })
    .returning();
  const { userId: _owner, ...habit } = row;
  return habit;
}
export async function archiveHabit(userId: string, id: string, archived: boolean) {
  await ownedHabit(userId, id);
  await database()
    .update(habits)
    .set({ archived, updatedAt: new Date().toISOString() })
    .where(and(eq(habits.userId, userId), eq(habits.id, id)));
}
export async function saveCheckin(userId: string, id: string, today: string, input: unknown) {
  const data = habitCheckinSchema.parse(input);
  const habit = await ownedHabit(userId, id);
  if (habitStatus(habit, today) !== 'Active')
    throw new HttpError(
      409,
      'This habit is not active today. Check its start and end dates or restore it from your archive.',
    );
  const now = new Date().toISOString();
  // Patch only supplied fields: a toggle never overwrites notes, or vice versa.
  const [row] = await database()
    .insert(habitCheckins)
    .values({
      id: crypto.randomUUID(),
      userId,
      habitId: id,
      date: today,
      completed: data.completed ?? false,
      notes: data.notes ?? '',
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [habitCheckins.habitId, habitCheckins.date],
      set: { ...data, updatedAt: now },
    })
    .returning(checkinColumns);
  return row;
}
