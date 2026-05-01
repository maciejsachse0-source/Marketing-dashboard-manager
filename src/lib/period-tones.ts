/**
 * Period tone palette + date helpers — pure functions, safe to import from
 * both server and client components. The actual slider widget that uses these
 * lives in `src/components/periods-slider.tsx` (client-only).
 */

export const MONTH_PL = ['sty', 'lut', 'mar', 'kwi', 'maj', 'cze', 'lip', 'sie', 'wrz', 'paź', 'lis', 'gru'] as const;

export type PeriodTone = {
  bg: string;
  bar: string;
  thumb: string;
  ink: string;
};

const PERIOD_TONES: PeriodTone[] = [
  { bg: 'bg-amber-100', bar: 'bg-amber-300', thumb: 'bg-amber-600 border-amber-700', ink: 'text-amber-900' },
  { bg: 'bg-violet-100', bar: 'bg-violet-300', thumb: 'bg-violet-600 border-violet-700', ink: 'text-violet-900' },
  { bg: 'bg-emerald-100', bar: 'bg-emerald-300', thumb: 'bg-emerald-600 border-emerald-700', ink: 'text-emerald-900' },
  { bg: 'bg-sky-100', bar: 'bg-sky-300', thumb: 'bg-sky-600 border-sky-700', ink: 'text-sky-900' },
  { bg: 'bg-rose-100', bar: 'bg-rose-300', thumb: 'bg-rose-600 border-rose-700', ink: 'text-rose-900' },
  { bg: 'bg-stone-100', bar: 'bg-stone-300', thumb: 'bg-stone-600 border-stone-700', ink: 'text-stone-900' },
];

export function toneForIndex(idx: number): PeriodTone {
  return PERIOD_TONES[idx % PERIOD_TONES.length];
}

/** Date N days after `start` (preserves local-time hours/min). */
export function dateAt(start: Date, offsetDays: number): Date {
  const d = new Date(start);
  d.setDate(d.getDate() + offsetDays);
  return d;
}

/** Compact pl-PL date — "12 maj" or "1 cze". */
export function fmtDayMonth(d: Date): string {
  return `${d.getDate()} ${MONTH_PL[d.getMonth()]}`;
}

/** YYYY-MM-DD for `<input type="date">` round-tripping. Always local. */
export function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parseIsoDate(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}
