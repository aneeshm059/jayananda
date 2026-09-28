import type { AppState } from './model';
import { addDays, daysBetween } from './dates';

// A flower means a practice was recorded, not a rating of spiritual progress.
// Count meaningful saved activity, so a corrected zero-round entry earns no flower.
export function practiceGarden(state: AppState) {
  const week = daysBetween(addDays(state.today, -6), state.today).map((date) => {
    const r = state.records;
    const active =
      r.japa.some((e) => e.date === date && Number(e.rounds) > 0) ||
      ['hearing', 'reading', 'krishna', 'association'].some((key) =>
        r[key as 'hearing'].some((e) => e.date === date && Number(e.durationMinutes) > 0),
      ) ||
      r.wake.some(
        (e) =>
          e.date === date && (e.actualTime || e.programCompleted || e.bathCompleted || e.practices),
      ) ||
      ['seva', 'reflection', 'quality', 'sankalpa', 'prabhupada'].some((key) =>
        r[key as 'seva'].some(
          (e) =>
            e.date === date &&
            Object.entries(e).some(
              ([field, value]) =>
                !['id', 'date', 'createdAt', 'updatedAt', 'remembrance'].includes(field) &&
                typeof value === 'string' &&
                value.trim(),
            ),
        ),
      ) ||
      state.habits.checkins.some((e) => e.date === date && e.completed);
    return { date, active: !!active };
  });
  return { week, days: week.filter((d) => d.active).length, today: week.at(-1)?.active ?? false };
}
