/**
 * Druga połowa obliczeń wiersza ganta: pasma T, kamienie milowe, kroki i
 * pinezki dat. Przeniesiona bez zmiany treści z `gantt-view.tsx` w F2-02.
 */
import type { ProductionStage, ProductionStatus } from '../../../drizzle/schema';
import {
  STAGE_CATEGORIES,
  categoryState,
  clipToWindow,
  computeFrameBands,
  dayDiff,
  resolveStageDate,
  resolveSubStageDate,
  type GanttRow,
  type WeekFrameCode,
} from './gantt-geometry';
import { buildDraft } from './gantt-row-placement';
import type { SubStepInfo } from './gantt-substep-bar';

export function buildRowModel(
  row: GanttRow,
  firstDay: Date,
  totalDays: number,
  optimisticStatus: ProductionStatus,
) {

  // T1/T2/T3 full-week bands anchored on T-0 — sourced from the production's
  // own periods (cloned from its template) so two productions with different
  // templates can render different bands on the same gantt.
  const frameBands = computeFrameBands(row.t0At, firstDay, totalDays, row.periods);
  const { t0MonForSteps, draft } = buildDraft(row);

  // end canonical so the trunk line + tick + circle always share an x.
  const endDayByCategory: Partial<Record<ProductionStage, number>> = {};
  for (const d of draft) {
    if (d.isEnd) endDayByCategory[d.cat.key] = d.day;
  }

  // Per-category checkpoints (5 of them). Out-of-window checkpoints are
  // filtered — clipping them all to dayIdx=0 stacks ticks + labels on top of
  // each other for productions whose pipeline starts before/after the visible
  // strip (e.g. a published production where T-0 is days behind, so all
  // earlier-stage milestones land at the left edge). Same pattern as subSteps.
  const t0MonOffsetForCheckpoints = dayDiff(t0MonForSteps, firstDay);
  const allCheckpoints = STAGE_CATEGORIES.map((cat) => {
    const { date, source } = resolveStageDate(cat.endStage, row);
    // Position from the SWEPT end-canonical day if available — keeps tick
    // glued to its circle even after sweep-shifts. Date label uses the
    // original resolved date (so users still see the recorded calendar
    // date in the milestone label).
    const sweptDay = endDayByCategory[cat.key];
    const rawIdx =
      sweptDay !== undefined
        ? t0MonOffsetForCheckpoints + sweptDay
        : dayDiff(date, firstDay);
    const { dayIdx: clippedIdx, outOfWindow } = clipToWindow(rawIdx, totalDays);
    return {
      cat,
      date,
      source,
      dayIdx: clippedIdx,
      outOfWindow,
      state: categoryState(cat, optimisticStatus),
    };
  });
  const checkpoints = allCheckpoints.filter((cp) => cp.outOfWindow == null);

  // 3) Compute dayIdx, clipping, numbering. Out-of-window steps get filtered.
  // Day-to-x: t0Mon's offset from firstDay is integer days; add the (possibly
  // fractional) `day` directly. Reuse the same offset that drove checkpoint
  // positioning so trunk + tick + circle stay in lockstep.
  //
  // Per-step dates are resolved separately from per-step positions:
  //   • POSITION drives the circle's x-coordinate and is uniformly distributed
  //     inside the band (so steps stay neatly inside their week even before
  //     the user records anything).
  //   • DATE drives the small inline date chip under the circle and reflects
  //     ONLY user-recorded / derived / t0 anchors. Tentative slots show no
  //     date chip — the band already telegraphs "tygodnia X".
  const allSubSteps: SubStepInfo[] = draft.map((d, idx) => {
    const rawIdx = t0MonOffsetForCheckpoints + d.day;
    const { dayIdx: clippedIdx, outOfWindow } = clipToWindow(rawIdx, totalDays);

    let date: Date | null = null;
    let dateSource: 'recorded' | 'derived' | 't0' | null = null;
    if (d.kind === 'canonical' && d.stage) {
      const resolved = resolveSubStageDate(d.stage, row);
      if (resolved.source !== 'tentative') {
        date = resolved.date;
        dateSource = resolved.source;
      }
    }

    return {
      kind: d.kind,
      stage: d.stage,
      customId: d.customId,
      label: d.label,
      n: idx + 1,
      cat: d.cat,
      frame: d.frame,
      day: d.day,
      dayIdx: clippedIdx,
      outOfWindow,
      doneAt: d.doneAt,
      positionAfter: d.positionAfter,
      date,
      dateSource,
      withTime: d.cat.withTime,
    };
  });
  // Render only in-window steps. Stacking ticks at the same edge for past /
  // future productions is unreadable; skipping is cleaner.
  const subSteps = allSubSteps.filter((s) => s.outOfWindow == null);

  // Sub-step pins on the colored T1/T2/T3 bands — every step (canonical OR
  // custom) whose user-entered `dateIso` falls inside the visible window
  // becomes a numbered chip ON its category's band. The chip carries the
  // global step number; hover surfaces label + date + description.
  //
  // Auto-derived dates (editing = shoot+1) and the production-level T-0 are
  // intentionally NOT pinned — they don't represent a date the user typed
  // *into a step row*, and the milestone tick / T3 band already telegraph
  // those anchors.
  const subStepById = new Map<string, SubStepInfo>();
  for (const s of allSubSteps) {
    const id = s.kind === 'canonical' && s.stage ? (s.stage as string) : s.customId;
    if (id) subStepById.set(id, s);
  }
  const stagePins: {
    stepId: string;
    label: string;
    description: string | null;
    frame: WeekFrameCode;
    dayIdx: number;
    dateLabel: string;
    n: number;
    /** Index within the same-day stack (0 = topmost). */
    stackIdx: number;
    /** Total pins sharing this dayIdx — used to center the stack. */
    stackSize: number;
  }[] = [];
  for (const step of row.steps ?? []) {
    if (!step.dateIso) continue;
    const date = new Date(step.dateIso);
    const idx = dayDiff(date, firstDay);
    if (idx < 0 || idx >= totalDays) continue;
    const sub = subStepById.get(step.id);
    if (!sub) continue;
    const dateLabel = sub.withTime
      ? date.toLocaleString('pl-PL', {
          dateStyle: 'medium',
          timeStyle: 'short',
        })
      : date.toLocaleDateString('pl-PL', { dateStyle: 'medium' });
    stagePins.push({
      stepId: step.id,
      label: step.label,
      description: step.description?.trim() ? step.description.trim() : null,
      frame: sub.frame,
      dayIdx: idx,
      dateLabel,
      n: sub.n,
      stackIdx: 0,
      stackSize: 1,
    });
  }
  // Pins sharing the same dayIdx would render on top of each other. Group
  // them and assign vertical stack positions so the user can see and hover
  // each one individually. Order within the stack follows step number `n`
  // so the visual stack reads top→bottom in step order.
  {
    const byDay = new Map<number, typeof stagePins>();
    for (const pin of stagePins) {
      const list = byDay.get(pin.dayIdx);
      if (list) list.push(pin);
      else byDay.set(pin.dayIdx, [pin]);
    }
    for (const list of byDay.values()) {
      if (list.length <= 1) continue;
      list.sort((a, b) => a.n - b.n);
      list.forEach((pin, i) => {
        pin.stackIdx = i;
        pin.stackSize = list.length;
      });
    }
  }

  return { frameBands, checkpoints, allSubSteps, subSteps, stagePins };
}

export type RowModel = ReturnType<typeof buildRowModel>;
