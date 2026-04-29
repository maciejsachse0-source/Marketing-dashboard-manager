export function startOfWeek(d: Date): Date {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  const day = r.getDay() || 7;
  r.setDate(r.getDate() - (day - 1));
  return r;
}

export function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

export function endOfDay(d: Date): Date {
  const r = new Date(d);
  r.setHours(23, 59, 59, 999);
  return r;
}

export function formatHM(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

const PL_DAYS = ['pn', 'wt', 'śr', 'cz', 'pt', 'sb', 'nd'];
const PL_MONTHS = ['sty', 'lut', 'mar', 'kwi', 'maj', 'cze', 'lip', 'sie', 'wrz', 'paź', 'lis', 'gru'];

export function formatDayLabel(d: Date): string {
  const day = (d.getDay() || 7) - 1;
  return `${PL_DAYS[day]} ${d.getDate()} ${PL_MONTHS[d.getMonth()]}`;
}

export function formatDayShort(d: Date): string {
  const day = (d.getDay() || 7) - 1;
  return `${PL_DAYS[day]} ${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function isoToInputLocal(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Format a date as an ISO 8601 week string (`YYYY-Www`) — the format
 * `<input type="week">` produces. ISO weeks start Monday and the year of the
 * week is the year of the Thursday inside that week.
 */
export function toIsoWeekString(d: Date): string {
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dayNr = (target.getDay() + 6) % 7; // 0 = Mon
  target.setDate(target.getDate() - dayNr + 3); // Thursday in current ISO week
  const firstThursday = new Date(target.getFullYear(), 0, 4);
  const firstThuDayNr = (firstThursday.getDay() + 6) % 7;
  firstThursday.setDate(firstThursday.getDate() - firstThuDayNr + 3);
  const week =
    1 + Math.round((target.getTime() - firstThursday.getTime()) / (7 * 24 * 3600 * 1000));
  return `${target.getFullYear()}-W${String(week).padStart(2, '0')}`;
}

/** Parse `YYYY-Www` (ISO week) → Monday 00:00 local of that week. */
export function isoWeekToMonday(week: string): Date | null {
  const m = /^(\d{4})-W(\d{2})$/.exec(week);
  if (!m) return null;
  const year = Number(m[1]);
  const w = Number(m[2]);
  const jan4 = new Date(year, 0, 4);
  const jan4DayNr = (jan4.getDay() + 6) % 7;
  const week1Mon = new Date(jan4);
  week1Mon.setDate(jan4.getDate() - jan4DayNr);
  const monday = new Date(week1Mon);
  monday.setDate(week1Mon.getDate() + (w - 1) * 7);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

/**
 * Compact "time until" label in Polish — e.g. "za 2d", "za 5h", "za 30 min", "JUŻ".
 * Returns `null` when target is more than `maxDays` away (callers usually want to
 * suppress the badge entirely for far-future events).
 */
export function timeUntil(target: Date, now: Date = new Date(), maxDays = 30): string | null {
  const ms = target.getTime() - now.getTime();
  if (ms <= 0) {
    if (ms > -60 * 60 * 1000) return 'TERAZ';
    return null;
  }
  const minutes = Math.floor(ms / 60000);
  if (minutes < 60) return `za ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    const remMin = minutes % 60;
    return remMin > 0 && hours < 6 ? `za ${hours}h ${remMin}min` : `za ${hours}h`;
  }
  const days = Math.floor(hours / 24);
  if (days > maxDays) return null;
  const remHours = hours % 24;
  return remHours > 0 && days < 7 ? `za ${days}d ${remHours}h` : `za ${days}d`;
}
