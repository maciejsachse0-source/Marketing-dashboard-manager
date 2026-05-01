import { z } from 'zod';

/**
 * T-period = colored time band on the gantt that buckets pipeline categories.
 * Periods are arbitrary day-ranges measured from the production's start
 * anchor (day 0). Templates can pick any number of periods (1..MAX_PERIODS),
 * each with its own start/end day offset, so a studio with a different
 * rhythm (Mon-Fri sprints, Fri→Mon weekend cuts, multi-shoot campaigns) can
 * model their own cadence.
 *
 * Offsets are integer days from the start anchor, both endpoints inclusive
 * and non-negative. Period order is the array order; codes (T1, T2, ...) are
 * derived from the index so the user never has to keep them in sync.
 */
export const MIN_PERIODS = 1;
export const MAX_PERIODS = 6;

/** Auto-derived code for the period at the given index (0 → T1, 1 → T2, …). */
export function codeForIndex(idx: number): string {
  return `T${idx + 1}`;
}

/** Codes for the canonical 3-period default — preserved for the few callsites
 *  (gantt, category→period mapping) that still hardcode T1/T2/T3 lookups. */
export const PERIOD_CODES = ['T1', 'T2', 'T3'] as const;
export type PeriodCode = (typeof PERIOD_CODES)[number];

export type TemplatePeriod = {
  /** Auto-derived from index; persisted for readability + so existing
   *  consumers (gantt) keep working without re-deriving. */
  code: string;
  startOffsetDays: number;
  endOffsetDays: number;
};

/** Hard limits on how far a period can sit from the start anchor. Wider than
 *  any realistic pipeline so user creativity isn't artificially clipped, but
 *  tight enough that arithmetic stays safe and the gantt strip can fit. */
export const PERIOD_OFFSET_MIN = 0;
export const PERIOD_OFFSET_MAX = 90;

/** Defaults: 3 contiguous 7-day periods starting at the anchor. Anyone using
 *  templates without an explicit `periods` field gets a sensible 3-week strip
 *  that maps cleanly onto the existing outreach/recording/publishing flow. */
export const DEFAULT_PERIODS: TemplatePeriod[] = [
  { code: 'T1', startOffsetDays: 0, endOffsetDays: 6 },
  { code: 'T2', startOffsetDays: 7, endOffsetDays: 13 },
  { code: 'T3', startOffsetDays: 14, endOffsetDays: 20 },
];

const periodShape = z.object({
  code: z.string(),
  startOffsetDays: z.number().int().min(PERIOD_OFFSET_MIN).max(PERIOD_OFFSET_MAX),
  endOffsetDays: z.number().int().min(PERIOD_OFFSET_MIN).max(PERIOD_OFFSET_MAX),
});

export const periodsSchema = z
  .array(periodShape)
  .min(MIN_PERIODS)
  .max(MAX_PERIODS)
  .superRefine((periods, ctx) => {
    // Codes must follow the auto-derived T<idx+1> pattern. Validation enforces
    // it so accidental hand-edits in JSON files surface as errors instead of
    // mysterious gantt mis-renders.
    periods.forEach((p, i) => {
      const expected = codeForIndex(i);
      if (p.code !== expected) {
        ctx.addIssue({
          code: 'custom',
          message: `Okres #${i + 1} musi mieć kod ${expected}`,
          path: [i, 'code'],
        });
      }
    });
    // Each period: start <= end.
    periods.forEach((p, i) => {
      if (p.startOffsetDays > p.endOffsetDays) {
        ctx.addIssue({
          code: 'custom',
          message: `${p.code}: początek musi być wcześniej lub równy końcowi`,
          path: [i, 'startOffsetDays'],
        });
      }
    });
    // Adjacent pairs: previous end strictly before next start (no overlap, no
    // shared day). Adjacency (gap = 1 day) is allowed.
    for (let i = 0; i < periods.length - 1; i++) {
      const a = periods[i];
      const b = periods[i + 1];
      if (a.endOffsetDays >= b.startOffsetDays) {
        ctx.addIssue({
          code: 'custom',
          message: `${a.code} (koniec) i ${b.code} (start) nakładają się — okresy muszą być rozdzielone`,
          path: [i + 1, 'startOffsetDays'],
        });
      }
    }
  });

/** Return periods or fall back to defaults. Accepts any non-empty array so
 *  legacy productions/templates with negative offsets still resolve — the
 *  gantt handles them gracefully. Callers never need to null-check. */
export function resolvePeriods(input: TemplatePeriod[] | null | undefined): TemplatePeriod[] {
  if (!input || input.length === 0) return DEFAULT_PERIODS;
  return input;
}

/**
 * Translate periods from "0-anchored at pipeline start" to "anchored at t0Mon
 * (publication-week Monday)". The last period (publikacja) is the one that
 * contains T-0, so its `startOffsetDays` is what t0Mon corresponds to in
 * period-space. Subtracting that value yields negative offsets for the
 * earlier periods (outreach/recording weeks) — the form the gantt strip and
 * step-week validator both expect.
 *
 * For default periods (T1=0..6, T2=7..13, T3=14..20), shift = -14, giving
 * T1=-14..-8, T2=-7..-1, T3=0..6 — three weeks anchored on the publication
 * week. Custom period configurations work the same way: the LAST period's
 * Monday is t0Mon, everything else flows backward from there.
 */
export function periodsRelativeToT0Mon(
  input: TemplatePeriod[] | null | undefined,
): TemplatePeriod[] {
  const resolved = resolvePeriods(input);
  const last = resolved[resolved.length - 1];
  const shift = -last.startOffsetDays;
  if (shift === 0) return resolved;
  return resolved.map((p) => ({
    code: p.code,
    startOffsetDays: p.startOffsetDays + shift,
    endOffsetDays: p.endOffsetDays + shift,
  }));
}

/** Day-of-week labels (pl). Index 0 = Monday (matches our `startOfWeek`). */
export const DOW_LABEL_PL = ['pon', 'wt', 'śr', 'czw', 'pt', 'sob', 'nd'] as const;

/** Convert a start-relative day offset to (weekIndex, dayOfWeek). weekIndex is
 *  measured as: which Monday-anchored week the day falls into, where 0 = the
 *  start week. dayOfWeek 0..6 = Mon..Sun. */
export function offsetToWeekDow(offsetDays: number): { weekIndex: number; dow: number } {
  // JS modulo with negative numbers returns negatives — normalise to 0..6.
  const dow = ((offsetDays % 7) + 7) % 7;
  const weekIndex = Math.floor(offsetDays / 7);
  return { weekIndex, dow };
}

export function weekDowToOffset(weekIndex: number, dow: number): number {
  return weekIndex * 7 + dow;
}

/** Human-readable label for a day offset from the start anchor, e.g.
 *  "Start (pon)" for 0 or "+10d (czw)" for 10. Used in slider tooltips and
 *  period chips. Negative values are kept signed for legacy-data display
 *  (existing productions saved before the 0-anchored model). */
export function describeOffset(offset: number): string {
  const dow = ((offset % 7) + 7) % 7;
  const day = DOW_LABEL_PL[dow];
  if (offset === 0) return `Start (${day})`;
  const sign = offset > 0 ? '+' : '−';
  return `${sign}${Math.abs(offset)}d (${day})`;
}
