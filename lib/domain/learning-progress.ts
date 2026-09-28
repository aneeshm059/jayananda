import type { CourseProgress } from './companion';
import type { Lesson } from './learning-catalog';
import { localDate } from './dates';

export const emptyCourseProgress = (): CourseProgress => ({
  currentVideoId: '',
  lessons: {},
  watchedByDay: {},
  reminderTime: '',
  lastPracticedDate: '',
});
export function playbackCredit(previous: number, current: number, elapsed: number, rate = 1) {
  if (
    ![previous, current, elapsed, rate].every(Number.isFinite) ||
    elapsed <= 0 ||
    elapsed > 5 ||
    rate <= 0
  )
    return 0;
  const movement = current - previous;
  if (movement <= 0 || Math.abs(movement - elapsed * rate) > 2) return 0;
  return Math.min(elapsed, movement / rate);
}

// A short playback sample can cross the account's local midnight. Split that
// actual watched time instead of attributing yesterday's seconds to today.
export function splitWatchCredit(
  seconds: number,
  endedAt: Date,
  timezone: string,
): Record<string, number> {
  if (
    !Number.isFinite(seconds) ||
    seconds <= 0 ||
    seconds > 5 ||
    !Number.isFinite(endedAt.getTime())
  )
    return {};
  const end = endedAt.getTime(),
    start = end - seconds * 1000;
  const firstDate = localDate(timezone, new Date(start));
  const finalDate = localDate(timezone, new Date(end - 1));
  if (firstDate === finalDate) return { [firstDate]: seconds };
  let low = Math.floor(start),
    high = end;
  while (high - low > 1) {
    const middle = Math.floor((low + high) / 2);
    if (localDate(timezone, new Date(middle)) === firstDate) low = middle;
    else high = middle;
  }
  return { [firstDate]: (high - start) / 1000, [finalDate]: (end - high) / 1000 };
}
export function nextLesson(lessons: Lesson[], id: string): Lesson | undefined {
  const index = lessons.findIndex((l) => l.id === id);
  return index >= 0 ? lessons[index + 1] : undefined;
}
export function playbackTime(seconds: number) {
  const safe = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, '0')}`;
}
