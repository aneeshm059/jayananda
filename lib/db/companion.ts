import { and, eq } from 'drizzle-orm';
import { database } from './client';
import { companionEntries } from './schema';
import { companionWriteSchema, parseCompanionValue, type CompanionItem } from '../domain/companion';
import { HttpError } from '../http';

const columns = {
  key: companionEntries.key,
  value: companionEntries.value,
  version: companionEntries.version,
};

export async function companionItems(userId: string): Promise<CompanionItem[]> {
  const rows = await database()
    .select(columns)
    .from(companionEntries)
    .where(eq(companionEntries.userId, userId));
  return rows.map((row) => ({ ...row, value: JSON.parse(row.value) }));
}

export async function saveCompanionItem(userId: string, input: unknown): Promise<CompanionItem> {
  const { key, value, version } = companionWriteSchema.parse(input);
  const parsed = parseCompanionValue(key, value);
  const db = database();
  const next = {
    value: JSON.stringify(parsed),
    version: version + 1,
    updatedAt: new Date().toISOString(),
  };
  // Both paths are atomic. An absent item uses version zero; a stale write cannot
  // replace another tab or device's saved value, even when requests race.
  const rows =
    version === 0
      ? await db
          .insert(companionEntries)
          .values({ id: crypto.randomUUID(), userId, key, ...next })
          .onConflictDoNothing({ target: [companionEntries.userId, companionEntries.key] })
          .returning(columns)
      : await db
          .update(companionEntries)
          .set(next)
          .where(
            and(
              eq(companionEntries.userId, userId),
              eq(companionEntries.key, key),
              eq(companionEntries.version, version),
            ),
          )
          .returning(columns);
  if (!rows.length)
    throw new HttpError(
      409,
      'This item changed on another device or tab. Reload the saved progress, then review your changes before saving again.',
    );
  return { key, value: parsed, version: version + 1 };
}
