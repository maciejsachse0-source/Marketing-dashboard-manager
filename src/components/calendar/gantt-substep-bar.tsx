'use client';

import { useState, useTransition } from 'react';
import { cascadeStepsTo } from '@/server/actions/production-steps';
import { type ProductionStatus } from '../../../drizzle/schema';
import {
  cascadeOverrides,
  statusAfterCascade,
  subStepKey,
  type StageCategory,
  type WeekFrameCode,
} from './gantt-geometry';
import { FRAME_TONE, stepCircleClass, accentBorderFor } from './gantt-frames';
import { Button } from '@/components/ui/button';

type StepState = 'passed' | 'active' | 'pending';

// F7-13: tooltip wyjęty z ciała `map`, klasy kółka do `gantt-frames.tsx`.
// Ten sam kod, tylko poza funkcją, której złożoność wynosiła 16.

function stepTooltip(s: SubStepInfo, state: StepState): string {
  const kind = s.kind === 'custom' ? `Krok ${s.n} (dodatkowy)` : `Krok ${s.n}`;
  const stateLabel =
    state === 'passed'
      ? 'zaliczone - klik cofa ten i wszystkie kolejne'
      : state === 'active'
        ? 'w trakcie - klik kończy ten i wszystkie poprzednie'
        : 'do zrobienia - klik kończy ten i wszystkie poprzednie';
  return `${kind}: ${s.label} (${s.cat.label}), ${stateLabel}`;
}

/**
 * 9-step numbered sub-progress bar — positioned ABSOLUTELY in the timeline
 * coordinate system. Each step circle sits at its own calendar date (recorded
 * stepDate or default offset from T-0 Monday), so:
 *   • steps 1-3 (Outreach) cluster under the Outreach milestone, inside T1
 *   • steps 4-6 (Ustalenia) cluster under Ustalenia milestone, inside T1
 *   • step 7 (Nagrywanie) under Nagr milestone, inside T2
 *   • step 8 (Obróbka) under Mont milestone, inside T2
 *   • step 9 (Publikacja) under Pub milestone, at start of T3
 * The bar physically cannot exceed T1+T2+T3 width because no step has a
 * default offset outside that range.
 *
 * Click toggles the sub-stage status (auto-advances/regresses the production
 * status, which in turn auto-passes/un-passes the parent milestone via
 * categoryState in the main bar).
 */
export type SubStepInfo = {
  /** kind discriminates canonical (linked to ProductionStatus) vs custom
   *  (user-added, identified by id). */
  kind: 'canonical' | 'custom';
  stage: ProductionStatus | null; // null for custom — they have no enum value
  customId: string | null;
  label: string;
  n: number; // dynamic 1..N display number
  cat: StageCategory;
  frame: WeekFrameCode;
  /** day offset from t0Mon — fractional for customs interpolated between
   *  canonical neighbours. */
  day: number;
  dayIdx: number;
  outOfWindow: 'before' | 'after' | null;
  /** For custom only: the doneAt timestamp from DB. */
  doneAt: string | null;
  /** Resolved scheduling date for the step — drives the inline date chip
   *  rendered under the circle. Source is one of:
   *    recorded   — user typed it under the step on the production page
   *    derived    — auto-derived (editing = shooting + 1d)
   *    t0         — publishing always = t0At
   *    null       — no real date yet (don't render a date chip)
   *  Tentative-positioned canonicals are intentionally null here: their
   *  position alone communicates "default offset" and a fake DD.MM under
   *  every unset step would look like real dates the user agreed to. */
  date: Date | null;
  dateSource: 'recorded' | 'derived' | 't0' | null;
  /** Whether the parent stage carries time-of-day semantics (nagrywka,
   *  obróbka, ustalenia) — controls whether HH:mm is appended to the chip. */
  withTime: boolean;
};

export function SubStepBar({
  productionId,
  subSteps,
  allSubSteps,
  dayWidthPct,
  status,
  cancelled,
  onChange,
  optimisticDoneByKey,
  setOptimisticDoneByKey,
}: {
  productionId: number;
  subSteps: SubStepInfo[];
  allSubSteps: SubStepInfo[];
  dayWidthPct: number;
  status: ProductionStatus;
  cancelled: boolean;
  onChange: (next: ProductionStatus) => void;
  optimisticDoneByKey: Record<string, boolean>;
  setOptimisticDoneByKey: (next: Record<string, boolean>) => void;
}) {
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const stepX = (s: SubStepInfo) => (s.dayIdx + 0.5) * dayWidthPct;

  const keyOf = (s: SubStepInfo) => subStepKey(s);

  // Single source of truth for "is this step done?" — optimistic override
  // (shared with PipelineMilestones via the lifted state) wins, then the
  // step's actual doneAt from row.steps. We deliberately do NOT consult the
  // derived ProductionStatus or the legacy positionAfter rule here: those
  // produced phantom-passed states (custom appears done because status
  // moved past its anchor canonical, even though its own doneAt is null)
  // which made unmark clicks invisible.
  const isDone = (s: SubStepInfo): boolean => {
    const k = keyOf(s);
    if (k in optimisticDoneByKey) return optimisticDoneByKey[k];
    return !!s.doneAt;
  };

  // Visual state: cascade-invariant by construction. The first step in
  // visual order whose isDone is false is the active one — everything
  // before it is passed (cascade-implied), everything after it is pending.
  // This guarantees we never render "step N+1 active while step N pending":
  // by definition the active step is the first non-done one, so all earlier
  // steps are done.
  const firstUndoneIdx = (() => {
    if (status === 'cancelled') return -1;
    for (let i = 0; i < allSubSteps.length; i++) {
      if (!isDone(allSubSteps[i])) return i;
    }
    return -1;
  })();

  const stateOf = (s: SubStepInfo): 'passed' | 'active' | 'pending' => {
    if (status === 'cancelled') return 'pending';
    const i = allSubSteps.findIndex((x) => keyOf(x) === keyOf(s));
    if (i < 0) return isDone(s) ? 'passed' : 'pending';
    if (firstUndoneIdx < 0) return 'passed';
    if (i < firstUndoneIdx) return 'passed';
    if (i === firstUndoneIdx) return 'active';
    return 'pending';
  };

  // Sequential cascade — clicking a step propagates state to all earlier steps
  // (mark) or all later steps (unmark). Steps must be completed in order:
  // step N can never be DONE while step N-1 is NOT DONE.
  //
  //   click NOT-DONE step → cascade-mark: target + everything before = DONE
  //   click DONE step     → cascade-unmark: target + everything after = NOT DONE
  //
  // Cascade math uses `allSubSteps` (full ordered list across all categories,
  // including out-of-window) so out-of-window steps participate in ordering
  // even though they're not rendered.
  const onStepClick = (s: SubStepInfo) => {
    if (cancelled) return;
    const idxInAll = allSubSteps.findIndex((x) => keyOf(x) === keyOf(s));
    if (idxInAll < 0) return;
    const isPassed = stateOf(s) === 'passed';
    const mode: 'mark' | 'unmark' = isPassed ? 'unmark' : 'mark';

    // Optimistic: every step in [0..lastDoneIdx] = done, rest = not.
    // Cover BOTH canonicals and customs so the cascade-invariant display
    // matches the in-flight server cascade — server-side cascadeStepsTo
    // operates on the same flat steps[] in the same visual order.
    const lastDoneIdx = mode === 'mark' ? idxInAll : idxInAll - 1;
    setOptimisticDoneByKey(cascadeOverrides(allSubSteps, lastDoneIdx));
    // Optimistic: project new canonical status from cascade. Highest canonical
    // in [0..lastDoneIdx] determines status as one-past (next active), capped
    // at publishing.
    onChange(statusAfterCascade(allSubSteps, lastDoneIdx));

    // New cascade signature: each step has a unique id. Canonical steps use
    // their old ProductionStatus value as id; customs keep their original id.
    const stepId =
      s.kind === 'canonical' && s.stage ? (s.stage as string) : s.customId!;
    startTransition(() => {
      cascadeStepsTo(productionId, stepId, mode);
    });
  };

  if (subSteps.length === 0) return null;

  const sortedByX = [...subSteps].sort((a, b) => a.dayIdx - b.dayIdx);
  const firstX = stepX(sortedByX[0]);
  const lastX = stepX(sortedByX[sortedByX.length - 1]);
  const trackWidth = Math.max(0, lastX - firstX);

  // Progress fill stretches from the first step to the right-most passed step.
  const passedByX = sortedByX.filter((s) => stateOf(s) === 'passed');
  const lastPassedX = passedByX.length > 0 ? stepX(passedByX[passedByX.length - 1]) : firstX;
  const progressWidth = Math.max(0, lastPassedX - firstX);

  // Sit below the main milestone labels — at the very bottom of the row.
  const TRACK_TOP = '13.5rem';

  return (
    <>
      {/* Track (background) */}
      <div
        className="absolute h-[2px] rounded-full bg-border pointer-events-none"
        style={{ top: TRACK_TOP, left: `${firstX}%`, width: `${trackWidth}%`, transform: 'translateY(-50%)' }}
        aria-hidden
      />
      {/* Progress fill */}
      <div
        className="absolute h-[2px] rounded-full pointer-events-none transition-[width] duration-300 ease-out"
        style={{
          top: TRACK_TOP,
          left: `${firstX}%`,
          width: `${progressWidth}%`,
          transform: 'translateY(-50%)',
          background: 'linear-gradient(90deg, var(--accent-blue-soft) 0%, var(--accent-blue) 100%)',
        }}
        aria-hidden
      />

      {/* Per-step date chips were intentionally removed — the user-entered
          date now lives ONLY on the band-level pin (with full hover card).
          Replicating it under each step circle was redundant noise. */}

      {/* Step circles — canonical (numbered, large) and custom (numbered, smaller
          dashed border to telegraph it's a user insert) all in one ordered list. */}
      {subSteps.map((s) => {
        const state = stateOf(s);
        const k = keyOf(s);
        const isHovered = hoveredKey === k;
        const tone = FRAME_TONE[s.frame];
        const x = stepX(s);
        const isCustom = s.kind === 'custom';
        const tooltip = stepTooltip(s, state);
        const onClick = () => onStepClick(s);

        return (
          <Button
            key={k}
            variant="ghost"
            disabled={cancelled}
            onMouseEnter={() => setHoveredKey(k)}
            onMouseLeave={() => setHoveredKey(null)}
            onFocus={() => setHoveredKey(k)}
            onBlur={() => setHoveredKey(null)}
            onClick={onClick}
            aria-label={tooltip}
            aria-pressed={state === 'passed'}
            aria-current={state === 'active' ? 'step' : undefined}
            title={tooltip}
            style={{ top: TRACK_TOP, left: `${x}%`, transform: 'translate(-50%, -50%)' }}
            className={stepCircleClass({
              state,
              tonePassed: tone.passed,
              accentBorder: accentBorderFor(s.frame),
              isCustom,
              cancelled,
              isHovered,
            })}
          >
            {s.n}
            {s.outOfWindow ? (
              <span
                aria-hidden
                className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-background border border-border grid place-items-center text-[7px] font-bold text-muted-foreground"
              >
                {s.outOfWindow === 'before' ? '‹' : '›'}
              </span>
            ) : null}
          </Button>
        );
      })}

      {/* The bottom floating "active/hover step" label was intentionally
          removed — the band-level pin's hover card now carries the full
          step context (number, label, date, description). Keeping a parallel
          label under the sub-bar duplicated information and crowded the row. */}
    </>
  );
}
