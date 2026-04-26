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
