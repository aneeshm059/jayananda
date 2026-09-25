import { authorize, safe, HttpError } from '@/lib/http';
import { getSettings, records, list } from '@/lib/db/repository';
import { collections, type Collection } from '@/lib/domain/model';
import { checkins, listHabits } from '@/lib/db/habits';
import { localDate } from '@/lib/domain/dates';
const cell = (v: unknown) =>
  '"' +
  String(v ?? '')
    .replace(/^[=+@\-\t\r]/, "'$&")
    .replaceAll('"', '""') +
  '"';
export const GET = (request: Request) =>
  safe(async () => {
    const user = await authorize(request);
    const collection = new URL(request.url).searchParams.get('collection');
    const settings = await getSettings(user.id);
    const today = localDate(settings.timezone);
    if (!collection)
      return new Response(
        JSON.stringify(
          {
            exportedAt: new Date().toISOString(),
            settings,
            records: await records(user.id),
            habits: { habits: await listHabits(user.id, today), checkins: await checkins(user.id) },
          },
          null,
          2,
        ),
        {
          headers: {
            'Content-Type': 'application/json',
            'Content-Disposition': 'attachment; filename="jayananda-journal.json"',
            'Cache-Control': 'private, no-store',
          },
        },
      );
    if (collection !== 'habits' && !collections.includes(collection as Collection))
      throw new HttpError(400, 'Choose a practice to export.');
    const rows: Record<string, unknown>[] =
      collection === 'habits'
        ? await (async () => {
            const names = new Map((await listHabits(user.id, today)).map((h) => [h.id, h.name]));
            return (await checkins(user.id)).map((e) => ({
              habit: names.get(e.habitId) ?? '',
              ...e,
            }));
          })()
        : await list(collection as Collection, user.id);
    const keys = rows.length ? Object.keys(rows[0]) : ['date'];
    const csv = [
      keys.map(cell).join(','),
      ...rows.map((r) => keys.map((k) => cell(r[k])).join(',')),
    ].join('\r\n');
    return new Response('\uFEFF' + csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="jayananda-${collection}.csv"`,
        'Cache-Control': 'private, no-store',
      },
    });
  });
