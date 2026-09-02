'use client';

import { DAY_MS, startOfDay } from './gantt-geometry';

/**
 * Nagłówek osi czasu ganta: pasmo miesięcy (przy widoku kwartalnym), pasmo
 * tygodni i pasmo dni. Wydzielony z `gantt-view.tsx` w F2-02 — przeniesienie
 * kodu bez zmiany zachowania.
 */
export function GanttAxisHeader({
  weeks,
  firstDay,
  totalWeeks,
  totalDays,
  days,
  todayIdx,
  headerDensity,
}: {
  weeks: Date[];
  firstDay: Date;
  totalWeeks: number;
  totalDays: number;
  days: { weekday: string; dom: string; isMonday: boolean; isWeekend: boolean }[];
  todayIdx: number;
  headerDensity: 'days' | 'weeks' | 'months';
}) {
  // ISO week number — far more useful for syncing across people than "1, 2, 3"
  const isoWeek = (d: Date): number => {
    const t = new Date(d);
    t.setHours(0, 0, 0, 0);
    t.setDate(t.getDate() + 3 - ((t.getDay() + 6) % 7));
    const yearStart = new Date(t.getFullYear(), 0, 4);
    return 1 + Math.round(((t.getTime() - yearStart.getTime()) / 86400000 - 3 + ((yearStart.getDay() + 6) % 7)) / 7);
  };
  const todayISO = isoWeek(new Date());

  // Month bands — used in 'months' header density to give the year-scale
  // overview a Google-Calendar-style month strip above the week markers.
  // We compute spans in DAY units (the base grid is day-percent-wide), so a
  // month that begins 3 days into the visible window gets a 3-day-wide
  // sliver of December plus a multi-week January band.
  type MonthSpan = { startDay: number; lengthDays: number; label: string; key: string };
  const monthSpans: MonthSpan[] = (() => {
    if (headerDensity !== 'months') return [];
    const out: MonthSpan[] = [];
    let cursor = new Date(firstDay);
    let dayIdx = 0;
    while (dayIdx < totalDays) {
      const monthEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
      const daysToMonthEnd = Math.round(
        (monthEnd.getTime() - startOfDay(cursor).getTime()) / DAY_MS,
      );
      const remaining = totalDays - dayIdx;
      const span = Math.min(daysToMonthEnd, remaining);
      const label = cursor.toLocaleDateString('pl-PL', {
        month: 'short',
        year: cursor.getMonth() === 0 || dayIdx === 0 ? '2-digit' : undefined,
      });
      out.push({
        startDay: dayIdx,
        lengthDays: span,
        label,
        key: `${cursor.getFullYear()}-${cursor.getMonth()}`,
      });
      dayIdx += span;
      cursor = monthEnd;
    }
    return out;
  })();
  const showDayStrip = headerDensity === 'days';
  const showMonthBand = headerDensity === 'months';

  return (
        <div
          className="grid gap-0 sticky top-0 z-30 bg-background/95 backdrop-blur"
          style={{ gridTemplateColumns: `22rem 1fr` }}
        >
          <div className="border-b border-r border-border/60 px-5 py-3 text-xs uppercase tracking-[0.14em] text-muted-foreground font-semibold sticky left-0 z-40 bg-background/95 backdrop-blur shadow-[2px_0_6px_-2px_rgb(0_0_0_/_0.08)]">
            Produkcja · pipeline
          </div>
          <div>
            {showMonthBand ? (
              <div
                className="grid border-b border-border/40"
                style={{ gridTemplateColumns: `repeat(${totalDays}, 1fr)` }}
              >
                {monthSpans.map((m) => (
                  <div
                    key={m.key}
                    className="px-3 py-2 border-l border-border/60 first:border-l-0 last:border-r-0 text-[11px] uppercase tracking-[0.14em] font-bold text-muted-foreground/80 truncate"
                    style={{ gridColumn: `${m.startDay + 1} / span ${m.lengthDays}` }}
                  >
                    {m.label}
                  </div>
                ))}
              </div>
            ) : null}
            <div
              className="grid border-b border-border/40"
              style={{ gridTemplateColumns: `repeat(${totalWeeks}, 1fr)` }}
            >
              {weeks.map((w, i) => {
                const wEnd = new Date(w);
                wEnd.setDate(wEnd.getDate() + 6);
                const isCurrent = isoWeek(w) === todayISO;
                // At year scale we drop the date range under the week number
                // and shrink padding so 52 columns don't crush the labels.
                const compact = headerDensity === 'months';
                return (
                  <div
                    key={i}
                    className={`${compact ? 'px-1.5 py-1.5' : 'px-3 py-2'} border-l border-border/60 ${
                      i === totalWeeks - 1 ? 'border-r' : ''
                    } ${isCurrent ? 'bg-foreground/5' : ''}`}
                  >
                    <div
                      className={`text-[10px] uppercase tracking-[0.14em] font-bold ${
                        isCurrent ? 'text-foreground' : 'text-muted-foreground/70'
                      } truncate`}
                    >
                      {compact ? `T${isoWeek(w)}` : `Tydz. ${isoWeek(w)}`}
                      {isCurrent && !compact ? ' · teraz' : ''}
                    </div>
                    {compact ? null : (
                      <div
                        className={`text-sm tabular-nums ${
                          isCurrent ? 'font-bold text-foreground' : 'text-muted-foreground'
                        }`}
                      >
                        {w.toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit' })}
                        {' – '}
                        {wEnd.toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit' })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {showDayStrip ? (
              <div className="grid" style={{ gridTemplateColumns: `repeat(${totalDays}, 1fr)` }}>
                {days.map((d, i) => {
                  const isToday = i === todayIdx;
                  return (
                    <div
                      key={i}
                      className={`px-1 py-1 border-l text-center ${
                        d.isMonday ? 'border-border/60' : 'border-border/20'
                      } ${i === totalDays - 1 ? 'border-r border-border/60' : ''} ${
                        d.isWeekend ? 'bg-muted/40' : ''
                      } ${isToday ? 'bg-foreground/5' : ''}`}
                    >
                      <div
                        className={`text-[11px] uppercase tracking-wider font-medium ${
                          isToday ? 'text-foreground font-bold' : 'text-muted-foreground/70'
                        }`}
                      >
                        {d.weekday.slice(0, 2)}
                      </div>
                      <div
                        className={`text-sm tabular-nums ${
                          isToday ? 'text-foreground font-bold' : 'text-muted-foreground'
                        }`}
                      >
                        {d.dom}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : null}
          </div>
        </div>
  );
}
