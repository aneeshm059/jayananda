import { authorize, safe, HttpError } from '@/lib/http';
import { getSettings, records, list } from '@/lib/db/repository';
import { collections, type Collection } from '@/lib/domain/model';
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
    if (!collection)
      return new Response(
        JSON.stringify(
          {
            exportedAt: new Date().toISOString(),
            settings: await getSettings(user.id),
            records: await records(user.id),
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
    if (!collections.includes(collection as Collection))
      throw new HttpError(400, 'Choose a practice to export.');
    const rows = await list(collection as Collection, user.id);
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
