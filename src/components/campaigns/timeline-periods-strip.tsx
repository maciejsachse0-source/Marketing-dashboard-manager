/** Pas narracji kampanii: kolorowe bandy okresów T1..Tn z etykietami i licznikami.
 *  Wydzielony z `timeline.tsx` przy rozbiciu pliku (F3-08), treść bez zmian. */
import type { TemplatePeriod } from '@/lib/production-periods';
import { fmtDayMonth, toneForIndex } from '@/lib/period-tones';
import { addDays } from '@/lib/dates';
import { WeekendShading } from './timeline-shared';

export function PeriodsStrip({
  kickoffAt,
  periods,
  pctForOffset,
  totalDays,
  minDate,
  showsToday,
  today,
  pctForDate,
}: {
  kickoffAt: Date;
  periods: TemplatePeriod[];
  pctForOffset: (anchor: Date, offsetDays: number) => number;
  totalDays: number;
  minDate: Date;
  showsToday: boolean;
  today: Date;
  pctForDate: (d: Date) => number;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2 label-micro-wide text-muted-foreground font-medium">
        <span className="pill-label pill-label-sm">Narracja</span>
      </div>

      {/* Marker label row — sits ABOVE the period strip so labels can extend
       *  freely without being clipped by the strip's overflow:hidden. The
       *  vertical lines are drawn inside the strip below for visual continuity.
       *  Per-period start/end dates are intentionally not duplicated here —
       *  each band already shows its own "start → end" inline, and stacking
       *  another date row on top caused collisions on short periods. */}
      <div className="relative h-3.5 select-none">
        <div
          className="absolute -translate-x-1/2 text-[9px] uppercase tracking-[0.14em] font-bold px-1 rounded-sm bg-foreground text-background whitespace-nowrap"
          style={{ left: `${pctForDate(kickoffAt)}%`, top: 0 }}
        >
          kickoff
        </div>
        {showsToday ? (
          <div
            className="absolute -translate-x-1/2 text-[9px] uppercase tracking-[0.14em] font-bold px-1 rounded-sm bg-rose-500 text-white whitespace-nowrap"
            style={{ left: `${pctForDate(today)}%`, top: 0 }}
          >
            dziś
          </div>
        ) : null}
      </div>

      {/* Period strip — colored bands per period with name + dates + free
       *  description. The description IS the period now: no more milestone
       *  pins or counters — what the user wants to communicate during the
       *  band lives directly inside it. Taller (h-24) than before to fit
       *  the description without truncating. */}
      <div
        className="relative h-24 rounded-lg border border-border bg-muted/30"
        aria-label="Pas narracji kampanii - okresy T1..Tn"
      >
        <div className="absolute inset-0 overflow-hidden rounded-lg">
          <WeekendShading minDate={minDate} totalDays={totalDays} />
          {periods.map((p, idx) => {
            const tone = toneForIndex(idx);
            const left = pctForOffset(kickoffAt, p.startOffsetDays);
            const right = pctForOffset(kickoffAt, p.endOffsetDays + 1);
            const width = Math.max(0, right - left);
            const lengthDays = p.endOffsetDays - p.startOffsetDays + 1;

            const startDate = addDays(kickoffAt, p.startOffsetDays);
            const endDate = addDays(kickoffAt, p.endOffsetDays);

            const phaseTitle = p.name ?? p.code;

            return (
              <div
                key={p.code}
                className={`absolute top-0 bottom-0 ${tone.bg} border-r border-border/60 px-2 py-1.5 overflow-hidden`}
                style={{ left: `${left}%`, width: `${width}%` }}
                title={`${p.code}, ${phaseTitle}: ${fmtDayMonth(startDate)} do ${fmtDayMonth(endDate)}, ${lengthDays} dni${p.description ? `\n\n${p.description}` : ''}`}
              >
                <div className="flex items-center gap-1.5">
                  <span
                    className={`inline-flex items-center justify-center min-w-[1.5rem] h-4 px-1 rounded text-[9px] font-bold tracking-[0.16em] tabular-nums ${tone.bar} ${tone.ink}`}
                  >
                    {p.code}
                  </span>
                  {p.name ? (
                    <span
                      className={`text-[10px] font-bold tracking-tight ${tone.ink} truncate`}
                    >
                      {p.name}
                    </span>
                  ) : null}
                  <span className="text-[9px] tabular-nums text-muted-foreground/80 ml-auto">
                    {lengthDays}d
                  </span>
                </div>
                <div className={`text-[9px] tabular-nums ${tone.ink} opacity-70 mt-0.5 truncate`}>
                  {fmtDayMonth(startDate)} do {fmtDayMonth(endDate)}
                </div>
                {p.description ? (
                  <div
                    className={`text-[10px] leading-snug ${tone.ink} opacity-90 mt-1 line-clamp-3`}
                  >
                    {p.description}
                  </div>
                ) : (
                  <div className="text-[9px] leading-tight text-muted-foreground/60 italic mt-1">
                    Dodaj opis w edytorze poniżej
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* kickoff vertical line — label rendered in the row above the strip */}
        <div
          className="absolute top-0 bottom-0 w-px bg-foreground/80 pointer-events-none"
          style={{ left: `${pctForDate(kickoffAt)}%` }}
        />

        {/* today vertical line */}
        {showsToday ? (
          <div
            className="absolute top-0 bottom-0 w-px bg-rose-500 pointer-events-none"
            style={{ left: `${pctForDate(today)}%` }}
          />
        ) : null}
      </div>
    </div>
  );
}
