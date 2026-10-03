import { authorize, json, safe } from '@/lib/http';
import { getSoulfulLibrary } from '@/lib/db/soulful-reading';

export const GET = (request: Request) =>
  safe(async () => {
    const user = await authorize(request);
    return json(await getSoulfulLibrary(user.id));
  });
