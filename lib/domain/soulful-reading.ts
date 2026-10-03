import { z } from 'zod';

export const soulfulModuleIdSchema = z
  .string()
  .max(100)
  .regex(/^sj-(?:module-\d{3}|supplement-[a-z0-9]+(?:-[a-z0-9]+)*)$/);
export const soulfulBlockSchema = z
  .object({
    type: z.enum(['paragraph', 'heading', 'verse', 'quote', 'image']),
    text: z.string().max(200_000),
    page: z.number().int().positive(),
    src: z
      .string()
      .max(500)
      .regex(/^\/soulful-japa\/[a-zA-Z0-9/_-]+\.(?:png|jpe?g|webp|svg)$/)
      .optional(),
    alt: z.string().max(3000).optional(),
    width: z.number().int().positive().max(20_000).optional(),
    height: z.number().int().positive().max(20_000).optional(),
    level: z.number().int().min(1).max(6).optional(),
  })
  .passthrough()
  .superRefine((block, ctx) => {
    if (block.type === 'image' && !block.src)
      ctx.addIssue({ code: 'custom', message: 'Image blocks need a local source asset.' });
  });

export const soulfulModuleSchema = z
  .object({
    id: soulfulModuleIdSchema,
    kind: z.enum(['module', 'supplement']),
    number: z.number().int().min(1).max(999).nullable(),
    label: z.string().min(1).max(200),
    title: z.string().min(1).max(1000),
    startPage: z.number().int().positive(),
    endPage: z.number().int().positive(),
    blocks: z.array(soulfulBlockSchema).min(1).max(50_000),
  })
  .passthrough()
  .superRefine((module, ctx) => {
    if (module.endPage < module.startPage)
      ctx.addIssue({ code: 'custom', message: 'Module page range is reversed.' });
    if (
      module.kind === 'module' &&
      (module.number === null ||
        module.id !== `sj-module-${String(module.number).padStart(3, '0')}`)
    )
      ctx.addIssue({
        code: 'custom',
        message: 'Keep the printed module number in its stable identifier.',
      });
    if (
      module.kind === 'supplement' &&
      (module.number !== null || !module.id.startsWith('sj-supplement-'))
    )
      ctx.addIssue({
        code: 'custom',
        message: 'Supplement identifiers must not invent module numbers.',
      });
    if (module.blocks.some((block) => block.page < module.startPage || block.page > module.endPage))
      ctx.addIssue({
        code: 'custom',
        message: 'A content block is outside its source page range.',
      });
  });

export const soulfulSourceSchema = z
  .object({
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
    version: z.string().min(1).max(100),
    title: z.string().min(1).max(500),
    author: z.string().min(1).max(300),
    pageCount: z.number().int().min(1).max(10_000),
  })
  .passthrough();

export const soulfulDatasetSchema = z
  .object({
    source: soulfulSourceSchema,
    modules: z.array(soulfulModuleSchema).min(1).max(2000),
  })
  .passthrough()
  .superRefine((data, ctx) => {
    const ids = new Set<string>();
    for (const module of data.modules) {
      if (ids.has(module.id))
        ctx.addIssue({ code: 'custom', message: `Duplicate module: ${module.id}` });
      ids.add(module.id);
      if (module.endPage > data.source.pageCount)
        ctx.addIssue({ code: 'custom', message: 'A module exceeds the PDF page count.' });
    }
  });

export type SoulfulBlock = z.infer<typeof soulfulBlockSchema>;
export type SoulfulModule = z.infer<typeof soulfulModuleSchema>;
export type SoulfulDataset = z.infer<typeof soulfulDatasetSchema>;
export type SoulfulSource = Pick<
  SoulfulDataset['source'],
  'sha256' | 'version' | 'title' | 'author' | 'pageCount'
> & { contentVersion: string };
export type SoulfulModuleSummary = Pick<
  SoulfulModule,
  'id' | 'kind' | 'number' | 'label' | 'title' | 'startPage' | 'endPage'
> & { blockCount: number };
export interface SoulfulProgress {
  moduleId: string;
  completed: boolean;
  completedAt: string | null;
  anchor: number;
  contentVersion: string;
  lastOpenedAt: string | null;
  updatedAt: string;
  version: number;
}
export interface SoulfulLibraryResponse {
  readerKey: string;
  source: SoulfulSource | null;
  modules: SoulfulModuleSummary[];
  progress: SoulfulProgress[];
  resumeModuleId: string | null;
}
export interface SoulfulModuleResponse {
  source: SoulfulSource;
  module: SoulfulModule;
  progress: SoulfulProgress | null;
}
export interface SoulfulProgressResponse {
  progress: SoulfulProgress;
  resumeModuleId: string | null;
}
export const soulfulProgressActionSchema = z
  .object({
    version: z.number().int().min(0).max(2_000_000_000),
    requestId: z.uuid(),
    completed: z.boolean().optional(),
    opened: z.literal(true).optional(),
    anchor: z.number().int().min(0).max(49_999).optional(),
    contentVersion: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .optional(),
  })
  .strict()
  .refine(
    (action) => action.completed !== undefined || action.opened || action.anchor !== undefined,
    {
      message: 'Choose a reading progress change.',
    },
  );
export type SoulfulProgressAction = z.infer<typeof soulfulProgressActionSchema>;

export function soulfulResumeModuleId(
  modules: SoulfulModuleSummary[],
  progress: SoulfulProgress[],
): string | null {
  const state = new Map(progress.map((item) => [item.moduleId, item]));
  const ordered = [
    ...modules.filter((item) => item.kind === 'module'),
    ...modules.filter((item) => item.kind === 'supplement'),
  ];
  const lastOpened = [...progress]
    .filter((item) => item.lastOpenedAt && ordered.some((module) => module.id === item.moduleId))
    .sort(
      (a, b) =>
        b.lastOpenedAt!.localeCompare(a.lastOpenedAt!) || b.updatedAt.localeCompare(a.updatedAt),
    )[0];
  if (lastOpened && !lastOpened.completed) return lastOpened.moduleId;
  if (lastOpened) {
    const after = ordered.slice(
      ordered.findIndex((module) => module.id === lastOpened.moduleId) + 1,
    );
    const next = after.find((module) => !state.get(module.id)?.completed);
    if (next) return next.id;
  }
  return ordered.find((module) => !state.get(module.id)?.completed)?.id ?? null;
}

/** Stable object ordering keeps a repeat import on the same immutable content version. */
export function stableSoulfulJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableSoulfulJson).join(',')}]`;
  if (value !== null && typeof value === 'object')
    return `{${Object.keys(value)
      .sort()
      .map(
        (key) =>
          `${JSON.stringify(key)}:${stableSoulfulJson((value as Record<string, unknown>)[key])}`,
      )
      .join(',')}}`;
  return JSON.stringify(value);
}

/** Split only between Unicode code points; each SQL literal stays well below D1's statement limit. */
export function soulfulTextChunks(text: string, maxBytes = 16_384): string[] {
  if (!Number.isInteger(maxBytes) || maxBytes < 4) throw new Error('Invalid chunk size');
  const chunks: string[] = [];
  let chunk = '',
    size = 0;
  const encoder = new TextEncoder();
  for (const character of text) {
    const length = encoder.encode(character).length;
    if (size + length > maxBytes) {
      chunks.push(chunk);
      chunk = '';
      size = 0;
    }
    chunk += character;
    size += length;
  }
  if (chunk || !chunks.length) chunks.push(chunk);
  return chunks;
}
