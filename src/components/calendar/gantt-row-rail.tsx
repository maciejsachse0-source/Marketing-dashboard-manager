'use client';

import Link from 'next/link';
import { ChevronDown } from 'lucide-react';
import { PersonAvatar, SoloAvatar, OrphanArtistAvatar } from '@/components/productions/artist-avatar';
import { ProductionPeopleStack } from '@/components/productions/production-people-stack';
import { NextStepIndicator } from './gantt-next-step';
import type { GanttRow } from './gantt-geometry';
import type { SubStepInfo } from './gantt-substep-bar';
import { Button } from '@/components/ui/button';

/**
 * Lewa szyna wiersza ganta: awatar, nazwa artysty, wskaźnik następnego kroku
 * i przycisk rozwijania. Przeniesiona bez zmiany treści z `gantt-view.tsx`
 * w F2-02.
 */
export function GanttRowRail({
  row,
  displayName,
  subtitle,
  orphanWithArtist,
  cancelled,
  allDone,
  nextStep,
  totalStepCount,
  isFirstOfArtist,
  expanded,
  setExpanded,
}: {
  row: GanttRow;
  displayName: string;
  subtitle: string;
  orphanWithArtist: boolean;
  cancelled: boolean;
  allDone: boolean;
  nextStep: SubStepInfo | null;
  totalStepCount: number;
  isFirstOfArtist: boolean;
  expanded: boolean;
  setExpanded: (v: boolean | ((prev: boolean) => boolean)) => void;
}) {
  // LEFT: meta + progress bar — sticky-left so the artist name +
  // next-step indicator stay readable while the user scrolls the
  // timeline horizontally. z-30 so it sits above the gantt's step
  // buttons (z-20) but below the sticky header (z-40).
  return (
        <div
          className="pl-5 pr-4 py-3.5 flex flex-col gap-2.5 border-r border-border/40 sticky left-0 z-30 bg-card shadow-[2px_0_6px_-2px_rgb(0_0_0_/_0.08)]"
        >
          {isFirstOfArtist ? (
            <>
              <div className="flex items-start gap-3">
                {row.artistName ? (
                  <PersonAvatar
                    name={row.artistName}
                    seed={row.artistHandle ?? row.artistName}
                    size="lg"
                    kind="artist"
                  />
                ) : orphanWithArtist ? (
                  <OrphanArtistAvatar size="lg" />
                ) : (
                  <SoloAvatar size="lg" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start gap-1">
                    <Link
                      href={`/productions/${row.id}`}
                      data-dense
                      className="flex-1 block text-base font-bold tracking-tight truncate hover:text-[var(--accent-blue)] transition"
                      title={`${displayName} - pełny widok produkcji`}
                    >
                      {displayName}
                    </Link>
                    <Button
                      variant="ghost"
                      onClick={() => setExpanded((v) => !v)}
                      className="h-auto border-0 shrink-0 p-1 rounded-md hover:bg-muted active:scale-90 ui-transition text-muted-foreground hover:text-foreground"
                      aria-expanded={expanded}
                      aria-label={expanded ? 'Zwiń szczegóły' : 'Rozwiń szczegóły'}
                      title={expanded ? 'Zwiń szczegóły' : 'Rozwiń szczegóły'}
                    >
                      <ChevronDown
                        className={`size-4 transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] ${expanded ? 'rotate-180' : ''}`}
                      />
                    </Button>
                  </div>
                  <div
                    className={`text-xs truncate leading-tight mt-0.5 ${
                      orphanWithArtist ? 'text-rose-600 font-semibold' : 'text-muted-foreground'
                    }`}
                  >
                    {subtitle}
                  </div>
                </div>
              </div>

              {/* Next-step indicator — sibling of the account row (not nested
                  beside the avatar) so it spans the full meta-column width,
                  matching the standalone follow-up rows below. */}
              <NextStepIndicator
                productionId={row.id}
                cancelled={cancelled}
                allDone={allDone}
                nextStep={nextStep}
                totalSteps={totalStepCount}
              />

              <div className="flex items-center gap-1.5 text-[11px] mt-auto">
                <ProductionPeopleStack
                  type={row.type}
                  artistName={row.artistName}
                  artistHandle={row.artistHandle}
                  videographerName={row.videographerName}
                />
              </div>
            </>
          ) : (
            // Same-artist follow-up row: account header is suppressed so the
            // cluster reads as one artist with multiple parallel tracks. The
            // people-stack still renders so solo vs. with-artist (and which
            // videographer) is visible at a glance per track.
            <>
              <NextStepIndicator
                productionId={row.id}
                cancelled={cancelled}
                allDone={allDone}
                nextStep={nextStep}
                totalSteps={totalStepCount}
              />
              <div className="flex items-center gap-1.5 text-[11px] mt-auto">
                <ProductionPeopleStack
                  type={row.type}
                  artistName={row.artistName}
                  artistHandle={row.artistHandle}
                  videographerName={row.videographerName}
                />
              </div>
            </>
          )}
        </div>
  );
}
