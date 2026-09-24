import { collections, type Records, type Settings, type Entry, type Mode } from './model';
import { daysBetween, timeMinutes } from './dates';
export function emptyRecords(): Records {
  return Object.fromEntries(collections.map((k) => [k, [] as Entry[]])) as Records;
}
export function onDate(records: Records, date: string): Records {
  return Object.fromEntries(
    collections.map((k) => [k, records[k].filter((r) => r.date === date)]),
  ) as Records;
}
export function sum(entries: Entry[], key: string): number {
  return entries.reduce((n, e) => n + (typeof e[key] === 'number' ? Number(e[key]) : 0), 0);
}
export function average(entries: Entry[], key: string): number | null {
  const values = entries.filter((e) => typeof e[key] === 'number');
  return values.length ? sum(values, key) / values.length : null;
}
export function totals(r: Records, s: Settings) {
  const wakes = r.wake.filter((e) => typeof e.actualTime === 'string');
  return {
    rounds: sum(r.japa, 'rounds'),
    japaMinutes: sum(r.japa, 'durationMinutes'),
    attention: average(r.japa, 'attention'),
    hearing: sum(r.hearing, 'durationMinutes'),
    reading: sum(r.reading, 'durationMinutes'),
    readingPages: sum(r.reading, 'pages'),
    krishna: sum(r.krishna, 'durationMinutes'),
    krishnaNights: new Set(
      r.krishna.filter((e) => Number(e.durationMinutes) > 0).map((e) => e.date),
    ).size,
    krishnaPages: sum(r.krishna, 'pagesRead'),
    chapters: r.krishna.filter((e) => e.chapterCompleted).length,
    currentChapter:
      r.krishna
        .filter((e) => Number(e.chapterNumber) > 0)
        .sort(
          (a, b) =>
            b.date.localeCompare(a.date) || (b.createdAt ?? '').localeCompare(a.createdAt ?? ''),
        )[0]?.chapterNumber ?? null,
    seva: r.seva.length,
    association: sum(r.association, 'durationMinutes'),
    reflections: new Set(r.reflection.map((e) => e.date)).size,
    earlyDays: wakes.filter((e) => timeMinutes(String(e.actualTime)) <= timeMinutes(s.wakeTarget))
      .length,
    averageWake: wakes.length
      ? wakes.reduce((v, e) => v + timeMinutes(String(e.actualTime)), 0) / wakes.length
      : null,
    prabhupada:
      sum(
        r.hearing.filter((e) => e.isPrabhupada),
        'durationMinutes',
      ) +
      sum(
        r.reading.filter((e) => e.isPrabhupada),
        'durationMinutes',
      ) +
      sum(r.krishna, 'durationMinutes'),
  };
}
export function health(r: Records, s: Settings, mode: Mode = 'ideal'): number {
  const t = s[mode];
  const v = totals(r, s);
  const ratio = (n: number, target: number) => (target > 0 ? Math.min(1, n / target) : 1);
  const morningChecks = [
    ...(t.wake ? [v.earlyDays > 0] : []),
    ...(t.morning ? [!!r.wake[0]?.programCompleted] : []),
  ];
  const values = {
    morning: morningChecks.length ? morningChecks.filter(Boolean).length / morningChecks.length : 1,
    japa: ratio(v.rounds, t.japa),
    quality: r.japa.some((e) => e.attention != null) ? 1 : 0,
    hearing: ratio(v.hearing, t.hearing),
    reading: ratio(v.reading, t.reading),
    krishna: ratio(v.krishna, t.krishna),
    seva: !t.seva || v.seva > 0 ? 1 : 0,
    reflection: !t.reflection || v.reflections > 0 ? 1 : 0,
    association: r.association.length > 0 ? 1 : 0,
  };
  const active = Object.entries(s.weights).filter(([k]) =>
    k === 'morning'
      ? t.wake || t.morning
      : k === 'seva'
        ? t.seva
        : k === 'reflection'
          ? t.reflection
          : ['hearing', 'reading', 'krishna'].includes(k)
            ? t[k as 'hearing' | 'reading' | 'krishna'] > 0
            : true,
  );
  const weight = active.reduce((a, [, b]) => a + b, 0);
  return weight
    ? Math.round(
        (active.reduce((a, [k, w]) => a + w * values[k as keyof typeof values], 0) / weight) * 100,
      )
    : 0;
}
export function period(records: Records, from: string, to: string): Records {
  return Object.fromEntries(
    collections.map((k) => [k, records[k].filter((e) => e.date >= from && e.date <= to)]),
  ) as Records;
}
export function consistency(r: Records, from: string, to: string): number {
  const days = daysBetween(from, to);
  return days.length
    ? Math.round(
        (new Set(
          r.krishna
            .filter((e) => e.date >= from && e.date <= to && Number(e.durationMinutes) > 0)
            .map((e) => e.date),
        ).size /
          days.length) *
          100,
      )
    : 0;
}
export function dayMode(r: Records): Mode {
  return r.daily[0]?.mode === 'minimum' ? 'minimum' : 'ideal';
}
export function dayComplete(r: Records, s: Settings, mode: Mode): boolean {
  const t = s[mode],
    v = totals(r, s);
  return (
    v.rounds >= t.japa &&
    v.hearing >= t.hearing &&
    v.reading >= t.reading &&
    v.krishna >= t.krishna &&
    (!t.wake || v.earlyDays > 0) &&
    (!t.morning || !!r.wake[0]?.programCompleted) &&
    (!t.seva || v.seva > 0) &&
    (!t.reflection || v.reflections > 0)
  );
}
export function attentionInsight(r: Records): string | null {
  const early = r.japa.filter(
    (e) => e.startTime && String(e.startTime) < '06:00' && e.attention != null,
  );
  if (new Set(early.map((e) => e.date)).size < 7) return null;
  return `Your attention averaged ${average(early, 'attention')?.toFixed(1)}/5 across ${new Set(early.map((e) => e.date)).size} days with Japa sessions beginning before 6 AM.`;
}
