'use client';

/** Wspólna oś czasu suwaka okresów: pasmo miesięcy, etykiety tygodniowe co 7 dni,
 *  komórki dni i numery dni miesiąca. Rysowana raz, stoi za wszystkimi szynami
 *  okresów, zakotwiczona na `previewStart`, więc użytkownik czyta konkretne daty,
 *  a nie surowe przesunięcia.
 *  Wydzielona z `template-form.tsx` przy rozbiciu pliku (F3-07), treść bez zmian. */
import { MONTH_PL, dateAt, fmtDayMonth } from './template-form-utils';

export function PeriodAxis({
  sliderMin,
  sliderMax,
  sliderDays,
  previewStart,
  dayToPercent,
}: {
  sliderMin: number;
  sliderMax: number;
  sliderDays: number;
  /** Kotwica osi: zamienia przesunięcia w dniach na konkretne daty. */
  previewStart: Date;
  dayToPercent: (d: number) => number;
}) {
  // Major ticks every 7 days — labels become real dates anchored on
  // `previewStart` ("5 maj", "12 maj", "19 maj"…). Day 0 also gets a "Start"
  // ribbon below to underline that it's the production's anchor.
  const majorTicks: { offset: number; date: Date; label: string }[] = [];
  for (let d = sliderMin; d <= sliderMax; d++) {
    if (d % 7 !== 0) continue;
    const date = dateAt(previewStart, d);
    majorTicks.push({ offset: d, date, label: fmtDayMonth(date) });
  }

  // Month boundary markers — vertical hairline + month label whenever the
  // visible window crosses into a new month. Helps with longer pipelines that
  // span multiple months. Skip the first day (would visually duplicate the
  // axis edge).
  const monthBoundaries: { offset: number; label: string }[] = [];
  let prevMonth = -1;
  for (let d = sliderMin; d <= sliderMax; d++) {
    const date = dateAt(previewStart, d);
    const m = date.getMonth();
    if (d === sliderMin) {
      prevMonth = m;
      continue;
    }
    if (m !== prevMonth) {
      monthBoundaries.push({ offset: d, label: MONTH_PL[m] });
      prevMonth = m;
    }
  }
  return (
    <div className="space-y-1">
      {/* Month band — labels each month present in the visible window,
          with a hairline at every month boundary so they read as ranges. */}
      <div className="relative h-4 select-none">
        {/* First-month label sits at the left edge */}
        <span
          className="absolute text-[10px] uppercase tracking-[0.14em] font-semibold text-muted-foreground"
          style={{ left: `0%` }}
        >
          {MONTH_PL[previewStart.getMonth()]} {previewStart.getFullYear()}
        </span>
        {monthBoundaries.map((m) => (
          <span
            key={m.offset}
            className="absolute -translate-x-1/2 text-[10px] uppercase tracking-[0.14em] font-semibold text-muted-foreground"
            style={{ left: `${dayToPercent(m.offset)}%` }}
          >
            {m.label}
          </span>
        ))}
      </div>
      {/* Week-tick date labels (every 7 days) */}
      <div className="relative h-5 select-none">
        {majorTicks.map((t) => (
          <span
            key={t.offset}
            className={`absolute -translate-x-1/2 text-[10px] tracking-tight tabular-nums ${
              t.offset === 0
                ? 'font-bold text-foreground'
                : 'text-muted-foreground'
            }`}
            style={{ left: `${dayToPercent(t.offset)}%` }}
          >
            {t.label}
          </span>
        ))}
      </div>
      <div className="relative h-3 rounded bg-muted/40 select-none">
        {/* Day cells — every day a thin vertical hair, weekend days slightly
            darker so the user can see Sat/Sun without labels. */}
        {Array.from({ length: sliderDays }).map((_, i) => {
          const d = sliderMin + i;
          const dow = ((d % 7) + 7) % 7;
          const isWeekend = dow >= 5;
          return (
            <div
              key={i}
              className={`absolute top-0 bottom-0 ${isWeekend ? 'bg-muted-foreground/15' : ''}`}
              style={{
                left: `${dayToPercent(d) - 0.5 / sliderDays * 100}%`,
                width: `${100 / sliderDays}%`,
              }}
            />
          );
        })}
        {/* Month boundary hairlines on the cells row — strongest visual cue */}
        {monthBoundaries.map((m) => (
          <div
            key={m.offset}
            className="absolute top-0 bottom-0 w-px bg-foreground/30 pointer-events-none"
            style={{ left: `${dayToPercent(m.offset)}%` }}
          />
        ))}
      </div>
      {/* Per-day day-of-month numbers — replaces the dow initials so the
          user can pick out concrete days at a glance. Day 1 of each month
          is emphasised. */}
      <div className="relative h-3 select-none">
        {Array.from({ length: sliderDays }).map((_, i) => {
          const d = sliderMin + i;
          const date = dateAt(previewStart, d);
          const dow = ((d % 7) + 7) % 7;
          const isWeekend = dow >= 5;
          const isFirstOfMonth = date.getDate() === 1;
          return (
            <span
              key={i}
              className={`absolute -translate-x-1/2 text-[8px] tabular-nums ${
                isFirstOfMonth
                  ? 'font-bold text-foreground'
                  : isWeekend
                    ? 'text-muted-foreground/55'
                    : 'text-muted-foreground/80'
              }`}
              style={{ left: `${dayToPercent(d)}%` }}
            >
              {date.getDate()}
            </span>
          );
        })}
      </div>
      <div className="flex justify-between text-[9px] text-muted-foreground tabular-nums px-0.5">
        <span>{fmtDayMonth(dateAt(previewStart, sliderMin))} (start)</span>
        <span>{fmtDayMonth(dateAt(previewStart, sliderMax))}</span>
      </div>
    </div>
  );
}
