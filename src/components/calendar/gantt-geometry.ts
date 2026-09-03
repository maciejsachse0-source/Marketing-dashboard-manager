/**
 * Pure geometry and state math for the gantt strip. Extracted verbatim from
 * `gantt-view.tsx` so it can be unit-tested without pulling the React tree
 * (and with it the server actions, the db client and `src/lib/env.ts`) into
 * the test run. No React, no styling, no side effects live here.
 */
import { startOfWeek as startOfWeekFn } from '@/lib/dates';
import { periodsRelativeToT0Mon } from '@/lib/production-periods';
import {
  PRODUCTION_PROGRESSION,
  type Platform,
  type ProductionPeriods,
  type ProductionStatus,
  type ProductionStep,
  type ProductionType,
} from '../../../drizzle/schema';
import {
  STAGE_CATEGORIES,
  STAGE_INDEX,
  STAGE_TO_PERIOD,
  TENTATIVE_OFFSET_FROM_T0_MON,
  type WeekFrameCode,
} from './gantt-stages';

// Re-eksport, żeby `./gantt-geometry` pozostał jedynym wejściem do matematyki
// ganta dla komponentów — podział na dwa pliki jest wymuszony limitem 300 linii.
export {
  STAGE_CATEGORIES,
  STAGE_INDEX,
  STAGE_TO_PERIOD,
  TENTATIVE_OFFSET_FROM_T0_MON,
} from './gantt-stages';
export type { DateMode, StageCategory, WeekFrameCode } from './gantt-stages';

export const DAY_MS = 24 * 60 * 60 * 1000;

export function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function dayDiff(d: Date, origin: Date): number {
  return (startOfDay(d).getTime() - startOfDay(origin).getTime()) / DAY_MS;
}

export type GanttRow = {
  id: number;
  title: string;
  slug: string;
  type: ProductionType;
  status: ProductionStatus;
  t0At: Date;
  /** Index of dates the user recorded on canonical steps, keyed by stage.
   *  Derived from `steps` by `recordedStageDates` — a lookup, not a second
   *  source of truth. */
  stepDates: Partial<Record<ProductionStatus, string>> | null;
  /** Flexible-steps payload — the production's pipeline, in display order.
   *  Single source of truth for the strip: sequence, labels and done state. */
  steps: ProductionStep[];
  /** Persisted T-period overrides cloned from the template at production
   *  creation. Null for legacy rows; consumers fall back to defaults. */
  periods: ProductionPeriods | null;
  cancelled: boolean;
  artistName: string | null;
  artistHandle: string | null;
  videographerName: string | null;
  platforms: Platform[] | null;
};

export function categoryState(
  cat: (typeof STAGE_CATEGORIES)[number],
  current: ProductionStatus,
): 'passed' | 'active' | 'pending' {
  if (current === 'cancelled') return 'pending';
  const cur = STAGE_INDEX[current];
  const endIdx = STAGE_INDEX[cat.endStage];
  const startIdx = STAGE_INDEX[cat.subStages[0]];
  if (cur >= endIdx) return 'passed';
  if (cur >= startIdx) return 'active';
  return 'pending';
}

/** Stable key for a sub-step regardless of where it's referenced from. The
 *  optimistic-done map (shared between the milestone bar and sub-step bar)
 *  is keyed off this so a click on either surface updates both views in the
 *  same paint. Must be type-only — defined here, not inside any component —
 *  so all readers compute the same key. */
export function subStepKey(s: { kind: 'canonical' | 'custom'; stage: ProductionStatus | null; customId: string | null }): string {
  return s.kind === 'canonical' ? `cn:${s.stage}` : `cs:${s.customId}`;
}

/** Krok w kolejności wyświetlania — tyle, ile potrzeba do arytmetyki kaskady. */
type CascadeStep = {
  kind: 'canonical' | 'custom';
  stage: ProductionStatus | null;
  customId: string | null;
};

/**
 * F7-13: kaskada „kroki po kolei" była wpisana dwa razy, raz w pasku kamieni
 * milowych i raz w pasku podkroków, w obu miejscach wprost w ciele funkcji
 * obsługującej kliknięcie. Jedno źródło, dwa wywołania.
 *
 * Optymistyczna mapa „zrobione": wszystko do `lastDoneIdx` włącznie jest
 * zrobione, reszta nie.
 */
export function cascadeOverrides(steps: CascadeStep[], lastDoneIdx: number): Record<string, boolean> {
  const next: Record<string, boolean> = {};
  for (let i = 0; i < steps.length; i++) {
    next[subStepKey(steps[i])] = i <= lastDoneIdx;
  }
  return next;
}

/** Status produkcji wynikający z najdalszego zaliczonego kroku kanonicznego:
 *  jeden dalej niż on, przycięty do końca listy postępu. */
export function statusAfterCascade(steps: CascadeStep[], lastDoneIdx: number): ProductionStatus {
  let highest = -1;
  for (let i = 0; i <= lastDoneIdx; i++) {
    const step = steps[i];
    if (step.kind === 'canonical' && step.stage) {
      const sIdx = STAGE_INDEX[step.stage];
      if (sIdx > highest) highest = sIdx;
    }
  }
  if (highest < 0) return 'email-sent';
  return PRODUCTION_PROGRESSION[Math.min(highest + 1, PRODUCTION_PROGRESSION.length - 1)];
}

export type MilestoneSource = 'recorded' | 'derived' | 't0' | 'tentative';

/**
 * Resolve the canonical date for a category checkpoint. Returns:
 *   - recorded:  user set stepDates[endStage] explicitly
 *   - derived:   auto-derived (currently editing = shooting + 1 day)
 *   - t0:        publishing always = t0At
 *   - tentative: no real date — return default-offset position only for layout
 */
export function resolveStageDate(
  stage: ProductionStatus,
  row: GanttRow,
): { date: Date; source: MilestoneSource } {
  const iso = row.stepDates?.[stage];
  if (iso) return { date: new Date(iso), source: 'recorded' };
  if (stage === 'editing' && row.stepDates?.shooting) {
    const d = new Date(row.stepDates.shooting);
    d.setDate(d.getDate() + 1);
    return { date: d, source: 'derived' };
  }
  if (stage === 'publishing') {
    return { date: row.t0At, source: 't0' };
  }
  // Tentative: default offset relative to T-0 Monday — keeps the dot inside
  // its T-band even before the user records a real date. When the production
  // has custom periods, clamp the offset to the matching period's bounds so
  // narrow bands (e.g. Mon-Fri) don't push the dot outside.
  const t0Mon = startOfWeekFn(row.t0At);
  let offset = TENTATIVE_OFFSET_FROM_T0_MON[stage] ?? 0;
  const code = STAGE_TO_PERIOD[stage];
  if (code) {
    // Periods are stored 0-anchored at pipeline start; shift them so the
    // publikacja period sits on t0Mon = 0, matching the gantt's frame model.
    const period = periodsRelativeToT0Mon(row.periods).find((p) => p.code === code);
    if (period) {
      offset = Math.max(period.startOffsetDays, Math.min(period.endOffsetDays, offset));
    }
  }
  const def = new Date(t0Mon);
  def.setDate(def.getDate() + offset);
  return { date: def, source: 'tentative' };
}


export const resolveSubStageDate = resolveStageDate;

/**
 * T1/T2/T3 colored backdrop bands — each = exactly 1 full week (Mon-Sun),
 * anchored on the production's T-0 week:
 *
 *   T1 = the week containing OUTR. + UST.    (2 weeks before T-0)
 *   T2 = the week containing NAGR. + MONT.   (1 week  before T-0)
 *   T3 = the week containing PUB. (= T-0)
 *
 * Bands are clipped to the visible window.
 */
export function computeFrameBands(
  t0: Date,
  firstDay: Date,
  totalDays: number,
  periods: ProductionPeriods | null,
): { code: WeekFrameCode; startDay: number; endDay: number }[] {
  const t0Mon = startOfWeekFn(t0); // Monday of T-0's week
  const t0MonDay = Math.round(dayDiff(t0Mon, firstDay));
  // Shift periods so the publikacja period sits on t0Mon — turns the
  // 0-anchored "from pipeline start" offsets into negative-from-T0 offsets
  // that the strip's T-frame model understands.
  const resolved = periodsRelativeToT0Mon(periods);
  const raw = resolved.map((p) => ({
    code: p.code as WeekFrameCode,
    startDay: t0MonDay + p.startOffsetDays,
    endDay: t0MonDay + p.endOffsetDays,
  }));
  return raw
    .map((b) => ({
      ...b,
      startDay: Math.max(0, b.startDay),
      endDay: Math.min(totalDays - 1, b.endDay),
    }))
    .filter((b) => b.startDay <= b.endDay);
}

/**
 * Clip a raw day index to the visible window and report which side it fell
 * off. Lifted out of the three inline copies in `gantt-view.tsx` (checkpoints,
 * sub-steps, band pins) so the clipping rule has exactly one definition.
 */
export function clipToWindow(
  rawIdx: number,
  totalDays: number,
): { dayIdx: number; outOfWindow: 'before' | 'after' | null } {
  return {
    dayIdx: Math.max(0, Math.min(totalDays - 1, rawIdx)),
    outOfWindow: rawIdx < 0 ? 'before' : rawIdx >= totalDays ? 'after' : null,
  };
}
