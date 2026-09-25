import { authorize, checkOrigin, json, safe } from '@/lib/http';
import { getSettings } from '@/lib/db/repository';
import { localDate } from '@/lib/domain/dates';
import { ensureStarterHabits } from '@/lib/db/habits';
export const POST = (request: Request) =>
  safe(async () => {
    checkOrigin(request);
    const user = await authorize(request),
      settings = await getSettings(user.id);
    await ensureStarterHabits(user.id, localDate(settings.timezone));
    return json({ saved: true });
  });
