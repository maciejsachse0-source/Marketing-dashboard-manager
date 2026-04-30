import type {
  ProductionStage,
  ProductionStep,
  StepDateMode,
} from '../../drizzle/schema';
import { startOfWeek, addDays, endOfDay } from './dates';

/**
 * Pure helpers for the flexible-steps model. Independent of DB / UI — just
 * derive state from a `steps[]` array. Keep this file dependency-free so it
 * can be imported from server actions, RSC, and client components alike.
 */

/** Index of the first step that is not yet `done`. Returns `steps.length`
 *  when every step is done (i.e. production is finished). */
export function getActiveStepIndex(steps: ProductionStep[]): number {
  const i = steps.findIndex((s) => !s.doneAt);
  return i === -1 ? steps.length : i;
}

/** Production has reached its final step. Empty step lists are NOT considered
 *  done — they're broken instead, and callers should treat them as in-progress
 *  to avoid surfacing them as "completed" in dashboards. */
export function isProductionDone(steps: ProductionStep[]): boolean {
  if (steps.length === 0) return false;
  return steps.every((s) => !!s.doneAt);
}

/** The step flagged as the pipeline T-0 anchor (typically shooting day).
 *  Returns null if no step has the flag — gantt should fall back to its
 *  legacy `t0At` field. */
export function getT0AnchorStep(steps: ProductionStep[]): ProductionStep | null {
  return steps.find((s) => s.isT0Anchor) ?? null;
}

/** Step within a category, by index in the per-category sub-list. Used by
 *  `moveStepInCategory` to compute the global swap target. */
export function getStepsInCategory(
  steps: ProductionStep[],
  category: ProductionStage,
): { step: ProductionStep; globalIdx: number }[] {
  const out: { step: ProductionStep; globalIdx: number }[] = [];
  steps.forEach((s, globalIdx) => {
    if (s.category === category) out.push({ step: s, globalIdx });
  });
  return out;
}

/** When the user sets a `shooting` (T0 anchor) step's date, every step with
 *  `dateMode: 'derived-from-shooting'` should auto-update. Default rule:
 *  the day AFTER shooting at 10:00 local time. Returns the ISO string for
 *  the derived step; callers persist it onto the step. */
export function deriveFromShootingIso(shootIso: string): string {
  const d = new Date(shootIso);
  d.setDate(d.getDate() + 1);
  d.setHours(10, 0, 0, 0);
  return d.toISOString();
}

/** Default duration when the template / step doesn't specify one. Used by
 *  the calendar upsert path so an entry always has a sensible end. */
export function defaultDurationMinutes(mode: StepDateMode | undefined): number {
  if (mode === 'calendar') return 60;
  return 0;
}

/** Clone a step list from a template, resetting all per-production state
 *  (doneAt, dateIso, attachments). Used by `createProduction` when applying
 *  a template at creation time. */
export function cloneTemplateSteps(
  templateSteps: Array<Omit<ProductionStep, 'doneAt'> & { doneAt?: never }>,
): ProductionStep[] {
  return templateSteps.map((t) => ({
    id: t.id,
    category: t.category,
    label: t.label,
    description: t.description,
    doneAt: null,
    dateMode: t.dateMode,
    durationMinutes: t.durationMinutes,
    calendarType: t.calendarType,
    isT0Anchor: t.isT0Anchor,
  }));
}

/** Generate a stable-but-unique step id for newly-added (non-template) steps.
 *  Format mirrors the legacy `customSteps[*].id` for backwards compatibility
 *  with attachment paths and persisted references. */
export function newStepId(): string {
  return Math.random().toString(36).slice(2, 14);
}

/**
 * Each step category lives in exactly one of the three T-frames anchored on
 * the production's T-0 week. The frame fully constrains the calendar week the
 * step's date may fall in:
 *
 *   T1 = the week 2 weeks before T-0     → outreach + ustalenia
 *   T2 = the week 1 week  before T-0     → nagrywanie + obrobka
 *   T3 = T-0's own week                  → publikacja
 *
 * Used by both the server (to validate `setStepDate`) and the client (to
 * clamp the date input's min/max attributes).
 */
const CATEGORY_FRAME_OFFSET_WEEKS: Record<ProductionStage, number> = {
  outreach: -2,
  ustalenia: -2,
  nagrywanie: -1,
  obrobka: -1,
  publikacja: 0,
};

export function getStepWeekRange(
  t0At: Date,
  category: ProductionStage,
): { start: Date; end: Date } {
  const t0Mon = startOfWeek(t0At);
  const offsetWeeks = CATEGORY_FRAME_OFFSET_WEEKS[category];
  const start = addDays(t0Mon, offsetWeeks * 7); // Monday 00:00
  const end = endOfDay(addDays(start, 6)); // Sunday 23:59:59.999
  return { start, end };
}

/** Compute a coarse production state from `steps` + `cancelledAt`. Used by
 *  list views, pills, and filters that previously branched on `status`. */
export type ProductionState = 'cancelled' | 'done' | 'in-progress';
export function deriveProductionState(
  steps: ProductionStep[],
  cancelledAt: Date | null,
): ProductionState {
  if (cancelledAt) return 'cancelled';
  if (isProductionDone(steps)) return 'done';
  return 'in-progress';
}
