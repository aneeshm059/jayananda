import { authorize, body, checkOrigin, json, safe } from '@/lib/http';
import { getSoulfulModule, saveSoulfulProgress } from '@/lib/db/soulful-reading';

type Context = { params: Promise<{ id: string }> };
export const GET = (request: Request, context: Context) =>
  safe(async () => {
    const user = await authorize(request);
    return json(await getSoulfulModule(user.id, (await context.params).id));
  });
export const PUT = (request: Request, context: Context) =>
  safe(async () => {
    checkOrigin(request);
    const user = await authorize(request);
    return json(await saveSoulfulProgress(user.id, (await context.params).id, await body(request)));
  });
