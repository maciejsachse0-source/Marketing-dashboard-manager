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
  type CustomStep,
  type Platform,
  type ProductionPeriods,
  type ProductionStage,
  type ProductionStatus,
  type ProductionStep,
  type ProductionType,
} from '../../../drizzle/schema';

export type DateMode = 'record' | 'calendar' | 'derived' | 'none';

export const DAY_MS = 24 * 60 * 60 * 1000;

export type WeekFrameCode = 'T1' | 'T2' | 'T3';

/**
 * 5 main pipeline checkpoints — anchored on the LAST sub-stage of each category.
 * Date for each checkpoint comes EXCLUSIVELY from the production:
 *   - stepDates[endStage] when the user has recorded a date on the production page
 *   - shooting + 1 day for `editing` (auto-derived, matches production page)
 *   - row.t0At for `publishing` (publication date == T-0)
 *   - otherwise: TENTATIVE — milestone rendered at default offset for visual
 *     orientation, but with dashed border and no date, signalling "ustaw na produkcji"
 */
export type StageCategory = {
  key: ProductionStage;
  label: string;
  short: string;
  description: string;
  hint: string;
  endStage: ProductionStatus;
  subStages: ProductionStatus[];
  frame: WeekFrameCode;
  dateMode: DateMode;
  dateLabel: string;
  withTime: boolean;
};

export const STAGE_CATEGORIES: StageCategory[] = [
  {
    key: 'outreach',
    label: 'Outreach',
    short: 'OUTR.',
    description: 'Kontakt z artystą, akceptacja warunków, ustalenie daty z kamerzystą.',
    hint: 'wzorce maila, screen rozmowy, umowa.pdf',
    endStage: 'cam-meeting-set',
    subStages: ['email-sent', 'terms-accepted', 'cam-meeting-set'],
    frame: 'T1',
    dateMode: 'record',
    dateLabel: 'kiedy się wydarzyło',
    withTime: false,
  },
  {
    key: 'ustalenia',
    label: 'Ustalenia + scenariusz',
    short: 'UST.',
    description: 'Przekazanie daty + omówienie i wysłanie scenariusza.',
    hint: 'scenariusz PDF, shotlist, packing list, callsheet',
    endStage: 'script-sent',
    subStages: ['cam-date-shared', 'script-discussed', 'script-sent'],
    frame: 'T1',
    dateMode: 'calendar',
    dateLabel: 'termin',
    withTime: true,
  },
  {
    key: 'nagrywanie',
    label: 'Nagrywanie',
    short: 'NAGR.',
    description: 'Nagrywki — w studio lub w terenie.',
    hint: 'surówki, BTS, audio raw',
    endStage: 'shooting',
    subStages: ['shooting'],
    frame: 'T2',
    dateMode: 'calendar',
    dateLabel: 'data nagrań',
    withTime: true,
  },
  {
    key: 'obrobka',
    label: 'Obróbka',
    short: 'MONT.',
    description: 'Montaż — następnego dnia po nagrywkach.',
    hint: 'wersje robocze, master video',
    endStage: 'editing',
    subStages: ['editing'],
    frame: 'T2',
    dateMode: 'derived',
    dateLabel: 'auto: dzień po nagrywkach',
    withTime: true,
  },
  {
    key: 'publikacja',
    label: 'Publikacja',
    short: 'PUB.',
    description: 'Upload na platformy.',
    hint: 'thumbs, exports per platforma',
    endStage: 'publishing',
    subStages: ['publishing'],
    frame: 'T3',
    dateMode: 'none',
    dateLabel: '',
    withTime: false,
  },
];

// Section frames for the row's expanded panel — derived from the shared

export function deriveEditingIso(shootIso: string): string {
  const d = new Date(shootIso);
  d.setDate(d.getDate() + 1);
  d.setHours(10, 0, 0, 0);
  return d.toISOString();
}

export function subStageState(
  stage: ProductionStatus,
  current: ProductionStatus,
): 'passed' | 'active' | 'pending' {
  if (current === 'cancelled') return 'pending';
  const cur = STAGE_INDEX[current];
  const idx = STAGE_INDEX[stage];
  if (idx < cur) return 'passed';
  if (idx === cur) return 'active';
  return 'pending';
}

/**
 * TENTATIVE milestone positions — relative to MONDAY of T-0's week (t0Mon).
 * Layout requirement: T1/T2/T3 each = 1 week; OUTR.+UST. inside T1, NAGR.+MONT.
 * inside T2, PUB. inside T3. Defaults spread the two ticks across each band:
 *
 *   T1 (t0Mon-14 .. t0Mon-8)  →  OUTR. on Wed,  UST. on Sat
 *   T2 (t0Mon-7  .. t0Mon-1)  →  NAGR. on Wed, MONT. on Fri
 *   T3 (t0Mon    .. t0Mon+6)  →  PUB.  on T-0 (real day, always set)
 */
export const TENTATIVE_OFFSET_FROM_T0_MON: Partial<Record<ProductionStatus, number>> = {
  // T1 — outreach (steps 1-3)
  'email-sent': -14, // Mon of T1
  'terms-accepted': -13, // Tue of T1
  'cam-meeting-set': -12, // Wed of T1 (Outreach milestone end)
  // T1 — ustalenia (steps 4-6)
  'cam-date-shared': -11, // Thu of T1
  'script-discussed': -10, // Fri of T1
  'script-sent': -9, // Sat of T1 (Ustalenia milestone end)
  // T2 — nagrywanie + obróbka (steps 7-8)
  shooting: -5, // Wed of T2
  editing: -3, // Fri of T2
  // T3 — publikacja (step 9)
  publishing: 0, // Mon of T3 (= T-0)
};

export const STAGE_INDEX: Record<ProductionStatus, number> = Object.fromEntries(
  PRODUCTION_PROGRESSION.map((s, i) => [s, i]),
) as Record<ProductionStatus, number>;

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
  stepDates: Partial<Record<ProductionStatus, string>> | null;
  customSteps: Partial<Record<ProductionStage, CustomStep[]>> | null;
  stepOrder: Partial<Record<ProductionStage, string[]>> | null;
  /** New flexible-steps payload — used by the expanded view to render the
   *  full pipeline list. Synthesized legacy fields above stay for now to
   *  keep the strip's status/date math unchanged during the cleanup window. */
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

/** Map of legacy canonical stages → their T-period code, used by tentative
 *  placement to clamp default offsets to user-customised period bounds. */
export const STAGE_TO_PERIOD: Partial<Record<ProductionStatus, WeekFrameCode>> = {
  'email-sent': 'T1',
  'terms-accepted': 'T1',
  'cam-meeting-set': 'T1',
  'cam-date-shared': 'T1',
  'script-discussed': 'T1',
  'script-sent': 'T1',
  shooting: 'T2',
  editing: 'T2',
  publishing: 'T3',
};

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
