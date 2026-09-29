/** Metadata-only maintenance. No credentials, media, transcripts, or user data. */
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import {
  ACHARYA_CHANNEL_ID,
  ACHARYA_CHANNEL_URL,
  ACHARYA_MAX_DURATION_SECONDS,
  ACHARYA_MIN_DURATION_SECONDS,
  acharyaCatalogSnapshot,
  filterAcharyaLectures,
  selectAcharyaLecture,
  type AcharyaCatalogSnapshot,
  type AcharyaVideoCandidate,
} from '../lib/domain/acharya-catalog';
import {
  fetchAcharyaPage,
  fetchAcharyaVideo,
  type AcharyaBrowseCursor,
} from '../lib/server/acharya-source';

const output = resolve('lib/domain/acharya-catalog.snapshot.json');
const cachePath = resolve('.local/acharya-refresh-cache.json');
const args = new Set(process.argv.slice(2));
if ([...args].some((arg) => !['--check', '--recheck'].includes(arg))) {
  throw new Error('Usage: npx tsx scripts/refresh-acharya-catalog.ts [--check | --recheck]');
}
const hasLanguageEvidence = (video: AcharyaVideoCandidate) =>
  Boolean(
    video.audioLanguage?.trim() || video.autoCaptionLanguage?.trim() || selectAcharyaLecture(video),
  );
const delay = () => new Promise((done) => setTimeout(done, 1100));
type CachedVideo = { checkedAt: string; video: AcharyaVideoCandidate };
type RefreshCache = Record<string, CachedVideo>;

function validate(snapshot: AcharyaCatalogSnapshot): void {
  const ids = new Set(snapshot.candidates.map((video) => video.id));
  if (
    snapshot.channelId !== ACHARYA_CHANNEL_ID ||
    !Number.isFinite(Date.parse(snapshot.checkedAt)) ||
    !Number.isInteger(snapshot.sourceVideoCount) ||
    snapshot.sourceVideoCount < ids.size ||
    snapshot.durationCandidateCount !== snapshot.candidates.length ||
    ids.size !== snapshot.candidates.length ||
    snapshot.candidates.some(
      (video) => video.channelId !== ACHARYA_CHANNEL_ID || !/^[\w-]{11}$/.test(video.id),
    ) ||
    snapshot.unresolvedVideoIds.some((id) => !ids.has(id)) ||
    !filterAcharyaLectures(snapshot.candidates).length
  )
    throw new Error('Invalid or empty Acharya snapshot; existing file has not been changed.');
}

async function writeAtomically(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(`${path}.tmp`, `${JSON.stringify(value, null, 2)}\n`);
  await rename(`${path}.tmp`, path);
}

async function main(): Promise<void> {
  if (args.has('--check')) {
    validate(acharyaCatalogSnapshot);
    console.log(
      `Valid bundled snapshot: ${filterAcharyaLectures(acharyaCatalogSnapshot.candidates).length} English lectures; ${acharyaCatalogSnapshot.unresolvedVideoIds.length} unresolved. No network requests made.`,
    );
    return;
  }

  const cache: RefreshCache = Object.fromEntries(
    acharyaCatalogSnapshot.candidates
      .filter(hasLanguageEvidence)
      .map((video) => [video.id, { checkedAt: acharyaCatalogSnapshot.checkedAt, video }]),
  );
  try {
    const saved: unknown = JSON.parse(await readFile(cachePath, 'utf8'));
    if (saved && typeof saved === 'object' && !Array.isArray(saved)) {
      for (const [id, entry] of Object.entries(saved)) {
        const item = entry as CachedVideo;
        if (
          item?.video?.id === id &&
          item.video.channelId === ACHARYA_CHANNEL_ID &&
          Number.isFinite(Date.parse(item.checkedAt))
        )
          cache[id] = item;
      }
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }

  const listings = new Map<string, AcharyaVideoCandidate>();
  const cursors = new Set<string>();
  let cursor: AcharyaBrowseCursor | null = null;
  do {
    const page = await fetchAcharyaPage(cursor);
    for (const video of page.videos) if (!listings.has(video.id)) listings.set(video.id, video);
    cursor = page.next;
    if (cursor) {
      if (cursors.has(cursor.token) || cursors.size >= 500)
        throw new Error('Invalid/repeated channel continuation; snapshot unchanged.');
      cursors.add(cursor.token);
      await delay();
    }
  } while (cursor);
  if (!listings.size) throw new Error('Empty channel listing; snapshot unchanged.');

  const durationCandidates = [...listings.values()].filter(
    (video) =>
      typeof video.durationSeconds === 'number' &&
      video.durationSeconds >= ACHARYA_MIN_DURATION_SECONDS &&
      video.durationSeconds <= ACHARYA_MAX_DURATION_SECONDS,
  );
  console.log(
    `Read ${listings.size} unique public uploads; checking ${durationCandidates.length} duration candidates.`,
  );
  const candidates: AcharyaVideoCandidate[] = [];
  for (const [index, listing] of durationCandidates.entries()) {
    const old = cache[listing.id];
    const fresh = old && Date.now() - Date.parse(old.checkedAt) < 14 * 24 * 60 * 60 * 1000;
    if (
      !args.has('--recheck') &&
      fresh &&
      hasLanguageEvidence(old.video) &&
      old.video.title === listing.title &&
      old.video.durationSeconds === listing.durationSeconds
    ) {
      candidates.push(old.video);
      continue;
    }
    // Stop on the first failed request, including HTTP 429. Successful work is
    // cached for a later run; never replace the bundled library after a failure.
    const video = await fetchAcharyaVideo(listing);
    candidates.push(video);
    cache[video.id] = { checkedAt: new Date().toISOString(), video };
    await writeAtomically(cachePath, cache);
    console.log(
      `${index + 1}/${durationCandidates.length}: ${video.id} (${video.audioLanguage || video.autoCaptionLanguage || 'language unknown'})`,
    );
    await delay();
  }

  const snapshot: AcharyaCatalogSnapshot = {
    checkedAt: new Date().toISOString(),
    channelId: ACHARYA_CHANNEL_ID,
    sourceUrl: `${ACHARYA_CHANNEL_URL}/videos`,
    sourceVideoCount: listings.size,
    durationCandidateCount: durationCandidates.length,
    unresolvedVideoIds: candidates
      .filter((video) => !hasLanguageEvidence(video))
      .map((video) => video.id),
    candidates,
  };
  validate(snapshot);
  await writeAtomically(output, snapshot);
  console.log(
    `Saved ${filterAcharyaLectures(candidates).length} eligible English lectures; ${snapshot.unresolvedVideoIds.length} language-unverified videos remain excluded. Review the source diff before publishing.`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  console.error(
    'The bundled snapshot is unchanged. Successful metadata checks are cached locally for a later run.',
  );
  process.exitCode = 1;
});
