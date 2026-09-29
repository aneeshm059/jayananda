import snapshot from './acharya-catalog.snapshot.json';

export type { AcharyaLibraryResponse } from './acharya-sync';

export const ACHARYA_CHANNEL_ID = 'UCDTX-lo7YZCg_P28_Mo4NOg';
export const ACHARYA_CHANNEL_URL = `https://www.youtube.com/channel/${ACHARYA_CHANNEL_ID}`;
export const ACHARYA_UPLOADS_PLAYLIST_ID = 'UUDTX-lo7YZCg_P28_Mo4NOg';
export const ACHARYA_UPLOADS_URL = `https://www.youtube.com/playlist?list=${ACHARYA_UPLOADS_PLAYLIST_ID}`;
export const ACHARYA_MIN_DURATION_SECONDS = 30 * 60;
export const ACHARYA_MAX_DURATION_SECONDS = 45 * 60;

export type AcharyaVideoCandidate = {
  id: string;
  title: string;
  channelId: string;
  durationSeconds: number | null;
  /** Language of the original/default audio, never the title's language. */
  audioLanguage?: string;
  /** Original ASR track for the default/sole audio track, never translated subtitles. */
  autoCaptionLanguage?: string;
  publishedAt?: string;
  isShort?: boolean;
  embeddable?: boolean;
  playabilityStatus?: string;
};

export type AcharyaLecture = {
  id: string;
  title: string;
  durationSeconds: number;
  language: 'en';
  languageEvidence: 'title' | 'audio-language' | 'asr-captions';
  publishedAt?: string;
};

export type AcharyaCatalogSnapshot = {
  checkedAt: string;
  channelId: string;
  sourceUrl: string;
  sourceVideoCount: number;
  durationCandidateCount: number;
  unresolvedVideoIds: string[];
  candidates: AcharyaVideoCandidate[];
};

const englishLanguageTag = /^en(?:-[a-z0-9]{2,8})*$/i;
const explicitlyEnglishLecture =
  /\b(?:english(?:[ -]+language)?[ -]+(?:lecture|class|discourse)|(?:lecture|class|discourse)(?:\s+in\s+|\s*[-:|–—]\s*)english)\b/i;
const explicitlyHindi = /\bhindi\b|हिन्दी|हिंदी/i;

export function selectAcharyaLecture(video: AcharyaVideoCandidate): AcharyaLecture | null {
  if (
    video.channelId !== ACHARYA_CHANNEL_ID ||
    !/^[A-Za-z0-9_-]{11}$/.test(video.id) ||
    typeof video.title !== 'string' ||
    !video.title.trim() ||
    typeof video.durationSeconds !== 'number' ||
    !Number.isFinite(video.durationSeconds) ||
    video.durationSeconds < ACHARYA_MIN_DURATION_SECONDS ||
    video.durationSeconds > ACHARYA_MAX_DURATION_SECONDS ||
    video.isShort === true ||
    video.embeddable === false ||
    (video.playabilityStatus !== undefined && video.playabilityStatus !== 'OK') ||
    explicitlyHindi.test(video.title)
  )
    return null;

  const audioLanguage = video.audioLanguage?.trim();
  const asrLanguage = video.autoCaptionLanguage?.trim();
  // A Latin-script title, a translated title, and English subtitles do not
  // establish spoken English. Conflicting known audio/ASR evidence fails closed.
  if (
    (audioLanguage && !englishLanguageTag.test(audioLanguage)) ||
    (asrLanguage && !englishLanguageTag.test(asrLanguage))
  )
    return null;
  const languageEvidence: AcharyaLecture['languageEvidence'] | null =
    audioLanguage && englishLanguageTag.test(audioLanguage)
      ? 'audio-language'
      : asrLanguage && englishLanguageTag.test(asrLanguage)
        ? 'asr-captions'
        : explicitlyEnglishLecture.test(video.title)
          ? 'title'
          : null;
  if (!languageEvidence) return null;

  const publishedAt =
    video.publishedAt && Number.isFinite(Date.parse(video.publishedAt))
      ? new Date(video.publishedAt).toISOString()
      : undefined;
  return {
    id: video.id,
    title: video.title,
    durationSeconds: video.durationSeconds,
    language: 'en',
    languageEvidence,
    ...(publishedAt ? { publishedAt } : {}),
  };
}

/** Preserve the source order and stable video IDs; this never edits user progress. */
export function filterAcharyaLectures(videos: readonly AcharyaVideoCandidate[]): AcharyaLecture[] {
  const seen = new Set<string>();
  const lectures: AcharyaLecture[] = [];
  for (const video of videos) {
    const lecture = selectAcharyaLecture(video);
    if (!lecture || seen.has(lecture.id)) continue;
    seen.add(lecture.id);
    lectures.push(lecture);
  }
  return lectures;
}

export const acharyaCatalogSnapshot: AcharyaCatalogSnapshot = snapshot;
export const bundledAcharyaCandidates: AcharyaVideoCandidate[] = acharyaCatalogSnapshot.candidates;
export const bundledAcharyaLectures: AcharyaLecture[] =
  filterAcharyaLectures(bundledAcharyaCandidates);
