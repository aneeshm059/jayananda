import { z } from 'zod';
import { sql, getTableColumns, getTableName, eq } from 'drizzle-orm';
import { database } from './client';
import { tables, userSettings, appPreferences, users, reflection, daily } from './schema';
import {
  defaultSettings,
  collections,
  type Settings,
  type Records,
  type Collection,
  type Entry,
} from '../domain/model';
import { schemas, settingsSchema } from '../domain/validation';
import { HttpError } from '../http';
const singleDate = new Set<Collection>([
    'daily',
    'wake',
    'reflection',
    'sankalpa',
    'weekly',
    'monthly',
    'prabhupada',
  ]),
  persistent = new Set<Collection>(['purpose', 'goals', 'reminders']);
function descriptors(collection: Collection) {
  const table = tables[collection];
  return { name: getTableName(table), columns: getTableColumns(table) };
}
function normalized(collection: Collection, row: Record<string, unknown>): Entry {
  const { columns } = descriptors(collection);
  const out: Record<string, unknown> = {};
  for (const [key, column] of Object.entries(columns)) {
    if (key === 'userId') continue;
    out[key] = column.dataType === 'boolean' ? Boolean(row[column.name]) : row[column.name];
  }
  return out as Entry;
}
export async function getSettings(userId: string): Promise<Settings> {
  const db = database();
  const [row] = await db.select().from(userSettings).where(eq(userSettings.userId, userId));
  if (row) return settingsSchema.parse(JSON.parse(row.value));
  const [user] = await db.select({ name: users.name }).from(users).where(eq(users.id, userId));
  return { ...defaultSettings, name: user?.name ?? defaultSettings.name };
}
export async function putSettings(userId: string, input: unknown) {
  const settings = settingsSchema.parse(input);
  const db = database();
  await db.batch([
    db
      .insert(userSettings)
      .values({ userId, value: JSON.stringify(settings), updatedAt: new Date().toISOString() })
      .onConflictDoUpdate({
        target: userSettings.userId,
        set: { value: JSON.stringify(settings), updatedAt: new Date().toISOString() },
      }),
    db
      .insert(appPreferences)
      .values({ userId, theme: settings.theme, hero: settings.hero })
      .onConflictDoUpdate({
        target: appPreferences.userId,
        set: { theme: settings.theme, hero: settings.hero },
      }),
  ]);
  return settings;
}
export async function list(
  collection: Collection,
  userId: string,
  from?: string,
  to?: string,
): Promise<Entry[]> {
  const { name } = descriptors(collection);
  const filter =
    from && to && !persistent.has(collection) ? sql` AND date >= ${from} AND date <= ${to}` : sql``;
  const rows = await database().all<Record<string, unknown>>(
    sql`SELECT * FROM ${sql.identifier(name)} WHERE user_id = ${userId}${filter} ORDER BY date DESC, created_at DESC`,
  );
  return rows.map((row) => normalized(collection, row));
}
export async function records(userId: string, from?: string, to?: string): Promise<Records> {
  const rows = await Promise.all(collections.map((c) => list(c, userId, from, to)));
  return Object.fromEntries(collections.map((c, i) => [c, rows[i]])) as Records;
}
export async function save(
  collection: Collection,
  userId: string,
  input: unknown,
  id?: string,
): Promise<Entry> {
  const requestId =
    input && typeof input === 'object' && '_requestId' in input
      ? z.uuid().parse(input._requestId)
      : undefined;
  const parsed = schemas[collection].parse(input);
  const data: Record<string, unknown> = { ...parsed };
  if (collection === 'krishna' && data.startPage != null && data.endPage != null)
    data.pagesRead = Number(data.endPage) - Number(data.startPage) + 1;
  const { name, columns } = descriptors(collection);
  const columnMap: Record<string, { name: string }> = columns;
  const db = database();
  const now = new Date().toISOString();
  if (id) {
    const rows = await db.all<{ id: string }>(
      sql`SELECT id FROM ${sql.identifier(name)} WHERE id=${id} AND user_id=${userId}`,
    );
    if (!rows.length) throw new HttpError(404, 'This entry could not be found.');
  }
  if (collection === 'reflection') {
    const reflectionData = schemas.reflection.parse(input);
    if (id) {
      const [old] = await db
        .select()
        .from(reflection)
        .where(sql`${reflection.id}=${id} AND ${reflection.userId}=${userId}`);
      if (!old) throw new HttpError(404, 'This entry could not be found.');
      const changes = [
        db
          .update(reflection)
          .set({ ...reflectionData, updatedAt: now })
          .where(sql`${reflection.id}=${id} AND ${reflection.userId}=${userId}`),
        db
          .insert(daily)
          .values({
            id: crypto.randomUUID(),
            userId,
            date: reflectionData.date,
            mode: 'ideal',
            closed: true,
            createdAt: now,
            updatedAt: now,
          })
          .onConflictDoUpdate({
            target: [daily.userId, daily.date],
            set: { closed: true, updatedAt: now },
          }),
      ] as const;
      if (old.date !== reflectionData.date)
        await db.batch([
          ...changes,
          db
            .update(daily)
            .set({ closed: false, updatedAt: now })
            .where(sql`${daily.userId}=${userId} AND ${daily.date}=${old.date}`),
        ]);
      else await db.batch(changes);
    } else
      await db.batch([
        db
          .insert(reflection)
          .values({
            id: crypto.randomUUID(),
            userId,
            ...reflectionData,
            createdAt: now,
            updatedAt: now,
          })
          .onConflictDoUpdate({
            target: [reflection.userId, reflection.date],
            set: { ...reflectionData, updatedAt: now },
          }),
        db
          .insert(daily)
          .values({
            id: crypto.randomUUID(),
            userId,
            date: reflectionData.date,
            mode: 'ideal',
            closed: true,
            createdAt: now,
            updatedAt: now,
          })
          .onConflictDoUpdate({
            target: [daily.userId, daily.date],
            set: { closed: true, updatedAt: now },
          }),
      ]);
    return (await list('reflection', userId, reflectionData.date, reflectionData.date))[0];
  }
  if (requestId && !id) {
    const previous = await db.all<Record<string, unknown>>(
      sql`SELECT * FROM ${sql.identifier(name)} WHERE id=${requestId} AND user_id=${userId}`,
    );
    if (previous.length) return normalized(collection, previous[0]);
  }
  const values = { ...data, updatedAt: now };
  let query;
  if (id) {
    const parts = Object.entries(values)
      .filter(([k]) => k in columnMap)
      .map(
        ([k, v]) =>
          sql`${sql.identifier(columnMap[k].name)} = ${typeof v === 'boolean' ? Number(v) : (v ?? null)}`,
      );
    query = sql`UPDATE ${sql.identifier(name)} SET ${sql.join(parts, sql`, `)} WHERE id=${id} AND user_id=${userId} RETURNING *`;
  } else {
    const all = { id: requestId ?? crypto.randomUUID(), userId, createdAt: now, ...values };
    const pairs = Object.entries(all).filter(([k]) => k in columnMap);
    const conflict = singleDate.has(collection)
      ? sql` ON CONFLICT(user_id,date) DO UPDATE SET ${sql.join(
          Object.entries(values).map(
            ([k, v]) =>
              sql`${sql.identifier(columnMap[k].name)}=${typeof v === 'boolean' ? Number(v) : (v ?? null)}`,
          ),
          sql`, `,
        )}`
      : collection === 'purpose'
        ? sql` ON CONFLICT(user_id) DO UPDATE SET text=${data.text},date=${data.date},updated_at=${now}`
        : requestId
          ? sql` ON CONFLICT(id) DO NOTHING`
          : sql``;
    query = sql`INSERT INTO ${sql.identifier(name)} (${sql.join(
      pairs.map(([k]) => sql.identifier(columnMap[k].name)),
      sql`,`,
    )}) VALUES (${sql.join(
      pairs.map(([, v]) => sql`${typeof v === 'boolean' ? Number(v) : (v ?? null)}`),
      sql`,`,
    )})${conflict} RETURNING *`;
  }
  const result = await db.all<Record<string, unknown>>(query);
  if (!result.length && requestId) {
    const previous = await db.all<Record<string, unknown>>(
      sql`SELECT * FROM ${sql.identifier(name)} WHERE id=${requestId} AND user_id=${userId}`,
    );
    if (previous.length) return normalized(collection, previous[0]);
    throw new HttpError(409, 'Please refresh your journal and try again.');
  }
  return normalized(collection, result[0]);
}
export async function remove(collection: Collection, userId: string, id: string) {
  const { name } = descriptors(collection);
  const db = database();
  if (collection === 'reflection') {
    const [row] = await db
      .select()
      .from(reflection)
      .where(sql`${reflection.id}=${id} AND ${reflection.userId}=${userId}`);
    if (!row) throw new HttpError(404, 'This entry could not be found.');
    await db.batch([
      db.delete(reflection).where(sql`${reflection.id}=${id} AND ${reflection.userId}=${userId}`),
      db
        .update(daily)
        .set({ closed: false, updatedAt: new Date().toISOString() })
        .where(sql`${daily.userId}=${userId} AND ${daily.date}=${row.date}`),
    ]);
    return;
  }
  const rows = await db.all(
    sql`DELETE FROM ${sql.identifier(name)} WHERE id=${id} AND user_id=${userId} RETURNING id`,
  );
  if (!rows.length) throw new HttpError(404, 'This entry could not be found.');
}
