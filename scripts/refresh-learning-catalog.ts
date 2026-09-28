/**
 * Refresh the checked-in, API-key-free learning catalog from public metadata.
 * Run: npx tsx scripts/refresh-learning-catalog.ts
 * Requires yt-dlp on PATH (or YTDLP_BIN) and curl. No media is downloaded.
 * --check fetches and validates metadata without modifying the catalog.
 */
import { execFile } from 'node:child_process';
import { readFile, rename, writeFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import {
  englishPrabhupadaSelections,
  type LearningCourse,
  type Lesson,
} from '../lib/domain/learning-catalog';

const runFile = promisify(execFile);
const expectedChannelId = 'UCaL10tuZXQpURxqH2o1C2Jw';
const playlistSources = [
  {
    id: 'soulful-japa',
    title: 'Soulful Japa',
    subtitle: 'Madhu Pandit Dasa · ISKCON Bangalore Sanga',
    speaker: 'Madhu Pandit Dasa',
    playlistId: 'PLKVQRAZMT7-kNyVocJzO1MXqsvimBMOMy',
    dailyMinutes: 30,
  },
  {
    id: 'happiness-pleasure',
    title: 'Krishna Consciousness Happiness & Pleasure',
    subtitle: 'Madhu Pandit Dasa · ISKCON Bangalore Sanga',
    speaker: 'Madhu Pandit Dasa',
    playlistId: 'PLKVQRAZMT7-k1hMlGnAmNT8uMpfw68HNO',
    dailyMinutes: 30,
  },
] as const;
const videoIdPattern = /^[A-Za-z0-9_-]{11}$/;

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Expected a metadata object. The existing catalog is unchanged.');
  return value as Record<string, unknown>;
}

function nonemptyText(value: unknown, name: string): string {
  if (typeof value !== 'string' || !value.trim())
    throw new Error(`Missing ${name}. The existing catalog is unchanged.`);
  return value;
}

async function playlistCourse(source: (typeof playlistSources)[number]): Promise<LearningCourse> {
  const sourceUrl = `https://www.youtube.com/playlist?list=${source.playlistId}`;
  const { stdout, stderr } = await runFile(
    process.env.YTDLP_BIN || 'yt-dlp',
    [
      '--ignore-config',
      '--flat-playlist',
      '--dump-single-json',
      '--skip-download',
      '--no-progress',
      '--socket-timeout',
      '25',
      '--retries',
      '2',
      '--extractor-retries',
      '2',
      sourceUrl,
    ],
    { timeout: 120_000, maxBuffer: 16 * 1024 * 1024 },
  );
  const data = object(JSON.parse(stdout));
  if (data.id !== source.playlistId || data.channel_id !== expectedChannelId)
    throw new Error(`Unexpected playlist or owner for ${source.id}; catalog not written.`);
  if (!Array.isArray(data.entries) || !data.entries.length)
    throw new Error(`Empty playlist for ${source.id}; catalog not written.`);
  // A failed continuation must never silently replace the complete saved catalog.
  if (typeof data.playlist_count !== 'number' || data.entries.length !== data.playlist_count)
    throw new Error(`Incomplete playlist for ${source.id}; catalog not written.`);
  const publishedEntries: Lesson[] = data.entries.map((entry: unknown, index: number) => {
    const item = object(entry);
    const id = nonemptyText(item.id, 'video ID');
    const title = nonemptyText(item.title, 'video title');
    if (/\bhindi\b|हिन्दी|हिंदी/i.test(title))
      throw new Error(`English-only catalog: review the language of ${id}; catalog not written.`);
    if (!videoIdPattern.test(id) || /^\[(?:private|deleted) video\]$/i.test(title))
      throw new Error(`Unavailable or invalid entry at ${source.id} position ${index + 1}.`);
    if (
      item.duration != null &&
      (typeof item.duration !== 'number' || !Number.isFinite(item.duration) || item.duration <= 0)
    )
      throw new Error(`Invalid duration for ${id}; catalog not written.`);
    const sessionMatch = /\bsession\s*[:#.-]?\s*(\d+)\b/i.exec(title);
    return {
      id,
      title,
      position: index + 1,
      sourcePosition: index + 1,
      ...(sessionMatch ? { sessionNumber: Number(sessionMatch[1]) } : {}),
      ...(typeof item.duration === 'number' ? { durationSeconds: item.duration } : {}),
    };
  });
  const uniqueEntries = new Map<string, Lesson>();
  for (const lesson of publishedEntries) {
    const previous = uniqueEntries.get(lesson.id);
    if (previous) {
      if (previous.title !== lesson.title || previous.durationSeconds !== lesson.durationSeconds)
        throw new Error(
          `Conflicting metadata for repeated video ${lesson.id}; catalog not written.`,
        );
      previous.sourcePositions = [
        ...(previous.sourcePositions || [previous.sourcePosition!]),
        lesson.sourcePosition!,
      ];
    } else uniqueEntries.set(lesson.id, lesson);
  }
  // Use the video SESSION labels, not the different written-module numbering.
  // Explicit part labels break ties; otherwise retain publisher order. Different
  // recordings carrying the same session number remain adjacent and distinct.
  const explicitPart = (lesson: Lesson) => {
    const match = /\bpart\s*[-:.]?\s*(\d+)\b/i.exec(lesson.title);
    return match ? Number(match[1]) : 0;
  };
  const lessons = [...uniqueEntries.values()]
    .sort(
      (left, right) =>
        (left.sessionNumber ?? Number.MAX_SAFE_INTEGER) -
          (right.sessionNumber ?? Number.MAX_SAFE_INTEGER) ||
        (left.sessionNumber != null && right.sessionNumber != null
          ? explicitPart(left) - explicitPart(right)
          : 0) ||
        left.sourcePosition! - right.sourcePosition!,
    )
    .map((lesson, index) => ({ ...lesson, position: index + 1 }));
  if (stderr.trim()) console.warn(stderr.trim());
  console.log(
    `${source.title}: ${publishedEntries.length} source positions → ${lessons.length} unique lessons in video-session order.`,
  );
  return { ...source, sourceUrl, lessons };
}

async function prabhupadaCourse(): Promise<LearningCourse> {
  const lessons = await Promise.all(
    englishPrabhupadaSelections.map(async (selection, index): Promise<Lesson> => {
      const { id } = selection;
      const url = new URL('https://www.youtube.com/oembed');
      url.searchParams.set('url', `https://www.youtube.com/watch?v=${id}`);
      url.searchParams.set('format', 'json');
      const { stdout } = await runFile(
        'curl',
        ['--fail', '--silent', '--show-error', '--location', '--max-time', '25', url.toString()],
        { timeout: 30_000, maxBuffer: 1024 * 1024 },
      );
      const data = object(JSON.parse(stdout));
      if (
        data.author_name !== 'The Acharya' ||
        data.author_url !== 'https://www.youtube.com/@TheAcharya1'
      )
        throw new Error(`Unexpected author for ${id}; catalog not written.`);
      const title = nonemptyText(data.title, 'video title');
      if (title !== selection.title)
        throw new Error(
          `Recheck the verified English selection ${id}: its title changed; catalog not written.`,
        );
      // oEmbed does not expose a duration. Do not invent one.
      return { id, title, position: index + 1 };
    }),
  );
  console.log(`Śrīla Prabhupāda: ${lessons.length} verified English selections from The Acharya.`);
  return {
    id: 'prabhupada',
    title: 'Hear Śrīla Prabhupāda',
    subtitle: 'Selected English lectures · The Acharya',
    speaker: 'Śrīla Prabhupāda',
    playlistId: '',
    sourceUrl: 'https://www.youtube.com/channel/UCDTX-lo7YZCg_P28_Mo4NOg',
    dailyMinutes: 30,
    lessons,
  };
}

async function main() {
  if (process.argv.slice(2).some((arg) => arg !== '--check'))
    throw new Error('Only --check is supported. This script refreshes local source files.');
  const courses = await Promise.all([...playlistSources.map(playlistCourse), prabhupadaCourse()]);
  if (process.argv.includes('--check')) return;
  const catalogUrl = new URL('../lib/domain/learning-catalog.ts', import.meta.url);
  const existing = await readFile(catalogUrl, 'utf8');
  const marker = 'export const learningCourses: LearningCourse[] = ';
  const typeDefinitions = existing
    .split('// Public metadata snapshot:')[0]
    .split(marker)[0]
    .trimEnd();
  if (!existing.includes(marker))
    throw new Error('Catalog export marker missing; catalog not written.');
  const generatedAt = new Date().toISOString();
  const output =
    `${typeDefinitions}\n\n// Public metadata snapshot: ${generatedAt}\n` +
    '// Refreshed with scripts/refresh-learning-catalog.ts. See docs/LEARNING-SOURCES.md.\n' +
    '// Unique videos follow video-session order; original positions remain on each lesson.\n' +
    `${marker}${JSON.stringify(courses, null, 2)};\n`;
  const temporaryUrl = new URL('../lib/domain/learning-catalog.ts.tmp', import.meta.url);
  await writeFile(temporaryUrl, output, 'utf8');
  await rename(temporaryUrl, catalogUrl);
  console.log(
    'Updated lib/domain/learning-catalog.ts. No media downloaded or remote data changed.',
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
