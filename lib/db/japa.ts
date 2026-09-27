import { and, eq, sql } from 'drizzle-orm';
import { database } from './client';
import { japa } from './schema';
import { decrementJapaSchema } from '../domain/japa';
import { HttpError } from '../http';

export async function decrementJapa(userId: string, input: unknown) {
  const data = decrementJapaSchema.parse(input);
  const db = database();
  // Compare-and-set prevents retries or two open tabs from subtracting twice.
  const updatedAt = new Date(
    Math.max(Date.now(), Date.parse(data.expectedUpdatedAt) + 1),
  ).toISOString();
  const [saved] = await db
    .update(japa)
    .set({ rounds: sql`${japa.rounds} - 1`, updatedAt })
    .where(
      and(
        eq(japa.userId, userId),
        eq(japa.id, data.id),
        eq(japa.date, data.date),
        eq(japa.rounds, data.expectedRounds),
        eq(japa.updatedAt, data.expectedUpdatedAt),
      ),
    )
    .returning();
  if (!saved) {
    const [existing] = await db
      .select({ id: japa.id })
      .from(japa)
      .where(and(eq(japa.userId, userId), eq(japa.id, data.id), eq(japa.date, data.date)));
    throw new HttpError(
      existing ? 409 : 404,
      existing
        ? 'Your count changed. Check the refreshed total before trying again.'
        : 'This Japa session is no longer available. Refresh your journal.',
    );
  }
  const { userId: _owner, ...entry } = saved;
  return entry;
}
