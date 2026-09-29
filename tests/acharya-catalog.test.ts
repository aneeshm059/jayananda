import { describe, expect, it } from 'vitest';
import {
  ACHARYA_CHANNEL_ID,
  ACHARYA_MIN_DURATION_SECONDS,
  ACHARYA_MAX_DURATION_SECONDS,
  acharyaCatalogSnapshot,
  bundledAcharyaLectures,
  filterAcharyaLectures,
  selectAcharyaLecture,
  type AcharyaVideoCandidate,
} from '../lib/domain/acharya-catalog';

const video: AcharyaVideoCandidate = {
  id: 'tzvTRToR6ls',
  title: 'Chanting Krishna Is Direct Association | SB 3.25.5-6 | Mumbai, India | Srila Prabhupada',
  channelId: ACHARYA_CHANNEL_ID,
  durationSeconds: 2669,
  autoCaptionLanguage: 'en',
};

describe('The Acharya English 30–45 minute library', () => {
  it('accepts both exact duration boundaries and rejects out-of-range or missing lengths', () => {
    for (const durationSeconds of [ACHARYA_MIN_DURATION_SECONDS, ACHARYA_MAX_DURATION_SECONDS])
      expect(selectAcharyaLecture({ ...video, durationSeconds })).not.toBeNull();
    for (const durationSeconds of [1799, 2701, null, NaN, Infinity])
      expect(selectAcharyaLecture({ ...video, durationSeconds })).toBeNull();
  });

  it('requires spoken-English evidence, not an English-looking title or translated subtitles', () => {
    expect(selectAcharyaLecture({ ...video, autoCaptionLanguage: undefined })).toBeNull();
    expect(selectAcharyaLecture({ ...video, autoCaptionLanguage: 'hi' })).toBeNull();
    expect(selectAcharyaLecture({ ...video, autoCaptionLanguage: 'bn' })).toBeNull();
    expect(
      selectAcharyaLecture({
        ...video,
        autoCaptionLanguage: undefined,
        title: 'Lecture with English subtitles',
      }),
    ).toBeNull();
    expect(
      selectAcharyaLecture({
        ...video,
        autoCaptionLanguage: undefined,
        title: 'Srila Prabhupada English Lecture',
      })?.languageEvidence,
    ).toBe('title');
    expect(
      selectAcharyaLecture({ ...video, autoCaptionLanguage: undefined, audioLanguage: 'en-US' })
        ?.languageEvidence,
    ).toBe('audio-language');
    expect(selectAcharyaLecture(video)?.languageEvidence).toBe('asr-captions');
  });

  it('rejects Hindi or conflicting language metadata even with an English label', () => {
    expect(
      selectAcharyaLecture({ ...video, title: 'Hindi lecture with English translation' }),
    ).toBeNull();
    expect(
      selectAcharyaLecture({
        ...video,
        title: 'Srila Prabhupada English Lecture',
        audioLanguage: 'hi',
      }),
    ).toBeNull();
    expect(
      selectAcharyaLecture({ ...video, audioLanguage: 'en', autoCaptionLanguage: 'hi' }),
    ).toBeNull();
  });

  it('uses only this channel and excludes unavailable, non-embeddable, or short-form videos', () => {
    expect(selectAcharyaLecture({ ...video, channelId: 'another-channel' })).toBeNull();
    expect(selectAcharyaLecture({ ...video, id: '../invalid-id' })).toBeNull();
    expect(selectAcharyaLecture({ ...video, isShort: true })).toBeNull();
    expect(selectAcharyaLecture({ ...video, embeddable: false })).toBeNull();
    expect(selectAcharyaLecture({ ...video, playabilityStatus: 'LOGIN_REQUIRED' })).toBeNull();
  });

  it('deduplicates stable video IDs without mutating source data', () => {
    const input = [video, { ...video, id: 'QnsSiYXxEqI', durationSeconds: 1877 }, video];
    const original = structuredClone(input);
    expect(filterAcharyaLectures(input).map((item) => item.id)).toEqual([
      'tzvTRToR6ls',
      'QnsSiYXxEqI',
    ]);
    expect(input).toEqual(original);
  });

  it('bundles a populated source-backed snapshot whose videos all satisfy the shared filter', () => {
    expect(acharyaCatalogSnapshot.channelId).toBe(ACHARYA_CHANNEL_ID);
    expect(acharyaCatalogSnapshot.candidates).toHaveLength(
      acharyaCatalogSnapshot.durationCandidateCount,
    );
    expect(acharyaCatalogSnapshot.sourceVideoCount).toBeGreaterThan(
      acharyaCatalogSnapshot.durationCandidateCount,
    );
    expect(bundledAcharyaLectures.length).toBeGreaterThan(0);
    expect(new Set(bundledAcharyaLectures.map((item) => item.id)).size).toBe(
      bundledAcharyaLectures.length,
    );
    expect(bundledAcharyaLectures).toEqual(
      filterAcharyaLectures(acharyaCatalogSnapshot.candidates),
    );
  });
});
