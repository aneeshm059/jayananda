import { describe, it, expect } from 'vitest';
import { practiceGarden } from '../lib/domain/practice-garden';
import { emptyRecords } from '../lib/domain/calculations';
import { defaultSettings, type AppState } from '../lib/domain/model';
const state = (): AppState => ({
  records: emptyRecords(),
  settings: defaultSettings,
  today: '2026-09-28',
  from: '2026-09-01',
  to: '2026-09-30',
  demo: true,
  habits: { habits: [], checkins: [] },
});
describe('gentle practice garden', () => {
  it('starts quietly with seven dates and no invented progress', () => {
    const garden = practiceGarden(state());
    expect(garden.days).toBe(0);
    expect(garden.today).toBe(false);
    expect(garden.week.map((e) => e.date)).toEqual([
      '2026-09-22',
      '2026-09-23',
      '2026-09-24',
      '2026-09-25',
      '2026-09-26',
      '2026-09-27',
      '2026-09-28',
    ]);
  });
  it('counts multiple practices on one day as one flower and ignores other dates', () => {
    const s = state();
    s.records.japa = [
      { id: 'a', date: s.today, rounds: 1 },
      { id: 'b', date: s.today, rounds: 2 },
      { id: 'c', date: '2026-09-29', rounds: 16 },
      { id: 'd', date: '2026-09-01', rounds: 16 },
    ];
    s.records.hearing = [{ id: 'h', date: s.today, durationMinutes: 10 }];
    expect(practiceGarden(s).days).toBe(1);
    expect(practiceGarden(s).today).toBe(true);
  });
  it('removes the flower if the only round is corrected to zero', () => {
    const s = state();
    s.records.japa = [{ id: 'a', date: s.today, rounds: 0, helped: 'note' }];
    s.records.hearing = [{ id: 'h', date: s.today, durationMinutes: 0 }];
    expect(practiceGarden(s).today).toBe(false);
  });
  it('celebrates wake time, reflection or a followed habit without requiring a perfect day', () => {
    const s = state();
    s.records.wake = [{ id: 'w', date: '2026-09-26', actualTime: '08:30' }];
    s.records.reflection = [{ id: 'r', date: '2026-09-27', grateful: 'A fresh beginning' }];
    s.habits.checkins = [
      { habitId: 'h', date: s.today, completed: true, notes: '', updatedAt: '' },
    ];
    expect(practiceGarden(s).days).toBe(3);
  });
  it('does not reward automatic settings, empty forms or unchecked habits', () => {
    const s = state();
    s.records.daily = [{ id: 'd', date: s.today, mode: 'ideal' }];
    s.records.wake = [{ id: 'w', date: s.today, phoneDiscipline: 'Yes' }];
    s.records.reflection = [{ id: 'r', date: s.today, remembrance: 'Sometimes', grateful: '' }];
    s.habits.checkins = [
      { habitId: 'h', date: s.today, completed: false, notes: 'A note', updatedAt: '' },
    ];
    expect(practiceGarden(s).days).toBe(0);
  });
});
