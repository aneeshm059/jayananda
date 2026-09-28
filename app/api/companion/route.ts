import { authorize, body, checkOrigin, json, safe } from '@/lib/http';
import { companionItems, saveCompanionItem } from '@/lib/db/companion';

export const GET = (request: Request) =>
  safe(async () => {
    const user = await authorize(request);
    return json({ items: await companionItems(user.id) });
  });

export const PUT = (request: Request) =>
  safe(async () => {
    checkOrigin(request);
    const user = await authorize(request);
    return json(await saveCompanionItem(user.id, await body(request)));
  });
