import { authorize, json, safe, HttpError } from '@/lib/http';
import { getSettings, records } from '@/lib/db/repository';
import { localDate, monthBounds, addDays } from '@/lib/domain/dates';
import { dateSchema } from '@/lib/domain/validation';
import { habitBundle } from '@/lib/db/habits';
export const GET = (request: Request) =>
  safe(async () => {
    const user = await authorize(request);
    const settings = await getSettings(user.id);
    const today = localDate(settings.timezone);
    const q = new URL(request.url).searchParams;
    const from = dateSchema.parse(q.get('from') ?? addDays(monthBounds(today)[0], -7)),
      to = dateSchema.parse(q.get('to') ?? addDays(monthBounds(today)[1], 7));
    if (from > to || to > addDays(from, 366))
      throw new HttpError(400, 'Choose a range of up to one year.');
    return json({
      settings,
      habits: await habitBundle(user.id, today),
      records: await records(user.id, from, to),
      today,
      from,
      to,
      demo: user.email === 'demo@example.test',
    });
  });
