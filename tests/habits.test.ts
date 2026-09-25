import { describe, it, expect } from 'vitest';
import {
  habitSchema,
  habitCheckinSchema,
  habitStatus,
  oneYearEnd,
  elapsedHabitDays,
  habitMonthSummary,
  calendarDayCount,
} from '../lib/domain/habits';
import { localDate } from '../lib/domain/dates';

const habit = { startDate: '2026-09-25', endDate: '2027-09-24', archived: false };
describe('daily habits and calendar boundaries', () => {
  it('a normal calendar-year commitment includes 365 days', () => {
    expect(oneYearEnd('2026-09-25')).toBe('2027-09-24');
    expect(calendarDayCount(habit.startDate, habit.endDate)).toBe(365);
  });
  it('a commitment crossing February 29 includes the leap day', () => {
    expect(calendarDayCount('2023-09-25', oneYearEnd('2023-09-25'))).toBe(366);
    expect(oneYearEnd('2024-02-29')).toBe('2025-02-28');
  });
  it('automatically derives today in the account timezone across UTC midnight', () => {
    const clock = new Date('2026-09-24T20:00:00Z');
    expect(localDate('Asia/Kolkata', clock)).toBe('2026-09-25');
    expect(localDate('America/Los_Angeles', clock)).toBe('2026-09-24');
  });
  it('future commitments and their first day have no completed past days', () => {
    expect(elapsedHabitDays(habit, '2026-09-20')).toBe(0);
    expect(elapsedHabitDays(habit, '2026-09-25')).toBe(0);
    expect(elapsedHabitDays(habit, '2026-09-26')).toBe(1);
  });
  it('elapsed days stop at the commitment end', () => {
    expect(elapsedHabitDays(habit, '2028-01-01')).toBe(365);
  });
  it('uses inclusive start/end dates for active habits', () => {
    expect(habitStatus(habit, habit.startDate)).toBe('Active');
    expect(habitStatus(habit, habit.endDate)).toBe('Active');
    expect(habitStatus(habit, '2027-09-25')).toBe('Finished');
    expect(habitStatus(habit, '2026-09-24')).toBe('Upcoming');
    expect(habitStatus({ ...habit, archived: true }, '2026-09-25')).toBe('Archived');
  });
  it('accepts a one-day commitment and rejects reversed dates', () => {
    expect(
      habitSchema.safeParse({ ...habit, archived: undefined, name: 'Test', intention: 'Test' })
        .success,
    ).toBe(false);
    expect(
      habitSchema.safeParse({
        name: 'Test',
        intention: 'Test',
        startDate: '2026-09-25',
        endDate: '2026-09-25',
      }).success,
    ).toBe(true);
    expect(
      habitSchema.safeParse({
        name: 'Test',
        intention: 'Test',
        startDate: '2026-09-25',
        endDate: '2026-09-24',
      }).success,
    ).toBe(false);
  });
  it('rejects submitted dates and ownership fields in daily check-ins', () => {
    expect(habitCheckinSchema.safeParse({ completed: true, date: '2026-09-01' }).success).toBe(
      false,
    );
    expect(habitCheckinSchema.safeParse({ completed: true, userId: 'another-user' }).success).toBe(
      false,
    );
  });
  it('only accepts commitment years that the history calendar supports', () => {
    expect(
      habitSchema.safeParse({
        name: 'Test',
        intention: 'Test',
        startDate: '1899-12-31',
        endDate: '1900-01-01',
      }).success,
    ).toBe(false);
    expect(
      habitSchema.safeParse({
        name: 'Test',
        intention: 'Test',
        startDate: '9998-12-31',
        endDate: '9999-01-01',
      }).success,
    ).toBe(false);
  });
  it('allows notes without marking a habit followed, and explicit unticking', () => {
    expect(habitCheckinSchema.parse({ notes: 'A quiet observation' })).toEqual({
      notes: 'A quiet observation',
    });
    expect(habitCheckinSchema.parse({ completed: false })).toEqual({ completed: false });
    expect(habitCheckinSchema.safeParse({}).success).toBe(false);
    expect(habitCheckinSchema.safeParse({ notes: 'a'.repeat(10001) }).success).toBe(false);
  });
  it('monthly consistency excludes today, future days and days outside the commitment', () => {
    const entries = ['2026-09-24', '2026-09-25', '2026-09-26', '2026-09-28'].map((date) => ({
      habitId: 'h',
      date,
      completed: true,
      notes: '',
      updatedAt: '',
    }));
    expect(habitMonthSummary(habit, entries, '2026-09-01', '2026-09-30', '2026-09-26')).toEqual({
      days: 1,
      followed: 1,
      percent: 100,
    });
  });
  it('reports not-yet-started months without a misleading zero percent', () => {
    expect(habitMonthSummary(habit, [], '2026-10-01', '2026-10-31', '2026-09-26')).toEqual({
      days: 0,
      followed: 0,
      percent: null,
    });
  });
  it('notes alone and unmarked dates never count as followed', () => {
    const entries = [
      { habitId: 'h', date: '2026-09-25', completed: false, notes: 'Reflection', updatedAt: '' },
    ];
    expect(habitMonthSummary(habit, entries, '2026-09-01', '2026-09-30', '2026-09-27')).toEqual({
      days: 2,
      followed: 0,
      percent: 0,
    });
  });
});
