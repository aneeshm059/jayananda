import { describe, it, expect } from 'vitest';
import { defaultSettings, type AppState, type Entry } from '../lib/domain/model';
import { emptyRecords } from '../lib/domain/calculations';
import { recordedFields, todayReport } from '../lib/domain/today-report';
import { latestCountedSession, decrementJapaSchema } from '../lib/domain/japa';
const date = '2026-09-27';
const entry = (values: Partial<Entry>): Entry => ({ id: crypto.randomUUID(), date, ...values });
function state(): AppState {
  return {
    settings: structuredClone(defaultSettings),
    records: emptyRecords(),
    today: date,
    from: date,
    to: date,
    demo: true,
    habits: { habits: [], checkins: [] },
  };
}
describe('today report', () => {
  it('identifies missing daily targets without treating optional practices as pending', () => {
    const report = todayReport(state());
    expect(report.remaining).toBe(8);
    expect(report.completed).toBe(0);
    expect(report.pending.map((e) => e.key)).not.toContain('association');
  });
  it('adds today’s sessions and reports partial progress separately from missing entries', () => {
    const s = state();
    s.records.japa = [
      entry({ rounds: 4 }),
      entry({ rounds: 5 }),
      entry({ date: '2026-09-26', rounds: 16 }),
    ];
    const report = todayReport(s);
    expect(report.values.rounds).toBe(9);
    expect(report.pending.find((e) => e.key === 'japa')?.detail).toBe(
      '9 / 16 rounds · 7 rounds remaining',
    );
    expect(report.records.japa).toHaveLength(2);
  });
  it('shows a late wake time as recorded, without asking for it again', () => {
    const s = state();
    s.records.wake = [entry({ actualTime: '07:45', programCompleted: false })];
    const report = todayReport(s);
    expect(report.pending.map((e) => e.key)).not.toContain('wake');
    expect(report.pending.map((e) => e.key)).toContain('morning');
    expect(report.items.find((e) => e.key === 'wake')?.detail).toContain('07:45');
  });
  it('uses minimum day targets and allows zero targets', () => {
    const s = state();
    s.records.daily = [entry({ mode: 'minimum' })];
    s.settings.minimum.japa = 0;
    s.records.hearing = [entry({ durationMinutes: 15 })];
    const report = todayReport(s);
    expect(report.pending.map((e) => e.key)).toEqual(['reading', 'krishna', 'reflection']);
    expect(report.total).toBe(4);
  });
  it('counts only active habits, retains unchecked notes and recorded archived habits', () => {
    const s = state();
    const base = {
      name: 'Habit',
      intention: 'Practice',
      startDate: date,
      endDate: date,
      archived: false,
      starterKey: null,
      createdAt: date,
      updatedAt: date,
      followedDays: 0,
    };
    s.habits.habits = [
      { ...base, id: 'active' },
      { ...base, id: 'upcoming', startDate: '2026-09-28' },
      { ...base, id: 'archived', archived: true },
      { ...base, id: 'ended', endDate: '2026-09-26' },
    ];
    s.habits.checkins = [
      { habitId: 'active', date, completed: false, notes: 'Tried with care.', updatedAt: date },
      {
        habitId: 'archived',
        date,
        completed: true,
        notes: 'Saved before archiving.',
        updatedAt: date,
      },
    ];
    const report = todayReport(s);
    expect(report.pendingHabits.map((e) => e.habit.id)).toEqual(['active']);
    expect(report.habits).toHaveLength(2);
    expect(report.habits[0].checkin?.notes).toBe('Tried with care.');
    expect(report.total).toBe(9);
  });
  it('includes the individual morning practices selected in the wake-up form', () => {
    expect(
      recordedFields('wake', entry({ practices: 'Personal prayer|Guru Puja' })),
    ).toContainEqual({ label: 'My morning practices', value: 'Personal prayer · Guru Puja' });
  });
  it('does not treat a previous day’s habit check as complete today', () => {
    const s = state();
    s.habits.habits = [
      {
        id: 'habit',
        name: 'Practice',
        intention: 'Daily',
        startDate: '2026-09-01',
        endDate: '2027-09-01',
        archived: false,
        starterKey: null,
        followedDays: 1,
        createdAt: date,
        updatedAt: date,
      },
    ];
    s.habits.checkins = [
      { habitId: 'habit', date: '2026-09-26', completed: true, notes: '', updatedAt: date },
    ];
    expect(todayReport(s).pendingHabits).toHaveLength(1);
  });
  it('exposes all saved form details, preserves zero/false, and omits absent fields', () => {
    expect(
      recordedFields(
        'japa',
        entry({ rounds: 0, durationMinutes: 22, helped: 'Listen\ncarefully', attention: null }),
      ),
    ).toEqual([
      { label: 'Rounds', value: '0' },
      { label: 'Minutes', value: '22' },
      { label: 'What helped me chant better?', value: 'Listen\ncarefully' },
    ]);
    expect(
      recordedFields('wake', entry({ actualTime: '06:00', programCompleted: false })),
    ).toContainEqual({ label: 'Morning program completed', value: 'No' });
  });
});
describe('Japa correction', () => {
  it('selects the latest positive session for the requested date, without mutating records', () => {
    const entries = [
      entry({ id: 'older', rounds: 5, createdAt: '2026-09-27T04:00:00Z' }),
      entry({ id: 'latest', rounds: 1, createdAt: '2026-09-27T05:00:00Z' }),
      entry({ id: 'empty', rounds: 0, createdAt: '2026-09-27T06:00:00Z' }),
      entry({ id: 'other-day', date: '2026-09-28', rounds: 16 }),
    ];
    const before = structuredClone(entries);
    expect(latestCountedSession(entries, date)?.id).toBe('latest');
    expect(entries).toEqual(before);
    expect(latestCountedSession(entries, '2026-09-01')).toBeUndefined();
  });
  it('requires a positive count and version for a correction', () => {
    const input = {
      id: 'session',
      date,
      expectedRounds: 1,
      expectedUpdatedAt: '2026-09-27T05:00:00.000Z',
    };
    expect(decrementJapaSchema.safeParse(input).success).toBe(true);
    expect(decrementJapaSchema.safeParse({ ...input, expectedRounds: 0 }).success).toBe(false);
    expect(decrementJapaSchema.safeParse({ ...input, expectedRounds: -1 }).success).toBe(false);
    expect(decrementJapaSchema.safeParse({ ...input, userId: 'other' }).success).toBe(false);
  });
});
