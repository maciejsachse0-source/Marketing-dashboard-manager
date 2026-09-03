'use client';

import { useState, useTransition } from 'react';
import { Check } from 'lucide-react';
import { cascadeStepsTo } from '@/server/actions/production-steps';
import { type ProductionStatus } from '../../../drizzle/schema';
import {
  cascadeOverrides,
  statusAfterCascade,
  STAGE_CATEGORIES,
  subStepKey,
  type MilestoneSource,
} from './gantt-geometry';
import { type SubStepInfo } from './gantt-substep-bar';
import { MilestoneLabels } from './gantt-milestone-labels';
import { Button } from '@/components/ui/button';


type MilestoneState = 'passed' | 'active' | 'pending';

// F7-13: pochodne kliknięcia i wyglądu pinezki wyjęte z ciała komponentu.
// Nic tu nie zmienia treści znaczników — to ten sam kod, tylko poza `map`
// i poza `onClickCategory`, których złożoność cyklomatyczna wynosiła 17 i 12.

function tickTooltip(cp: CheckpointInfo, state: MilestoneState): string {
  const stateLabel =
    state === 'passed'
      ? 'zaliczone (klik = cofnij)'
      : state === 'active'
        ? 'w trakcie (klik = odhacz całą fazę)'
        : 'do zrobienia (klik = odhacz)';
  const dateLabel =
    cp.source === 'tentative'
      ? 'brak daty - ustaw na produkcji'
      : cp.date.toLocaleDateString('pl-PL', { dateStyle: 'medium' });
  const window =
    cp.outOfWindow === 'before' ? ' (przed oknem)' : cp.outOfWindow === 'after' ? ' (po oknie)' : '';
  return `${cp.cat.label}, ${dateLabel}${window}, ${stateLabel}`;
}

function tickClass(
  state: MilestoneState,
  tentative: boolean,
  cancelled: boolean,
  isHovered: boolean,
): string {
  const size =
    state === 'active'
      ? 'w-7 h-7 bg-foreground text-background ring-4 ring-[var(--accent-blue)]/25 scale-105'
      : state === 'passed'
        ? 'w-6 h-6 bg-[var(--accent-blue)] text-white hover:scale-110'
        : `w-5 h-5 bg-background border-2 ${tentative ? 'border-dashed border-muted-foreground/50' : 'border-border'} hover:border-foreground/50 hover:scale-110`;
  return `disabled:opacity-100 absolute z-10 grid place-items-center rounded-full p-0 border-0 bg-clip-border transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
    cancelled ? 'opacity-50 disabled:opacity-50 cursor-not-allowed' : 'cursor-pointer'
  } ${size} ${isHovered && state !== 'active' ? 'ring-4 ring-foreground/10' : ''}`;
}

function TickIcon({ state }: { state: MilestoneState }) {
  if (state === 'passed') return <Check className="size-3.5" strokeWidth={3} />;
  if (state === 'active')
    return <span className="block w-2 h-2 rounded-full bg-background animate-pulse" />;
  return null;
}

/**
 * Pipeline milestones — same visual language as the StageTracker on the
 * production page (track + 5 ticks + labels) BUT positioned at the actual
 * calendar dates of each milestone, so each tick sits directly under the
 * T1/T2/T3 band it belongs to:
 *   • Outreach + Ustalenia z kamerzystą → under T1
 *   • Nagrywanie + Obróbka              → under T2
 *   • Publikacja                        → under T3
 *
 * Coordinates are % of the full timeline (same system as the bands above),
 * so when bands shift left/right with T-0, ticks shift with them.
 */
export function PipelineMilestones({
  productionId,
  checkpoints,
  allSubSteps,
  dayWidthPct,
  cancelled,
  onChange,
  optimisticDoneByKey,
  setOptimisticDoneByKey,
}: {
  productionId: number;
  checkpoints: CheckpointInfo[];
  allSubSteps: SubStepInfo[];
  dayWidthPct: number;
  cancelled: boolean;
  onChange: (next: ProductionStatus) => void;
  optimisticDoneByKey: Record<string, boolean>;
  setOptimisticDoneByKey: (next: Record<string, boolean>) => void;
}) {
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const [, startMilestoneTransition] = useTransition();

  // Cascade-aware effective doneAt for each sub-step — mirrors SubStepBar.
  const isStepDone = (s: SubStepInfo): boolean => {
    const k = subStepKey(s);
    if (k in optimisticDoneByKey) return optimisticDoneByKey[k];
    return !!s.doneAt;
  };
  const firstUndoneIdx = (() => {
    if (cancelled) return -1;
    for (let i = 0; i < allSubSteps.length; i++) {
      if (!isStepDone(allSubSteps[i])) return i;
    }
    return -1;
  })();
  // Milestone state derived from sub-step cascade so the main tick and the
  // numbered circle below it can never disagree. categoryState() (the legacy
  // status-based comparison) reported "passed" for the terminal categories
  // even when their only canonical was still active, because it compares
  // STAGE_INDEX[status] >= STAGE_INDEX[endStage] — true at status=endStage.
  // Anchoring on firstUndoneIdx removes that boundary inconsistency.
  const milestoneState = (cat: (typeof STAGE_CATEGORIES)[number]): 'passed' | 'active' | 'pending' => {
    if (cancelled) return 'pending';
    const catIdxs = allSubSteps
      .map((s, i) => (s.cat.key === cat.key ? i : -1))
      .filter((i) => i >= 0);
    if (catIdxs.length === 0) return 'pending';
    const firstCatIdx = catIdxs[0];
    const lastCatIdx = catIdxs[catIdxs.length - 1];
    if (firstUndoneIdx < 0) return 'passed';
    if (firstUndoneIdx > lastCatIdx) return 'passed';
    if (firstUndoneIdx >= firstCatIdx) return 'active';
    return 'pending';
  };

  // Sequential cascade — clicking a milestone marks ALL canonical sub-stages
  // up to and including that milestone's endStage as DONE (and all customs in
  // between), or unmarks the entire category if it's already passed. Mirrors
  // SubStepBar.onStepClick — single source of truth for "kroki po kolei".
  const onClickCategory = (cat: (typeof STAGE_CATEGORIES)[number]) => {
    if (cancelled) return;
    const state = milestoneState(cat);
    const mode: 'mark' | 'unmark' = state === 'passed' ? 'unmark' : 'mark';

    // Target: the canonical step at the FIRST sub-stage of this category for
    // unmark (so the whole category becomes not-done), or the LAST sub-stage
    // (endStage) for mark.
    const targetStage = mode === 'mark' ? cat.endStage : cat.subStages[0];
    const targetIdxInAll = allSubSteps.findIndex(
      (s) => s.kind === 'canonical' && s.stage === targetStage,
    );
    if (targetIdxInAll < 0) return;

    const lastDoneIdx = mode === 'mark' ? targetIdxInAll : targetIdxInAll - 1;

    // Optimistic: write the same cascade-shape doneAt map the SubStepBar
    // would write — every step at idx ≤ lastDoneIdx becomes done, the rest
    // become not done. Without this, the sub-step circles wouldn't react
    // to a milestone click until the server revalidate landed (because the
    // sub-step rendering reads from optimisticDoneByKey + s.doneAt, never
    // from the canonical-derived ProductionStatus).
    setOptimisticDoneByKey(cascadeOverrides(allSubSteps, lastDoneIdx));
    onChange(statusAfterCascade(allSubSteps, lastDoneIdx));

    startMilestoneTransition(() => {
      // New cascade signature: stepId is the canonical step's id, which —
      // for migrated productions — equals its old ProductionStatus value.
      cascadeStepsTo(productionId, targetStage, mode);
    });
  };

  const tickX = (cp: CheckpointInfo) => (cp.dayIdx + 0.5) * dayWidthPct;

  if (checkpoints.length === 0) return null;

  const sortedByX = [...checkpoints].sort((a, b) => a.dayIdx - b.dayIdx);
  const firstX = tickX(sortedByX[0]);
  const lastX = tickX(sortedByX[sortedByX.length - 1]);
  const trackWidth = Math.max(0, lastX - firstX);

  // Progress fill: stretch from first tick to the rightmost passed tick.
  const passedTicksByX = sortedByX.filter((cp) => milestoneState(cp.cat) === 'passed');
  const lastPassedX = passedTicksByX.length > 0 ? tickX(passedTicksByX[passedTicksByX.length - 1]) : firstX;
  const progressWidth = Math.max(0, lastPassedX - firstX);

  // Track sits below the 88px-tall bands strip, with breathing room.
  const TRACK_TOP = '7.5rem';
  const LABEL_TOP = '9rem';

  return (
    <>
      {/* Track (background) */}
      <div
        className="absolute h-[3px] rounded-full bg-border pointer-events-none"
        style={{ top: TRACK_TOP, left: `${firstX}%`, width: `${trackWidth}%`, transform: 'translateY(-50%)' }}
        aria-hidden
      />
      {/* Track (progress fill) */}
      <div
        className="absolute h-[3px] rounded-full pointer-events-none transition-[width] duration-300 ease-out"
        style={{
          top: TRACK_TOP,
          left: `${firstX}%`,
          width: `${progressWidth}%`,
          transform: 'translateY(-50%)',
          background: 'linear-gradient(90deg, var(--accent-blue-soft) 0%, var(--accent-blue) 100%)',
        }}
        aria-hidden
      />

      {/* 5 milestone ticks — positioned at calendar dates */}
      {checkpoints.map((cp) => {
        const state = milestoneState(cp.cat);
        const isHovered = hoveredKey === cp.cat.key;
        const tentative = cp.source === 'tentative';
        const x = tickX(cp);
        const tooltip = tickTooltip(cp, state);

        return (
          <Button
            key={cp.cat.key}
            variant="ghost"
            disabled={cancelled}
            onMouseEnter={() => setHoveredKey(cp.cat.key)}
            onMouseLeave={() => setHoveredKey(null)}
            onFocus={() => setHoveredKey(cp.cat.key)}
            onBlur={() => setHoveredKey(null)}
            onClick={() => onClickCategory(cp.cat)}
            aria-label={tooltip}
            aria-current={state === 'active' ? 'step' : undefined}
            aria-pressed={state === 'passed'}
            title={tooltip}
            className={tickClass(state, tentative, cancelled, isHovered)}
            style={{
              top: TRACK_TOP,
              left: `${x}%`,
              transform: 'translate(-50%, -50%)',
            }}
          >
            <TickIcon state={state} />
            {cp.outOfWindow ? (
              <span
                aria-hidden
                className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 rounded-full bg-background border border-border grid place-items-center text-[8px] font-bold text-muted-foreground"
              >
                {cp.outOfWindow === 'before' ? '‹' : '›'}
              </span>
            ) : null}
          </Button>
        );
      })}

      <MilestoneLabels
        checkpoints={checkpoints}
        milestoneState={milestoneState}
        tickX={tickX}
        LABEL_TOP={LABEL_TOP}
      />
    </>
  );
}

export type CheckpointInfo = {
  cat: (typeof STAGE_CATEGORIES)[number];
  date: Date;
  source: MilestoneSource;
  dayIdx: number;
  outOfWindow: 'before' | 'after' | null;
  state: 'passed' | 'active' | 'pending';
};

