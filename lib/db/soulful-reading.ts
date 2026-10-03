import { and, asc, eq } from 'drizzle-orm';
import { database } from './client';
import {
  soulfulReadingCatalog as catalog,
  soulfulReadingSources as sources,
  soulfulReadingModules as modules,
  soulfulReadingParts as parts,
  soulfulReadingProgress as progress,
} from './schema';
import {
  soulfulModuleIdSchema,
  soulfulModuleSchema,
  soulfulProgressActionSchema,
  soulfulResumeModuleId,
  soulfulSourceSchema,
  stableSoulfulJson,
  type SoulfulLibraryResponse,
  type SoulfulModuleResponse,
  type SoulfulModuleSummary,
  type SoulfulProgress,
  type SoulfulProgressResponse,
  type SoulfulSource,
} from '../domain/soulful-reading';
import { HttpError } from '../http';

const CATALOG_ID = 'soulful-japa';
const progressColumns = {
  moduleId: progress.moduleId,
  completed: progress.completed,
  completedAt: progress.completedAt,
  anchor: progress.anchor,
  contentVersion: progress.contentVersion,
  lastOpenedAt: progress.lastOpenedAt,
  updatedAt: progress.updatedAt,
  version: progress.version,
};
const summaryColumns = {
  id: modules.moduleId,
  kind: modules.kind,
  number: modules.number,
  label: modules.label,
  title: modules.title,
  startPage: modules.startPage,
  endPage: modules.endPage,
  blockCount: modules.blockCount,
};

async function activeSource(): Promise<SoulfulSource | null> {
  const rows = await database()
    .select({ contentVersion: sources.contentVersion, source: sources.source })
    .from(catalog)
    .innerJoin(sources, eq(catalog.contentVersion, sources.contentVersion))
    .where(eq(catalog.id, CATALOG_ID));
  if (!rows[0]) return null;
  const source = soulfulSourceSchema.parse(JSON.parse(rows[0].source));
  // Only public bibliographic provenance is exposed; extraction metadata can
  // contain local paths and is kept in the import source record, never in APIs.
  return {
    sha256: source.sha256,
    version: source.version,
    title: source.title,
    author: source.author,
    pageCount: source.pageCount,
    contentVersion: rows[0].contentVersion,
  };
}
async function summaries(contentVersion: string): Promise<SoulfulModuleSummary[]> {
  return database()
    .select(summaryColumns)
    .from(modules)
    .where(eq(modules.contentVersion, contentVersion))
    .orderBy(asc(modules.position));
}

/** User scope is required here and is never taken from a request body. */
export async function soulfulProgressForExport(userId: string): Promise<SoulfulProgress[]> {
  return database()
    .select(progressColumns)
    .from(progress)
    .where(eq(progress.userId, userId))
    .orderBy(asc(progress.moduleId));
}
export async function getSoulfulLibrary(userId: string): Promise<SoulfulLibraryResponse> {
  const [source, saved] = await Promise.all([activeSource(), soulfulProgressForExport(userId)]);
  const entries = source ? await summaries(source.contentVersion) : [];
  const identity = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(`jayananda:soulful-japa-reader:v1:${userId}`),
  );
  const readerKey = Array.from(new Uint8Array(identity), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
  return {
    readerKey,
    source,
    modules: entries,
    progress: saved,
    resumeModuleId: soulfulResumeModuleId(entries, saved),
  };
}

async function findModule(moduleId: string) {
  soulfulModuleIdSchema.parse(moduleId);
  const source = await activeSource();
  if (!source) throw new HttpError(404, 'The written Soulful Japa library is not available yet.');
  const rows = await database()
    .select()
    .from(modules)
    .where(and(eq(modules.contentVersion, source.contentVersion), eq(modules.moduleId, moduleId)));
  if (!rows[0]) throw new HttpError(404, 'This written module is not in the library.');
  return { source, entry: rows[0] };
}
export async function getSoulfulModule(
  userId: string,
  moduleId: string,
): Promise<SoulfulModuleResponse> {
  const { source, entry } = await findModule(moduleId);
  const [chunks, saved] = await Promise.all([
    database()
      .select({ position: parts.position, value: parts.value })
      .from(parts)
      .where(eq(parts.moduleKey, entry.id))
      .orderBy(asc(parts.position)),
    database()
      .select(progressColumns)
      .from(progress)
      .where(and(eq(progress.userId, userId), eq(progress.moduleId, moduleId))),
  ]);
  if (chunks.length !== entry.partCount || chunks.some((chunk, index) => chunk.position !== index))
    throw new Error('Incomplete written module import');
  const value = chunks.map((chunk) => chunk.value).join('');
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  const hash = Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
  if (hash !== entry.contentHash) throw new Error('Written module integrity check failed');
  const module = soulfulModuleSchema.parse(JSON.parse(value));
  if (module.id !== moduleId || module.blocks.length !== entry.blockCount)
    throw new Error('Written module metadata mismatch');
  return { source, module, progress: saved[0] ?? null };
}

const conflict = () =>
  new HttpError(
    409,
    'This module changed on another device or tab. Reload the saved progress, review it, and try again.',
  );

export async function saveSoulfulProgress(
  userId: string,
  moduleId: string,
  input: unknown,
  clock = new Date(),
): Promise<SoulfulProgressResponse> {
  const action = soulfulProgressActionSchema.parse(input);
  const { source, entry } = await findModule(moduleId);
  if (action.contentVersion && action.contentVersion !== source.contentVersion)
    throw new HttpError(
      409,
      'The written library was updated. Reload this module before saving your progress.',
    );
  if (action.anchor !== undefined && action.anchor >= entry.blockCount)
    throw new HttpError(400, 'Choose a position within this module.');
  const db = database();
  const condition = and(eq(progress.userId, userId), eq(progress.moduleId, moduleId));
  const current = (await db.select().from(progress).where(condition))[0];
  const request = stableSoulfulJson(action);
  const response = async (saved: SoulfulProgress): Promise<SoulfulProgressResponse> => {
    const [entries, allProgress] = await Promise.all([
      summaries(source.contentVersion),
      soulfulProgressForExport(userId),
    ]);
    return { progress: saved, resumeModuleId: soulfulResumeModuleId(entries, allProgress) };
  };
  const retry = (row: typeof current | undefined) => {
    if (!row || row.lastRequestId !== action.requestId) return null;
    if (row.lastRequest !== request) throw conflict();
    const {
      moduleId: id,
      completed,
      completedAt,
      anchor,
      contentVersion,
      lastOpenedAt,
      updatedAt,
      version,
    } = row;
    return {
      moduleId: id,
      completed,
      completedAt,
      anchor,
      contentVersion,
      lastOpenedAt,
      updatedAt,
      version,
    };
  };
  const retried = retry(current);
  if (retried) return response(retried);
  if ((current?.version ?? 0) !== action.version) throw conflict();
  const now = clock.toISOString();
  const completed = action.completed ?? current?.completed ?? false;
  const next = {
    completed,
    completedAt: completed ? (current?.completedAt ?? now) : null,
    anchor:
      action.anchor ?? (current?.contentVersion === source.contentVersion ? current.anchor : 0),
    contentVersion: source.contentVersion,
    lastOpenedAt: action.opened ? now : (current?.lastOpenedAt ?? null),
    updatedAt: now,
    version: action.version + 1,
    lastRequestId: action.requestId,
    lastRequest: request,
  };
  const result =
    action.version === 0
      ? await db
          .insert(progress)
          .values({ id: crypto.randomUUID(), userId, moduleId, ...next })
          .onConflictDoNothing({ target: [progress.userId, progress.moduleId] })
          .returning(progressColumns)
      : await db
          .update(progress)
          .set(next)
          .where(and(condition, eq(progress.version, action.version)))
          .returning(progressColumns);
  if (result[0]) return response(result[0]);
  // Two identical retries may arrive simultaneously. Only one changes the row;
  // the loser can acknowledge that exact request, but never a different edit.
  const winner = retry((await db.select().from(progress).where(condition))[0]);
  if (winner) return response(winner);
  throw conflict();
}
