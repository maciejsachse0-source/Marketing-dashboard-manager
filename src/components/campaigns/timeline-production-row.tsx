/** Pojedynczy wiersz produkcji na osi czasu kampanii: pasy T1/T2/T3 wokół dnia
 *  nagrania. Wydzielony z `timeline.tsx` przy rozbiciu pliku (F3-08), treść bez zmian. */
import Link from 'next/link';
import { resolvePeriods, type TemplatePeriod } from '@/lib/production-periods';
import { fmtDayMonth, toneForIndex } from '@/lib/period-tones';
import { startOfWeek, addDays } from '@/lib/dates';
import { WeekendShading, type PeriodBand, type ProductionWithArtist } from './timeline-shared';

export function ProductionRow({
  production,
  pctForOffset,
  pctForDate,
  minDate,
  totalDays,
  isLast,
  showsToday,
  today,
  campaignPeriodBands,
}: {
  production: ProductionWithArtist;
  pctForOffset: (anchor: Date, offsetDays: number) => number;
  pctForDate: (d: Date) => number;
  minDate: Date;
  totalDays: number;
  isLast: boolean;
  showsToday: boolean;
  today: Date;
  campaignPeriodBands: PeriodBand[];
}) {
  const prodPeriods = resolvePeriods(
    production.periods as TemplatePeriod[] | null | undefined,
  );
  const t0Mon = startOfWeek(production.t0At);
  const cancelled = !!production.cancelledAt;
  const displayName = production.artist?.name ?? production.title;

  return (
    <Link
      href={`/productions/${production.id}`}
      className={`group grid grid-cols-[12rem_1fr] items-stretch hover:bg-muted/40 ui-transition ${isLast ? '' : 'border-b border-border'} ${cancelled ? 'opacity-50' : ''}`}
    >
      <ProductionRowLabel production={production} cancelled={cancelled} />

      <div className="relative h-14">
        {/* faint backdrop: where the campaign's narrative periods sit on this
            row, so the user reads "Anna's recording is in T2 of the campaign
            narrative" at a glance. Drawn first so production bars overlay.
            ~70% so the bands are unambiguously visible without overpowering
            the saturated production segments above them. */}
        {campaignPeriodBands.map((b) => (
          <div
            key={`bg-${b.code}`}
            className={`absolute top-0 bottom-0 ${b.tone.bg} opacity-70 pointer-events-none border-r border-border/40`}
            style={{ left: `${b.left}%`, width: `${b.width}%` }}
            title={`Okres ${b.code} narracji kampanii`}
          />
        ))}
        <WeekendShading minDate={minDate} totalDays={totalDays} />

        {/* phase segments — T1/T2/T3 of THIS production around its t0Mon */}
        {prodPeriods.map((p, idx) => {
          const tone = toneForIndex(idx);
          const left = pctForOffset(t0Mon, p.startOffsetDays);
          const right = pctForOffset(t0Mon, p.endOffsetDays + 1);
          const width = Math.max(0, right - left);
          const length = p.endOffsetDays - p.startOffsetDays + 1;
          const startDate = addDays(t0Mon, p.startOffsetDays);
          const endDate = addDays(t0Mon, p.endOffsetDays);
          return (
            <div
              key={p.code}
              className={`absolute top-3 h-8 ${tone.bar} border ${tone.thumb.replace('bg-', 'border-').split(' ')[0]} rounded`}
              style={{ left: `${left}%`, width: `${width}%` }}
              title={`${p.code} produkcji ${displayName}: ${fmtDayMonth(startDate)} → ${fmtDayMonth(endDate)} (${length}d)`}
            >
              <span
                className={`absolute top-0.5 left-1 text-[9px] font-bold tracking-[0.14em] ${tone.ink} pointer-events-none`}
              >
                {p.code}
              </span>
            </div>
          );
        })}

        {/* T-0 marker — actual recording day */}
        <div
          className="absolute top-2 bottom-2 -translate-x-1/2 flex flex-col items-center pointer-events-none"
          style={{ left: `${pctForDate(production.t0At)}%` }}
          title={`Nagranie: ${production.t0At.toLocaleString('pl-PL', { dateStyle: 'medium', timeStyle: 'short' })}`}
        >
          <div className="w-2.5 h-2.5 rotate-45 bg-foreground border border-background shadow" />
          <div className="w-px flex-1 bg-foreground/60" />
        </div>

        {/* today marker */}
        {showsToday ? (
          <div
            className="absolute top-0 bottom-0 w-px bg-rose-500/60 pointer-events-none"
            style={{ left: `${pctForDate(today)}%` }}
          />
        ) : null}
      </div>
    </Link>
  );
}

/** Lewa komórka wiersza: nazwa artysty (albo tytuł), podpis i pasek postępu kroków.
 *  Wydzielona z `ProductionRow`, żeby obie funkcje zmieściły się w progu złożoności 10
 *  z zasady Z11; treść komórki bez zmian. */
function ProductionRowLabel({
  production,
  cancelled,
}: {
  production: ProductionWithArtist;
  cancelled: boolean;
}) {
  const displayName = production.artist?.name ?? production.title;
  const subLabel = production.artist
    ? production.title
    : production.type === 'solo'
      ? 'solo'
      : '';
  return (
    <div className="px-3 py-2.5 border-r border-border flex flex-col gap-0.5 min-w-0">
      <div className="flex items-center gap-1.5">
        <span className="text-sm font-semibold tracking-tight truncate">
          {displayName}
        </span>
        {cancelled ? (
          <span className="text-[9px] uppercase tracking-[0.12em] text-rose-700 shrink-0">
            anul.
          </span>
        ) : null}
      </div>
      {subLabel ? (
        <span className="text-[10px] text-muted-foreground truncate">
          {subLabel}
        </span>
      ) : null}
      <StepsProgress production={production} cancelled={cancelled} />
    </div>
  );
}

/** Pasek postępu kroków produkcji wraz z licznikiem „zrobione/wszystkie".
 *  Wydzielony z `ProductionRowLabel` z tego samego powodu co ona: próg złożoności
 *  10 z zasady Z11. Treść bez zmian. */
function StepsProgress({
  production,
  cancelled,
}: {
  production: ProductionWithArtist;
  cancelled: boolean;
}) {
  const stepsTotal = production.steps?.length ?? 0;
  const stepsDone = production.steps?.filter((s) => s.doneAt).length ?? 0;
  const progress = stepsTotal > 0 ? Math.round((stepsDone / stepsTotal) * 100) : 0;
  return (
    <div className="flex items-center gap-1.5 mt-0.5">
      <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full ${cancelled ? 'bg-muted-foreground/40' : 'bg-foreground/70'}`}
          style={{ width: `${progress}%` }}
        />
      </div>
      <span className="text-[9px] tabular-nums text-muted-foreground shrink-0">
        {stepsDone}/{stepsTotal}
      </span>
    </div>
  );
}
