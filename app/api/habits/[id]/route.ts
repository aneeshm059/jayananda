import { z } from 'zod';
import { authorize, body, checkOrigin, json, safe } from '@/lib/http';
import { getSettings } from '@/lib/db/repository';
import { localDate } from '@/lib/domain/dates';
import { ownedHabit, listHabits, checkins, saveHabit, archiveHabit } from '@/lib/db/habits';
type Context = { params: Promise<{ id: string }> };
export const GET = (request: Request, context: Context) =>
  safe(async () => {
    const user = await authorize(request),
      { id } = await context.params;
    await ownedHabit(user.id, id);
    const today = localDate((await getSettings(user.id)).timezone);
    const year = z.coerce
      .number()
      .int()
      .min(1900)
      .max(9998)
      .parse(new URL(request.url).searchParams.get('year') ?? today.slice(0, 4));
    const all = await listHabits(user.id, today);
    return json({
      habit: all.find((h) => h.id === id),
      checkins: await checkins(user.id, `${year}-01-01`, `${year}-12-31`, id),
      year,
      today,
    });
  });
export const PATCH = (request: Request, context: Context) =>
  safe(async () => {
    checkOrigin(request);
    const user = await authorize(request),
      { id } = await context.params;
    const input = await body(request);
    if (input && typeof input === 'object' && 'archived' in input) {
      const { archived } = z.object({ archived: z.boolean() }).strict().parse(input);
      await archiveHabit(user.id, id, archived);
      return json({ saved: true });
    }
    return json(await saveHabit(user.id, input, id));
  });
