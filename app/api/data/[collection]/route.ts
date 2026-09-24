import { collections, type Collection } from '@/lib/domain/model';
import { authorize, body, checkOrigin, HttpError, json, safe } from '@/lib/http';
import { list, save, remove } from '@/lib/db/repository';
import { dateSchema } from '@/lib/domain/validation';
import { addDays } from '@/lib/domain/dates';
type Context = { params: Promise<{ collection: string }> };
async function collectionOf(context: Context) {
  const { collection } = await context.params;
  if (!collections.includes(collection as Collection)) throw new HttpError(404, 'Page not found.');
  return collection as Collection;
}
export const GET = (request: Request, context: Context) =>
  safe(async () => {
    const user = await authorize(request);
    const collection = await collectionOf(context);
    const query = new URL(request.url).searchParams;
    const from = dateSchema.parse(query.get('from')),
      to = dateSchema.parse(query.get('to'));
    if (from > to || to > addDays(from, 366))
      throw new HttpError(400, 'Choose a range of up to one year.');
    return json(await list(collection, user.id, from, to));
  });
export const POST = (request: Request, context: Context) =>
  safe(async () => {
    checkOrigin(request);
    const user = await authorize(request);
    return json(await save(await collectionOf(context), user.id, await body(request)), 201);
  });
export const PATCH = (request: Request, context: Context) =>
  safe(async () => {
    checkOrigin(request);
    const user = await authorize(request);
    const id = new URL(request.url).searchParams.get('id');
    if (!id) throw new HttpError(400, 'Entry is required.');
    return json(await save(await collectionOf(context), user.id, await body(request), id));
  });
export const DELETE = (request: Request, context: Context) =>
  safe(async () => {
    checkOrigin(request);
    const user = await authorize(request);
    const id = new URL(request.url).searchParams.get('id');
    if (!id) throw new HttpError(400, 'Entry is required.');
    await remove(await collectionOf(context), user.id, id);
    return json({ saved: true });
  });
