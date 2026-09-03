'use client';

import { memo, useCallback, useMemo, useOptimistic, useState, useTransition } from 'react';
import type { ProductionStatus } from '../../../drizzle/schema';
import { DAY_MS, STAGE_INDEX, subStepKey, type GanttRow } from './gantt-geometry';
import { buildRowModel } from './gantt-row-model';
import { GanttRowRail } from './gantt-row-rail';
import { GanttRowBands } from './gantt-row-bands';
import { GanttRowGuides } from './gantt-row-guides';
import { PipelineMilestones } from './gantt-milestones';
import { SubStepBar, type SubStepInfo } from './gantt-substep-bar';
import { ExpandedDetails } from './gantt-expanded';

/**
 * Jeden wiersz ganta — jedna produkcja. Skorupa: stan optymistyczny, model
 * wiersza z `gantt-row-model.ts` i złożenie czterech warstw (szyna, pasma,
 * prowadnice, kamienie milowe). Wydzielony z `gantt-view.tsx` w F2-02.
 */
export const GanttRowView = memo(function GanttRowView({
  row,
  firstDay,
  totalDays,
  dayWidthPct,
  days,
  todayIdx,
  todayInWindow,
  isFirstOfArtist,
  showArtistGap,
}: {
  row: GanttRow;
  firstDay: Date;
  totalDays: number;
  dayWidthPct: number;
  days: { isWeekend: boolean }[];
  todayIdx: number;
  todayInWindow: boolean;
  isFirstOfArtist: boolean;
  showArtistGap: boolean;
}) {
  const [optimisticStatus, setOptimisticStatus] = useOptimistic(row.status);
  const [, startTransition] = useTransition();
  const [expanded, setExpanded] = useState(false);
  // Shared optimistic done-state keyed by subStepKey. Both PipelineMilestones
  // (clicking the Outreach/Ustalenia/etc. tick) and SubStepBar (clicking a
  // numbered circle) update this same map so the two surfaces never disagree
  // during the optimistic window. Without this lift, clicking the milestone
  // tick would only update `optimisticStatus` while the per-step doneAts
  // (which now drive sub-step rendering after the cascade-doneAt rewrite)
  // stayed stale until the server revalidate landed.
  const [optimisticDoneByKey, setOptimisticDoneByKey] = useState<Record<string, boolean>>({});

  // Stabilna referencja: `setStatus` leci w dół do dwóch pasków, a te są
  // przerysowywane przy każdym kliknięciu w krok.
  const setStatus = useCallback((next: ProductionStatus) => {
    // Optimistic-only update — the children (PipelineMilestones, SubStepBar)
    // call `cascadeStepsTo` themselves to persist; this just keeps the UI
    // mirror in sync until the cascade revalidates.
    startTransition(() => {
      setOptimisticStatus(next);
    });
  }, [setOptimisticStatus, startTransition]);
  // Cała geometria wiersza (pasma, kamienie, podkroki, pinezki) w jednym
  // wyliczeniu — zależy tylko od danych wiersza, okna i statusu.
  const { frameBands, checkpoints, allSubSteps, subSteps, stagePins } = useMemo(
    () => buildRowModel(row, firstDay, totalDays, optimisticStatus),
    [row, firstDay, totalDays, optimisticStatus],
  );

  // Right column dynamic height. After removing the per-step date chips and
  // the floating active-step label, nothing extends below the sub-bar circle
  // (last visual at ~14rem). Half a rem of breathing room keeps the bottom
  // border tidy.
  const rightColumnHeight = 14.75;

  const t0Days = Math.round((row.t0At.getTime() - Date.now()) / DAY_MS);
  const tLabel = t0Days === 0 ? 'T-0' : t0Days > 0 ? `T-${t0Days}` : `T+${Math.abs(t0Days)}`;
  const displayName = row.artistName ?? row.title;
  const orphanWithArtist = row.type === 'with-artist' && !row.artistName;
  const subtitle = row.artistName
    ? row.artistHandle ?? row.title
    : orphanWithArtist
      ? 'bez artysty - przypisz w produkcji'
      : 'solo';
  const cancelled = optimisticStatus === 'cancelled';

  // Per-step state derived strictly from each step's own doneAt (the data
  // truth-source) plus visual order. The first step in visual order whose
  // doneAt is null is the active one; everything before it is passed
  // (cascade-implied), everything after it is pending. We deliberately
  // don't consult ProductionStatus or the legacy positionAfter rule: those
  // produced phantom passed/active states that diverged from the actual
  // doneAt and made click-to-unmark feel unresponsive.
  // Effective doneAt — optimistic override (set by either the milestone
  // click or the sub-step click) wins over the row.steps server value so
  // both surfaces stay in lockstep during the optimistic window.
  const stripIsDone = (s: SubStepInfo): boolean => {
    const k = subStepKey(s);
    if (k in optimisticDoneByKey) return optimisticDoneByKey[k];
    return !!s.doneAt;
  };
  const stripFirstUndoneIdx = (() => {
    if (cancelled) return -1;
    for (let i = 0; i < allSubSteps.length; i++) {
      if (!stripIsDone(allSubSteps[i])) return i;
    }
    return -1;
  })();
  const stepStateOf = (s: SubStepInfo): 'passed' | 'active' | 'pending' => {
    if (cancelled) return 'pending';
    const i = allSubSteps.indexOf(s);
    if (stripFirstUndoneIdx < 0) return 'passed';
    if (i < 0) return stripIsDone(s) ? 'passed' : 'pending';
    if (i < stripFirstUndoneIdx) return 'passed';
    if (i === stripFirstUndoneIdx) return 'active';
    return 'pending';
  };
  // "All done" = production has reached publishing AND every custom step is
  // checked off. Publishing is the terminal status; once status='publishing'
  // and no customs remain, the workflow has nothing left to mark.
  const customsRemaining = allSubSteps.some(
    (s) => s.kind === 'custom' && stepStateOf(s) !== 'passed',
  );
  const allDone =
    !cancelled && STAGE_INDEX[optimisticStatus] >= STAGE_INDEX.publishing && !customsRemaining;
  const nextStep =
    cancelled || allDone
      ? null
      : allSubSteps.find((s) => stepStateOf(s) !== 'passed') ?? null;
  const totalStepCount = allSubSteps.length;

  return (
    <div
      className={`${
        showArtistGap
          ? 'mt-10 pt-4 border-t-[3px] border-double border-foreground/25'
          : isFirstOfArtist
            ? 'border-t border-border/70'
            : ''
      } hover:bg-muted/15 ui-transition group`}
    >
      <div
        className="grid gap-0"
        style={{ gridTemplateColumns: `22rem 1fr` }}
      >
        <GanttRowRail
          row={row}
          displayName={displayName}
          subtitle={subtitle}
          orphanWithArtist={orphanWithArtist}
          cancelled={cancelled}
          allDone={allDone}
          nextStep={nextStep}
          totalStepCount={totalStepCount}
          isFirstOfArtist={isFirstOfArtist}
          expanded={expanded}
          setExpanded={setExpanded}
        />

      {/* RIGHT: timeline. Three vertically-stacked layers, all sharing the same
          calendar coordinate system (% of dayWidthPct):
            1. Bands T1/T2/T3 (top) with sub-stage pins for recorded dates
            2. Main 5-milestone bar (Outreach/Ustalenia/Nagr/Mont/Pub) at the
               recorded/default date of each milestone end-stage + labels
            3. 9-step numbered sub-bar — each step at its own calendar date so
               steps 1-3 land under Outreach, 4-6 under Ustalenia, 7 under Nagr,
               8 under Mont, 9 under Pub. The sub-bar physically cannot exceed
               the T1+T2+T3 span because no step has a default offset outside
               of those weeks. */}
      <div
        className="relative"
        style={{ height: `${rightColumnHeight}rem` }}
      >
        {/* Bands strip — calendar-grid background and weekend stripes are
            confined to this top region. Below, the milestone area has a clean
            background so the ticks/labels are not visually crowded. */}
        <GanttRowBands
          row={row}
          displayName={displayName}
          days={days}
          dayWidthPct={dayWidthPct}
          frameBands={frameBands}
          stagePins={stagePins}
        />

        {/* Tree-pattern guides — for each category, the END canonical sub-step
            has a SOLID vertical "trunk" running from its circle up to the
            milestone tick. Earlier canonical AND inserted custom sub-steps
            have a SHORT dashed vertical going up to a junction height, then a
            dashed horizontal connector merging into the trunk. */}
        <GanttRowGuides subSteps={subSteps} dayWidthPct={dayWidthPct} />
        {/* Track + 5 milestones positioned at their calendar dates.
            Track connects them visually so the row reads as one journey. */}
        <PipelineMilestones
          productionId={row.id}
          checkpoints={checkpoints}
          allSubSteps={allSubSteps}
          dayWidthPct={dayWidthPct}
          cancelled={cancelled}
          onChange={setStatus}
          optimisticDoneByKey={optimisticDoneByKey}
          setOptimisticDoneByKey={setOptimisticDoneByKey}
        />

        {/* Today vertical line — full height, passes through both regions */}
        {todayInWindow ? (
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-rose-500/80 pointer-events-none z-[5]"
            style={{ left: `calc(${(todayIdx + 0.5) * dayWidthPct}% - 1px)` }}
            aria-hidden
          />
        ) : null}

        {cancelled ? (
          <div
            className="absolute inset-0 bg-rose-500/5 pointer-events-none flex items-center justify-center"
            aria-hidden
          >
            <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-rose-700 bg-rose-100/80 px-2 py-0.5 rounded">
              anulowane
            </span>
          </div>
        ) : null}

        {/* 9-step numbered sub-bar — positioned at each step's calendar date so
            it physically clusters under its parent milestone. */}
        <SubStepBar
          productionId={row.id}
          subSteps={subSteps}
          allSubSteps={allSubSteps}
          dayWidthPct={dayWidthPct}
          status={optimisticStatus}
          cancelled={cancelled}
          onChange={setStatus}
          optimisticDoneByKey={optimisticDoneByKey}
          setOptimisticDoneByKey={setOptimisticDoneByKey}
        />
      </div>
      </div>

      {expanded ? (
        <div className="animate-fade-up">
          <ExpandedDetails row={row} tLabel={tLabel} />
        </div>
      ) : null}
    </div>
  );
});
