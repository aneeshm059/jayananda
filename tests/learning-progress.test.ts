import { describe, expect, it } from 'vitest';
import { playbackCredit, playbackTime, splitWatchCredit } from '../lib/domain/learning-progress';

describe('actual learning time', () => {
  it('credits wall-clock time at normal and accelerated playback rates', () => {
    expect(playbackCredit(100, 101, 1)).toBe(1);
    expect(playbackCredit(100, 102, 1, 2)).toBe(1);
    expect(playbackCredit(100, 100.5, 1, 0.5)).toBe(1);
  });
  it('does not reward seeking, replay jumps, pauses, or a suspended browser', () => {
    expect(playbackCredit(100, 300, 1)).toBe(0);
    expect(playbackCredit(100, 90, 1)).toBe(0);
    expect(playbackCredit(100, 100, 1)).toBe(0);
    expect(playbackCredit(100, 160, 60)).toBe(0);
    expect(playbackCredit(100, Infinity, 1)).toBe(0);
    expect(playbackCredit(100, 101, 1, 0)).toBe(0);
  });
  it('splits a sample across midnight in the account timezone', () => {
    expect(splitWatchCredit(2, new Date('2026-09-28T18:30:01Z'), 'Asia/Kolkata')).toEqual({
      '2026-09-28': 1,
      '2026-09-29': 1,
    });
    expect(splitWatchCredit(2, new Date('2026-09-28T18:30:01Z'), 'America/New_York')).toEqual({
      '2026-09-28': 2,
    });
  });
  it('credits a sample ending exactly at midnight wholly to the previous day', () => {
    expect(splitWatchCredit(1, new Date('2026-09-28T18:30:00Z'), 'Asia/Kolkata')).toEqual({
      '2026-09-28': 1,
    });
  });
  it('ignores invalid samples and renders finite playback labels', () => {
    expect(splitWatchCredit(-1, new Date(), 'UTC')).toEqual({});
    expect(playbackTime(Infinity)).toBe('0:00');
    expect(playbackTime(3661.9)).toBe('61:01');
  });
});
