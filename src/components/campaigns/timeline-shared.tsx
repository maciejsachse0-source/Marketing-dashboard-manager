/** Wspólne drobiazgi osi czasu kampanii: stała doby, typy wierszy, oś dat,
 *  cieniowanie weekendów i legenda okresów. Wydzielone z `timeline.tsx` przy
 *  rozbiciu pliku (F3-08), treść bez zmian. */
import type { Artist, Production } from '../../../drizzle/schema';
import type { TemplatePeriod } from '@/lib/production-periods';
import { fmtDayMonth, MONTH_PL, toneForIndex } from '@/lib/period-tones';
import { addDays } from '@/lib/dates';

export const DAY_MS = 24 * 60 * 60 * 1000;

export type ProductionWithArtist = Production & {
  artist: Pick<Artist, 'id' | 'name' | 'handle'> | null;
};

export type PeriodBand = {
  code: string;
  tone: ReturnType<typeof toneForIndex>;
  left: number;
  width: number;
};

export function DateAxis({
  minDate,
  totalDays,
  monthBoundaries,
  weekTicks,
  pctForDate,
}: {
  minDate: Date;
  totalDays: number;
  monthBoundaries: { offset: number; label: string }[];
  weekTicks: { offset: number; date: Date }[];
  pctForDate: (d: Date) => number;
}) {
  return (
    <div className="space-y-0.5 select-none">
      <div className="relative h-4">
        <span
          className="absolute text-[10px] uppercase tracking-[0.14em] font-semibold text-muted-foreground"
          style={{ left: '0%' }}
        >
          {MONTH_PL[minDate.getMonth()]} {minDate.getFullYear()}
        </span>
        {monthBoundaries.map((m) => {
          const date = addDays(minDate, m.offset);
          return (
            <span
              key={m.offset}
              className="absolute -translate-x-1/2 text-[10px] uppercase tracking-[0.14em] font-semibold text-muted-foreground"
              style={{ left: `${(m.offset / (totalDays - 1)) * 100}%` }}
            >
              {m.label} {date.getFullYear() !== minDate.getFullYear() ? date.getFullYear() : ''}
            </span>
          );
        })}
      </div>
      <div className="relative h-4">
        {weekTicks.map((t) => (
          <span
            key={t.offset}
            className="absolute -translate-x-1/2 text-[9px] tabular-nums text-muted-foreground"
            style={{ left: `${pctForDate(t.date)}%` }}
          >
            {fmtDayMonth(t.date)}
          </span>
        ))}
      </div>
    </div>
  );
}

export function WeekendShading({
  minDate,
  totalDays,
}: {
  minDate: Date;
  totalDays: number;
}) {
  // Render two strips per weekend (Sat + Sun) — kept as absolute divs so
  // the parent's relative positioning grid lines up cleanly.
  const stripes: { left: number; width: number }[] = [];
  for (let i = 0; i < totalDays; i++) {
    const d = addDays(minDate, i);
    const dow = (d.getDay() || 7) - 1; // 0..6, 0=Mon
    if (dow === 5 || dow === 6) {
      stripes.push({
        left: (i / totalDays) * 100,
        width: 100 / totalDays,
      });
    }
  }
  return (
    <>
      {stripes.map((s, i) => (
        <div
          key={i}
          className="absolute top-0 bottom-0 bg-muted-foreground/[0.06] pointer-events-none"
          style={{ left: `${s.left}%`, width: `${s.width}%` }}
        />
      ))}
    </>
  );
}

export function Legend({ periods }: { periods: TemplatePeriod[] }) {
  return (
    <div className="flex items-center gap-3 text-[10px] text-muted-foreground flex-wrap pt-1 border-t border-border">
      <span className="uppercase tracking-[0.12em] font-medium">Legenda:</span>
      <span className="flex items-center gap-1.5">
        <span className="w-2.5 h-2.5 rotate-45 bg-foreground border border-background" />
        nagranie (T-0)
      </span>
      <span className="flex items-center gap-1.5">
        <span className="w-2 h-2 bg-rose-500" />
        dziś
      </span>
      <span className="flex items-center gap-1.5">
        <span className="w-2 h-2 bg-foreground" />
        kickoff
      </span>
      {periods.slice(0, 6).map((p, i) => {
        const tone = toneForIndex(i);
        return (
          <span key={p.code} className="flex items-center gap-1">
            <span className={`w-2 h-2 rounded-sm ${tone.bar}`} />
            <span className={`${tone.ink} font-medium`}>
              {p.code}
              {p.name ? <span className="opacity-70 font-normal">, {p.name}</span> : null}
            </span>
          </span>
        );
      })}
      <span className="ml-auto opacity-60">
        Klik w produkcję → szczegóły pipeline&apos;u
      </span>
    </div>
  );
}
