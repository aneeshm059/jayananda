import { authorize, body, checkOrigin, json, safe } from '@/lib/http';
import { getGitaReading, saveGitaReading } from '@/lib/db/gita-reading';

export const GET = (request: Request) =>
  safe(async () => {
    const user = await authorize(request);
    return json(await getGitaReading(user.id));
  });
export const POST = (request: Request) =>
  safe(async () => {
    checkOrigin(request);
    const user = await authorize(request);
    return json(await saveGitaReading(user.id, await body(request)));
  });
