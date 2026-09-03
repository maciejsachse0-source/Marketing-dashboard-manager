/** Etykiety, stałe i drobne funkcje daty wspólne dla edytora szablonu produkcji.
 *  Wydzielone z `template-form.tsx` przy rozbiciu pliku (F3-07), treść bez zmian. */
import type {
  ProductionStage,
  ProductionType,
  StepCalendarType,
  StepDateMode,
} from '../../../drizzle/schema';
import type { TemplatePeriod } from '@/lib/production-periods';
import { DEFAULT_PERIODS, codeForIndex } from '@/lib/production-periods';


export const TYPE_LABEL: Record<ProductionType, string> = {
  'with-artist': 'Z artystą',
  solo: 'Solo',
};

export const CATEGORY_ORDER: ProductionStage[] = [
  'outreach',
  'ustalenia',
  'nagrywanie',
  'obrobka',
  'publikacja',
];

export const DATE_MODE_LABEL: Record<StepDateMode, string> = {
  none: 'brak daty',
  record: 'tylko data (bez kalendarza)',
  calendar: 'data + wpis w kalendarzu',
  'derived-from-shooting': 'auto z innego kroku (wycofywane)',
};

/** Existing templates persisted before the 0-anchored period model used
 *  negative offsets. We shift them into the new range on load so the editor
 *  doesn't refuse to render them — the relative spacing is preserved. */
export function migrateLegacyPeriods(input: TemplatePeriod[] | undefined): TemplatePeriod[] {
  if (!input || input.length === 0) return DEFAULT_PERIODS;
  const min = Math.min(...input.map((p) => p.startOffsetDays));
  const shift = min < 0 ? -min : 0;
  return input.map((p, i) => ({
    code: codeForIndex(i),
    startOffsetDays: Math.max(0, p.startOffsetDays + shift),
    endOffsetDays: Math.max(0, p.endOffsetDays + shift),
  }));
}

export const CALENDAR_TYPE_LABEL: Record<StepCalendarType, string> = {
  shoot: 'Nagrywka',
  edit: 'Obróbka',
  meeting: 'Spotkanie',
  deadline: 'Deadline',
};

export function newStepId(): string {
  return Math.random().toString(36).slice(2, 14);
}

export const MONTH_PL = ['sty', 'lut', 'mar', 'kwi', 'maj', 'cze', 'lip', 'sie', 'wrz', 'paź', 'lis', 'gru'] as const;

/** Date N days after `start` (preserves local-time hours/min so the picker
 *  doesn't drift across DST). */
export function dateAt(start: Date, offsetDays: number): Date {
  const d = new Date(start);
  d.setDate(d.getDate() + offsetDays);
  return d;
}

/** Compact pl-PL date — "12 maj" or "1 cze". Used as axis tick labels and
 *  in period range chips so the user reads concrete days, not just offsets. */
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

/** Default preview anchor: the next Monday from today (incl. today if it is
 *  Monday). Matches the historical Mon-anchored grid so default 7-day periods
 *  visually align with calendar weeks on first open. */
export function nextMonday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  // JS getDay: 0=Sun..6=Sat → re-base to 0=Mon..6=Sun.
  const dowMon = (d.getDay() + 6) % 7;
  const offset = dowMon === 0 ? 0 : 7 - dowMon;
  d.setDate(d.getDate() + offset);
  return d;
}

export type Tone = {
  bg: string;
  border: string;
  badge: string;
  chip: string;
  dot: string;
  rail: string;
};

export const PERIOD_TONES: Array<{ bg: string; bar: string; thumb: string; ink: string }> = [
  { bg: 'bg-amber-100', bar: 'bg-amber-300', thumb: 'bg-amber-600 border-amber-700', ink: 'text-amber-900' },
  { bg: 'bg-violet-100', bar: 'bg-violet-300', thumb: 'bg-violet-600 border-violet-700', ink: 'text-violet-900' },
  { bg: 'bg-emerald-100', bar: 'bg-emerald-300', thumb: 'bg-emerald-600 border-emerald-700', ink: 'text-emerald-900' },
  { bg: 'bg-sky-100', bar: 'bg-sky-300', thumb: 'bg-sky-600 border-sky-700', ink: 'text-sky-900' },
  { bg: 'bg-rose-100', bar: 'bg-rose-300', thumb: 'bg-rose-600 border-rose-700', ink: 'text-rose-900' },
  { bg: 'bg-stone-100', bar: 'bg-stone-300', thumb: 'bg-stone-600 border-stone-700', ink: 'text-stone-900' },
];
