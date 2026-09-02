/** Drobne funkcje pomocnicze edytora szablonu kampanii. Wydzielone
 *  z `campaign-template-form.tsx` przy rozbiciu pliku (F3-08), treść bez zmian. */
import {
  DEFAULT_PERIODS,
  codeForIndex,
  type TemplatePeriod,
} from '@/lib/production-periods';

export function newId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Default preview anchor: next Monday from today. Used so the slider's
 *  date axis lines up with calendar weeks on first open. Templates don't
 *  persist this — campaigns derive their concrete dates from `kickoffAt`. */
export function nextMonday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  const dowMon = (d.getDay() + 6) % 7;
  const offset = dowMon === 0 ? 0 : 7 - dowMon;
  d.setDate(d.getDate() + offset);
  return d;
}

/** Existing templates persisted before the variable-period model used a
 *  fixed T1/T2/T3 trio. Renumber codes from index so the editor's invariant
 *  (period.code === codeForIndex(idx)) holds. */
export function migrateLegacyPeriods(input: TemplatePeriod[] | undefined): TemplatePeriod[] {
  if (!input || input.length === 0) return DEFAULT_PERIODS;
  const min = Math.min(...input.map((p) => p.startOffsetDays));
  const shift = min < 0 ? -min : 0;
  return input.map((p, i) => ({
    code: codeForIndex(i),
    name: p.name,
    startOffsetDays: Math.max(0, p.startOffsetDays + shift),
    endOffsetDays: Math.max(0, p.endOffsetDays + shift),
  }));
}
