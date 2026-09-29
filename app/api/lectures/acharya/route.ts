import { z } from 'zod';
import { authorize, body, checkOrigin, json, safe } from '@/lib/http';
import { getAcharyaLibrary, syncAcharyaChunk } from '@/lib/db/acharya';

export const GET = (request: Request) =>
  safe(async () => {
    await authorize(request);
    return json(await getAcharyaLibrary());
  });
export const POST = (request: Request) =>
  safe(async () => {
    checkOrigin(request);
    await authorize(request);
    z.strictObject({ action: z.literal('sync') }).parse(await body(request));
    return json(await syncAcharyaChunk());
  });
