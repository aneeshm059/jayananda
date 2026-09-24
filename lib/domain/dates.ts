export function localDate(timezone: string, now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}
export function localTime(timezone: string, now = new Date()): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(now);
}
export function addDays(date: string, n: number): string {
  const d = new Date(date + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
export function monthBounds(date: string): [string, string] {
  const first = date.slice(0, 7) + '-01';
  const d = new Date(first + 'T12:00:00Z');
  d.setUTCMonth(d.getUTCMonth() + 1);
  return [first, addDays(d.toISOString().slice(0, 10), -1)];
}
export function weekBounds(date: string): [string, string] {
  const weekday = new Date(date + 'T12:00:00Z').getUTCDay();
  const start = addDays(date, -((weekday + 6) % 7));
  return [start, addDays(start, 6)];
}
export function daysBetween(from: string, to: string): string[] {
  const days = [];
  for (let d = from; d <= to; d = addDays(d, 1)) {
    days.push(d);
    if (days.length > 366) break;
  }
  return days;
}
export function timeMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}
export function formatMinutes(n: number): string {
  const rounded = Math.round(n);
  return rounded >= 60 ? `${Math.floor(rounded / 60)}h ${rounded % 60}m` : `${rounded} min`;
}
export function formatClockMinutes(n: number): string {
  const rounded = Math.round(n) % 1440;
  return `${String(Math.floor(rounded / 60)).padStart(2, '0')}:${String(rounded % 60).padStart(2, '0')}`;
}
export function prettyDate(
  date: string,
  options: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'long' },
): string {
  return new Intl.DateTimeFormat('en-IN', { ...options, timeZone: 'UTC' }).format(
    new Date(date + 'T12:00:00Z'),
  );
}
