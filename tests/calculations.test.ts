import { describe, it, expect } from 'vitest';
import { defaultSettings as s, type Records, type Entry } from '../lib/domain/model';
import {
  emptyRecords,
  health,
  totals,
  period,
  consistency,
  dayComplete,
  attentionInsight,
  onDate,
} from '../lib/domain/calculations';
import {
  localDate,
  localTime,
  weekBounds,
  monthBounds,
  addDays,
  daysBetween,
  timeMinutes,
  formatMinutes,
  formatClockMinutes,
} from '../lib/domain/dates';
import { schemas, settingsSchema, dateSchema } from '../lib/domain/validation';
const d = '2026-09-24',
  entry = (x: Partial<Entry>): Entry => ({ id: crypto.randomUUID(), date: d, ...x });
describe('real-world entry boundaries', () => {
  it('rounds minutes across the hour boundary', () => {
    expect(formatMinutes(119.8)).toBe('2h 0m');
    expect(formatClockMinutes(359.8)).toBe('06:00');
  });
  it('accepts long purpose, quality and sankalpa reflections', () => {
    expect(schemas.purpose.safeParse({ date: d, text: 'a'.repeat(1000) }).success).toBe(true);
    expect(
      schemas.quality.safeParse({ date: d, quality: 'Humility', reflection: 'a'.repeat(1000) })
        .success,
    ).toBe(true);
    expect(schemas.sankalpa.safeParse({ date: d, text: 'a'.repeat(1000) }).success).toBe(true);
    expect(schemas.purpose.safeParse({ date: d, text: 'a'.repeat(10001) }).success).toBe(false);
  });
});
function complete(): Records {
  const r = emptyRecords();
  r.wake = [entry({ actualTime: '05:00', programCompleted: true })];
  r.japa = [entry({ rounds: 16, durationMinutes: 120, attention: 1 })];
  r.hearing = [entry({ durationMinutes: 60, isPrabhupada: true })];
  r.reading = [entry({ durationMinutes: 30, pages: 4, isPrabhupada: true })];
  r.krishna = [entry({ durationMinutes: 20, pagesRead: 5 })];
  r.seva = [entry({ service: 'Cleaning' })];
  r.reflection = [entry({ grateful: 'A new day' })];
  r.association = [entry({ durationMinutes: 20 })];
  return r;
}
describe('consistency, never spiritual advancement', () => {
  it('empty minimum day receives no credit for skipped practices', () =>
    expect(health(emptyRecords(), s, 'minimum')).toBe(0));
  it('empty ideal day is 0', () => expect(health(emptyRecords(), s)).toBe(0));
  it('completed external practices total 100', () => expect(health(complete(), s)).toBe(100));
  it('attention reflection counts equally at 1 and 5', () => {
    const r = complete();
    const a = health(r, s);
    r.japa[0].attention = 5;
    expect(health(r, s)).toBe(a);
  });
  it('rounds cap at the target contribution', () => {
    const r = emptyRecords();
    r.japa = [entry({ rounds: 32 })];
    expect(health(r, s)).toBe(25);
  });
  it('partial rounds are proportional', () => {
    const r = emptyRecords();
    r.japa = [entry({ rounds: 8 })];
    expect(health(r, s)).toBe(13);
  });
  it('normalizes custom weights', () => {
    const r = emptyRecords();
    r.japa = [entry({ rounds: 16 })];
    expect(health(r, { ...s, weights: { ...s.weights, japa: 50 } })).toBe(40);
  });
  it('handles zero weights defensively', () =>
    expect(
      health(emptyRecords(), {
        ...s,
        weights: Object.fromEntries(Object.keys(s.weights).map((k) => [k, 0])) as typeof s.weights,
      }),
    ).toBe(0));
  it('sums multiple Japa sessions', () => {
    const r = emptyRecords();
    r.japa = [entry({ rounds: 4 }), entry({ rounds: 8 })];
    expect(totals(r, s).rounds).toBe(12);
  });
  it('averages only recorded attention', () => {
    const r = emptyRecords();
    r.japa = [entry({ attention: 4 }), entry({ attention: 2 }), entry({ attention: null })];
    expect(totals(r, s).attention).toBe(3);
  });
  it('does not count missing wake time as midnight', () => {
    const r = emptyRecords();
    r.wake = [entry({ programCompleted: true })];
    expect(totals(r, s).earlyDays).toBe(0);
  });
  it('wake at target qualifies; late does not', () => {
    const r = emptyRecords();
    r.wake = [entry({ actualTime: '05:00' }), entry({ actualTime: '05:01' })];
    expect(totals(r, s).earlyDays).toBe(1);
  });
  it('minimum day uses distinct thresholds', () => {
    const r = complete();
    r.hearing[0].durationMinutes = 15;
    r.reading[0].durationMinutes = 10;
    r.krishna[0].durationMinutes = 10;
    r.wake = [];
    r.seva = [];
    expect(dayComplete(r, s, 'minimum')).toBe(true);
    expect(dayComplete(r, s, 'ideal')).toBe(false);
  });
  it('unique reading nights exclude zero-minute records', () => {
    const r = emptyRecords();
    r.krishna = [
      entry({ durationMinutes: 5 }),
      entry({ durationMinutes: 10 }),
      entry({ date: '2026-09-25', durationMinutes: 0 }),
    ];
    expect(totals(r, s).krishnaNights).toBe(1);
  });
  it('computes monthly consistency using all elapsed dates', () => {
    const r = emptyRecords();
    r.krishna = [entry({ durationMinutes: 20 })];
    expect(consistency(r, '2026-09-01', '2026-09-30')).toBe(3);
  });
  it('filters period boundaries inclusively', () => {
    const r = emptyRecords();
    r.japa = [
      entry({ date: '2026-09-20', rounds: 4 }),
      entry({ date: '2026-09-21', rounds: 8 }),
      entry({ date: '2026-09-27', rounds: 16 }),
      entry({ date: '2026-09-28', rounds: 4 }),
    ];
    expect(totals(period(r, ...weekBounds(d)), s).rounds).toBe(24);
  });
  it('monthly totals exclude other months', () => {
    const r = emptyRecords();
    r.hearing = [
      entry({ date: '2026-08-31', durationMinutes: 20 }),
      entry({ durationMinutes: 30 }),
    ];
    expect(totals(period(r, ...monthBounds(d)), s).hearing).toBe(30);
  });
  it('association metric uses Prabhupāda-tagged entries and Krishna Book', () => {
    const r = complete();
    r.hearing.push(entry({ durationMinutes: 80, isPrabhupada: false }));
    expect(totals(r, s).prabhupada).toBe(110);
  });
  it('does not claim patterns from too few days', () => {
    const r = emptyRecords();
    r.japa = Array.from({ length: 10 }, () => entry({ attention: 5, startTime: '05:00' }));
    expect(attentionInsight(r)).toBeNull();
  });
  it('shows a factual insight after seven distinct days', () => {
    const r = emptyRecords();
    r.japa = Array.from({ length: 7 }, (_, i) =>
      entry({ date: addDays(d, -i), attention: 4, startTime: '05:00' }),
    );
    expect(attentionInsight(r)).toContain('4.0/5');
  });
});
describe('calendar and timezone', () => {
  it('uses Kolkata local date across UTC midnight', () =>
    expect(localDate('Asia/Kolkata', new Date('2026-09-23T19:00:00Z'))).toBe('2026-09-24'));
  it('keeps Los Angeles on the preceding date', () =>
    expect(localDate('America/Los_Angeles', new Date('2026-09-24T02:00:00Z'))).toBe('2026-09-23'));
  it('handles DST day boundaries', () =>
    expect(localDate('America/New_York', new Date('2026-03-08T07:30:00Z'))).toBe('2026-03-08'));
  it('local time is 24-hour', () =>
    expect(localTime('Asia/Kolkata', new Date('2026-09-23T19:00:00Z'))).toBe('00:30'));
  it('weeks start Monday across month boundary', () =>
    expect(weekBounds('2026-10-01')).toEqual(['2026-09-28', '2026-10-04']));
  it('leap February has 29 days', () =>
    expect(daysBetween(...monthBounds('2028-02-10'))).toHaveLength(29));
  it('year boundary is preserved', () => expect(addDays('2026-12-31', 1)).toBe('2027-01-01'));
  it('time parsing', () => expect(timeMinutes('05:12')).toBe(312));
});
describe('validation', () => {
  it.each([-1, 193])('rejects invalid rounds %s', (rounds) =>
    expect(schemas.japa.safeParse({ date: d, rounds }).success).toBe(false),
  );
  it('rejects attention above 5', () =>
    expect(schemas.japa.safeParse({ date: d, rounds: 1, attention: 6 }).success).toBe(false));
  it('rejects negative minutes', () =>
    expect(
      schemas.hearing.safeParse({ date: d, title: 'Hearing', durationMinutes: -1 }).success,
    ).toBe(false));
  it('rejects reversed page ranges', () =>
    expect(
      schemas.krishna.safeParse({ date: d, durationMinutes: 10, startPage: 8, endPage: 2 }).success,
    ).toBe(false));
  it('rejects invalid dates', () => expect(dateSchema.safeParse('2026-02-30').success).toBe(false));
  it('rejects javascript URLs', () =>
    expect(
      schemas.hearing.safeParse({
        date: d,
        title: 'Hearing',
        durationMinutes: 10,
        url: 'javascript:alert(1)',
      }).success,
    ).toBe(false));
  it('rejects invalid timezone', () =>
    expect(settingsSchema.safeParse({ ...s, timezone: 'Atlantis/Nowhere' }).success).toBe(false));
  it('accepts default preferences', () => expect(settingsSchema.safeParse(s).success).toBe(true));
});
