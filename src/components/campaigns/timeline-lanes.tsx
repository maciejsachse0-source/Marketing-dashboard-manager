/** Dwa pasy pod osią: wiersze produkcji oraz pinezki luźnych wpisów kalendarza.
 *  Wydzielone z `timeline.tsx` przy rozbiciu pliku (F3-08), treść bez zmian. */
import type { CalendarEntry } from '../../../drizzle/schema';
import { TYPE_COLOR, TYPE_LABEL } from '../calendar/type-color';
import { DAY_MS, WeekendShading, type PeriodBand, type ProductionWithArtist } from './timeline-shared';
import { ProductionRow } from './timeline-production-row';


export function ProductionsLane({
  productions,
  pctForOffset,
  pctForDate,
  minDate,
  maxDate,
  showsToday,
  today,
  campaignPeriodBands,
}: {
  productions: ProductionWithArtist[];
  pctForOffset: (anchor: Date, offsetDays: number) => number;
  pctForDate: (d: Date) => number;
  minDate: Date;
  maxDate: Date;
  showsToday: boolean;
  today: Date;
  campaignPeriodBands: PeriodBand[];
}) {
  // Sort by t0At so the oldest production sits at the top.
  const sorted = [...productions].sort(
    (a, b) => a.t0At.getTime() - b.t0At.getTime(),
  );
  const totalDays =
    Math.round((maxDate.getTime() - minDate.getTime()) / DAY_MS) + 1;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.14em] text-muted-foreground font-medium">
        <span className="pill-label pill-label-sm">Produkcje artystów</span>
        <span>{sorted.length} {sorted.length === 1 ? 'produkcja' : sorted.length < 5 ? 'produkcje' : 'produkcji'}</span>
      </div>
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        {sorted.map((p, idx) => (
          <ProductionRow
            key={p.id}
            production={p}
            pctForOffset={pctForOffset}
            pctForDate={pctForDate}
            minDate={minDate}
            totalDays={totalDays}
            isLast={idx === sorted.length - 1}
            showsToday={showsToday}
            today={today}
            campaignPeriodBands={campaignPeriodBands}
          />
        ))}
      </div>
    </div>
  );
}

export function LooseEntriesLane({
  entries,
  pctForDate,
  minDate,
  maxDate,
  showsToday,
  today,
}: {
  entries: CalendarEntry[];
  pctForDate: (d: Date) => number;
  minDate: Date;
  maxDate: Date;
  showsToday: boolean;
  today: Date;
}) {
  const totalDays =
    Math.round((maxDate.getTime() - minDate.getTime()) / DAY_MS) + 1;
  const sorted = [...entries].sort(
    (a, b) => a.startsAt.getTime() - b.startsAt.getTime(),
  );

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.14em] text-muted-foreground font-medium">
        <span className="pill-label pill-label-sm">Wpisy ogólnokampanijne</span>
        <span>{sorted.length} bez powiązania z produkcją</span>
      </div>
      <div className="relative h-12 rounded-lg border border-border bg-card overflow-hidden">
        <WeekendShading minDate={minDate} totalDays={totalDays} />
        {sorted.map((e, idx) => {
          const pct = pctForDate(e.startsAt);
          if (pct < 0 || pct > 100) return null;
          // Stagger pins vertically when they collide.
          const lane = idx % 3;
          const top = 4 + lane * 12;
          return (
            <div
              key={e.id}
              className="absolute -translate-x-1/2 group"
              style={{ left: `${pct}%`, top: `${top}px` }}
            >
              <div
                className={`w-3 h-3 rounded-sm border ${TYPE_COLOR[e.type]} cursor-help`}
                title={`${TYPE_LABEL[e.type]}: ${e.title}, ${e.startsAt.toLocaleString('pl-PL', { dateStyle: 'short', timeStyle: 'short' })}${e.status === 'done' ? ' (zrobione)' : e.status === 'cancelled' ? ' (anulowane)' : ''}`}
              />
            </div>
          );
        })}
        {showsToday ? (
          <div
            className="absolute top-0 bottom-0 w-px bg-rose-500/60 pointer-events-none"
            style={{ left: `${pctForDate(today)}%` }}
          />
        ) : null}
      </div>
    </div>
  );
}
