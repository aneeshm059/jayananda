import { authorize, body, checkOrigin, json, safe } from '@/lib/http';
import { saveHabit } from '@/lib/db/habits';
export const POST = (request: Request) =>
  safe(async () => {
    checkOrigin(request);
    const user = await authorize(request);
    return json(await saveHabit(user.id, await body(request)), 201);
  });
