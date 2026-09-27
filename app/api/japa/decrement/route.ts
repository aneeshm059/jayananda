import { authorize, body, checkOrigin, json, safe } from '@/lib/http';
import { decrementJapa } from '@/lib/db/japa';

export const POST = (request: Request) =>
  safe(async () => {
    checkOrigin(request);
    const user = await authorize(request);
    return json(await decrementJapa(user.id, await body(request)));
  });
