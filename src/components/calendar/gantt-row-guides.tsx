'use client';

import { STAGE_CATEGORIES } from './gantt-geometry';
import type { SubStepInfo } from './gantt-substep-bar';

/**
 * Prowadnice w kształcie grabi: dla każdej kategorii pionowy pień od kroku
 * końcowego do kamienia milowego plus przerywane odnogi pozostałych kroków.
 * Przeniesione bez zmiany treści z `gantt-view.tsx` w F2-02.
 */
export function GanttRowGuides({
  subSteps,
  dayWidthPct,
}: {
  subSteps: SubStepInfo[];
  dayWidthPct: number;
}) {
  return (
    <>
        {STAGE_CATEGORIES.map((cat) => {
          const inCat = subSteps.filter((s) => s.cat.key === cat.key);
          if (inCat.length === 0) return null;
          const endStep =
            inCat.find((s) => s.kind === 'canonical' && s.stage === cat.endStage) ?? inCat[inCat.length - 1];
          const endX = (endStep.dayIdx + 0.5) * dayWidthPct;
          // Trunk (solid pionowy łącznik milestone→circle) — średnio widoczny.
          // Branches (dashed) — wyraźnie cichsze, żeby gęstwina kreseł w
          // kategoriach z wieloma krokami (np. 6+ w T1) nie zalewała wiersza.
          const trunkBorder =
            cat.frame === 'T1'
              ? 'border-amber-400/60'
              : cat.frame === 'T2'
                ? 'border-violet-400/60'
                : 'border-emerald-400/60';
          const branchBorder =
            cat.frame === 'T1'
              ? 'border-amber-400/40'
              : cat.frame === 'T2'
                ? 'border-violet-400/40'
                : 'border-emerald-400/40';

          // Vertical positions:
          //   - milestone tick bottom edge ≈ 8.25rem (main bar TRACK_TOP 7.5rem + tick 0.75rem)
          //   - sub-step circle top edge ≈ 13.125rem (sub-bar TRACK_TOP 13.5rem - 0.375rem)
          //   - JUNCTION (where horizontal connectors live) — sits in the upper
          //     part of the gap so the rake "sweeps" up toward the milestone
          const TRUNK_TOP = '8.25rem'; // top of the trunk/junction verticals
          const JUNCTION_Y = '9.5rem'; // where horizontal arms meet the trunk
          const JUNCTION_TO_SUB_HEIGHT = '3.625rem'; // 13.125 - 9.5

          return (
            <div key={`tree-${cat.key}`} aria-hidden>
              {/* Trunk: solid vertical from milestone tick down to sub-bar at end-step x */}
              <div
                className={`absolute pointer-events-none border-l-2 ${trunkBorder}`}
                style={{
                  top: TRUNK_TOP,
                  height: '4.875rem', // 13.125 - 8.25
                  left: `${endX}%`,
                  transform: 'translateX(-0.5px)',
                }}
              />

              {/* Branches: for each non-end sub-step, draw the rake tooth.
                  - vertical from sub-step circle up to JUNCTION_Y (dashed)
                  - horizontal from this x to endX at JUNCTION_Y (dashed) */}
              {inCat
                .filter((s) => s !== endStep)
                .map((s) => {
                  const x = (s.dayIdx + 0.5) * dayWidthPct;
                  const goesRight = x < endX;
                  const horizLeft = goesRight ? x : endX;
                  const horizWidth = Math.abs(endX - x);
                  const branchKey = s.kind === 'canonical' ? `cn:${s.stage}` : `cs:${s.customId}`;
                  return (
                    <div key={`branch-${branchKey}`}>
                      {/* tooth (vertical) — from circle up to junction */}
                      <div
                        className={`absolute pointer-events-none border-l-2 border-dashed ${branchBorder}`}
                        style={{
                          top: JUNCTION_Y,
                          height: JUNCTION_TO_SUB_HEIGHT,
                          left: `${x}%`,
                          transform: 'translateX(-0.5px)',
                        }}
                      />
                      {/* connector (horizontal) — from this x to trunk x */}
                      <div
                        className={`absolute pointer-events-none border-t-2 border-dashed ${branchBorder}`}
                        style={{
                          top: JUNCTION_Y,
                          left: `${horizLeft}%`,
                          width: `${horizWidth}%`,
                          transform: 'translateY(-1px)',
                        }}
                      />
                    </div>
                  );
                })}
            </div>
          );
        })}

    </>
  );
}
