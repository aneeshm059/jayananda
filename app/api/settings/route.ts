import { authorize, body, checkOrigin, json, safe } from '@/lib/http';
import { putSettings, putTheme } from '@/lib/db/repository';
export const PUT = (request: Request) =>
  safe(async () => {
    checkOrigin(request);
    const user = await authorize(request);
    return json(await putSettings(user.id, await body(request)));
  });
export const PATCH = (request: Request) =>
  safe(async () => {
    checkOrigin(request);
    const user = await authorize(request);
    return json(await putTheme(user.id, await body(request)));
  });
