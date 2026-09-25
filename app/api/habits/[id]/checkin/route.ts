import { authorize, body, checkOrigin, HttpError, json, safe } from '@/lib/http';
import { getSettings } from '@/lib/db/repository';
import { localDate } from '@/lib/domain/dates';
import { saveCheckin } from '@/lib/db/habits';
type Context = { params: Promise<{ id: string }> };
export const PATCH = (request: Request, context: Context) =>
  safe(async () => {
    checkOrigin(request);
    const user = await authorize(request),
      { id } = await context.params;
    const today = localDate((await getSettings(user.id)).timezone);
    // The clock, not a submitted form date, determines the record's day.
    if (request.headers.get('x-habit-day') !== today)
      throw new HttpError(
        409,
        'A new day has begun. Refresh today before saving. Your unsaved notes are still here.',
      );
    return json(await saveCheckin(user.id, id, today, await body(request)));
  });
