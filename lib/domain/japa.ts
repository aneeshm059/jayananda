import { z } from 'zod';
import { dateSchema } from './validation';
import type { Entry } from './model';

export const decrementJapaSchema = z
  .object({
    id: z.string().min(1).max(200),
    date: dateSchema,
    expectedRounds: z.number().int().min(1).max(192),
    expectedUpdatedAt: z.iso.datetime(),
  })
  .strict();

export function latestCountedSession(entries: Entry[], date: string) {
  return entries
    .filter((e) => e.date === date && Number(e.rounds) > 0)
    .sort(
      (a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? '') || b.id.localeCompare(a.id),
    )[0];
}
