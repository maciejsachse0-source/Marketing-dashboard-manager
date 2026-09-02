'use client';

import { useMemo } from 'react';
import { startOfDay, dayDiff, type GanttRow } from './gantt-geometry';
import { CampaignGanttNarrativeRow } from '@/components/campaigns/gantt-narrative-row';
import { FRAME_TONE } from './gantt-frames';
import { GanttAxisHeader } from './gantt-header';
import { GanttRowView } from './gantt-row';
import { SectionHeaderRow, LegendChip, LegendDot } from './gantt-legend';

export type { GanttRow };



export function GanttView({
  weeks,
  rows,
  campaigns = [],
  minWidthPx = 1900,
  headerDensity = 'days',
}: {
  weeks: Date[];
  rows: GanttRow[];
  /** Active campaigns whose narrative arc overlaps the visible window — each
   *  rendered as a single-row strip directly under the days header so the
   *  user reads the campaign-level narrative against the same time axis as
   *  the production rows below. */
  campaigns?: import('@/components/campaigns/gantt-narrative-row').GanttNarrativeCampaign[];
  minWidthPx?: number;
  /** Header granularity. 'days' renders the full per-day strip (current
   *  behavior, best for ≤12 weeks). 'weeks' hides the day strip — useful
   *  when zooming to a few months. 'months' additionally renders a month
   *  band above the week labels so the user gets a year-wide overview. */
  headerDensity?: 'days' | 'weeks' | 'months';
}) {
  // Oś liczona raz na zestaw tygodni. `days` bywa listą 364 obiektów przy
  // widoku kwartału i jest przekazywane KAŻDEMU wierszowi — bez memoizacji
  // każdy stan (rozwinięcie wiersza, klik w krok) budował ją od nowa
  // i unieważniał `memo` na wszystkich wierszach naraz.
  const axis = useMemo(() => {
    if (weeks.length === 0) return null;
    const firstDay = startOfDay(weeks[0]);
    const totalWeeks = weeks.length;
    const totalDays = totalWeeks * 7;
    const todayIdx = Math.round(dayDiff(new Date(), firstDay));
    const days: { date: Date; weekday: string; dom: string; isMonday: boolean; isWeekend: boolean }[] = [];
    for (let i = 0; i < totalDays; i++) {
      const d = new Date(firstDay);
      d.setDate(d.getDate() + i);
      days.push({
        date: d,
        weekday: d.toLocaleDateString('pl-PL', { weekday: 'short' }),
        dom: String(d.getDate()),
        isMonday: d.getDay() === 1,
        isWeekend: d.getDay() === 0 || d.getDay() === 6,
      });
    }
    return {
      firstDay,
      totalWeeks,
      totalDays,
      dayWidthPct: 100 / totalDays,
      todayIdx,
      todayInWindow: todayIdx >= 0 && todayIdx < totalDays,
      days,
    };
  }, [weeks]);

  if (!axis) return null;
  const { firstDay, totalWeeks, totalDays, dayWidthPct, todayIdx, todayInWindow, days } = axis;

  return (
    <div
      className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm"
      style={{ containerType: 'inline-size' }}
    >
      <div className="relative" style={{ minWidth: `${minWidthPx}px` }}>
        {/* Legend — concise, scannable */}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 px-5 py-3 border-b border-border bg-muted/20 text-sm">
          <LegendChip code="T1" tone={FRAME_TONE.T1.chip} label="Outreach + ustalenia" />
          <LegendChip code="T2" tone={FRAME_TONE.T2.chip} label="Nagrywka + obróbka" />
          <LegendChip code="T3" tone={FRAME_TONE.T3.chip} label="Publikacja" />
          <span className="ml-auto inline-flex items-center gap-4 text-xs text-muted-foreground">
            <LegendDot variant="solid" label="data zapisana" />
            <LegendDot variant="dashed" label="domyślna pozycja - ustaw datę" />
          </span>
        </div>

        {/* Week + day header */}
        <GanttAxisHeader
          weeks={weeks}
          firstDay={firstDay}
          totalWeeks={totalWeeks}
          totalDays={totalDays}
          days={days}
          todayIdx={todayIdx}
          headerDensity={headerDensity}
        />

        {/* Campaign narrative strips — sit directly under the days header so
         *  the campaign-level T-bands (Build-up, Reveal, Premiera, Afterglow…)
         *  align with the production rows below on the same day grid. The
         *  left rail acts as the visual NARRACJA header — sticky, labeled,
         *  with the campaign name and kickoff date below the bars. */}
        {campaigns.length > 0 ? (
          <div className="border-b-2 border-foreground/15">
            <SectionHeaderRow
              label="NARRACJA"
              hint={`${campaigns.length} ${campaigns.length === 1 ? 'kampania' : campaigns.length < 5 ? 'kampanie' : 'kampanii'}`}
            />
            {campaigns.map((c) => (
              <CampaignGanttNarrativeRow
                key={c.id}
                campaign={c}
                firstDay={firstDay}
                totalDays={totalDays}
              />
            ))}
          </div>
        ) : null}

        {rows.length === 0 ? (
          <div className="px-6 py-20 text-center">
            <div className="text-sm font-semibold text-foreground mb-1">
              Brak produkcji w tym oknie
            </div>
            <p className="text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
              Spróbuj rozszerzyć zoom, zmienić zakres tygodni, zresetować filtry albo
              utworzyć nową produkcję - milestone&apos;y pojawią się jako pinezki na osi.
            </p>
          </div>
        ) : null}

        <div className="flex flex-col stagger-children">
          {rows.map((row, idx) => {
            // Visually merge consecutive rows that belong to the same artist:
            // hide the account block on follow-ups and drop the separator line
            // so the eye reads the cluster as one artist with multiple tracks.
            const prev = idx > 0 ? rows[idx - 1] : null;
            const sameArtistAsPrev =
              !!row.artistName &&
              !!prev?.artistName &&
              prev.artistName === row.artistName &&
              prev.artistHandle === row.artistHandle;
            const isFirstOfArtist = !sameArtistAsPrev;
            return (
              <GanttRowView
                key={row.id}
                row={row}
                firstDay={firstDay}
                totalDays={totalDays}
                dayWidthPct={dayWidthPct}
                days={days}
                todayIdx={todayIdx}
                todayInWindow={todayInWindow}
                isFirstOfArtist={isFirstOfArtist}
                showArtistGap={isFirstOfArtist && idx > 0}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

