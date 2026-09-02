import Link from 'next/link';
import type { CalendarEntry, ProductionPeriods } from '../../../drizzle/schema';
import {
  resolvePeriods,
  type TemplatePeriod,
} from '@/lib/production-periods';
import { fmtDayMonth, MONTH_PL, toneForIndex } from '@/lib/period-tones';
import { startOfWeek, addDays } from '@/lib/dates';

import {
  DAY_MS,
  DateAxis,
  Legend,
  type ProductionWithArtist,
} from './timeline-shared';
import { PeriodsStrip } from './timeline-periods-strip';
import { LooseEntriesLane, ProductionsLane } from './timeline-lanes';
/**
 * Campaign timeline — wspólny plan dla wszystkich działań artystów w ramach
 * tej kampanii. Kotwiczony na kickoffie kampanii. Trzy warstwy:
 *
 * 1. Pas narracji (T1..Tn) — kolorowe bandy z `campaign.periods`, każdy z
 *    licznikiem zrobionych/wszystkich milestone'ów i podglądem etykiet.
 * 2. Wiersze produkcji — gantt bary z fazami T1/T2/T3 produkcji wokół dnia
 *    nagrania (T-0). Każda produkcja to jedna linia, posortowane po dacie.
 * 3. Pas luźnych wpisów kalendarza — pinezki dla wpisów bez przypisanej
 *    produkcji (publikacje, deadliny, spotkania ogólnokampanijne).
 *
 * Zakres osi auto-fituje się do danych: od najwcześniejszego elementu
 * kampanii (snap-do-poniedziałku) po najpóźniejszy (snap-do-niedzieli),
 * z paddingiem ±7d wokół „dziś" gdy wpada poza dane.
 */


export function CampaignTimeline({
  kickoffAt,
  periods,
  productions,
  entries,
}: {
  kickoffAt: Date;
  periods: ProductionPeriods | null | undefined;
  productions: ProductionWithArtist[];
  entries: CalendarEntry[];
}) {
  const resolvedPeriods = resolvePeriods(periods as TemplatePeriod[] | null | undefined);

  // ── geometry ────────────────────────────────────────────────────────────
  const today = new Date();
  today.setHours(12, 0, 0, 0);

  const lastPeriodEnd = Math.max(0, ...resolvedPeriods.map((p) => p.endOffsetDays));

  const candidates: Date[] = [
    kickoffAt,
    addDays(kickoffAt, lastPeriodEnd),
    addDays(today, -7),
    addDays(today, 7),
  ];
  for (const p of productions) {
    const prodPeriods = resolvePeriods(
      p.periods as TemplatePeriod[] | null | undefined,
    );
    const t0Mon = startOfWeek(p.t0At);
    const minOffset = Math.min(...prodPeriods.map((q) => q.startOffsetDays));
    const maxOffset = Math.max(...prodPeriods.map((q) => q.endOffsetDays));
    candidates.push(addDays(t0Mon, minOffset));
    candidates.push(addDays(t0Mon, maxOffset));
    candidates.push(p.t0At);
  }
  for (const e of entries) {
    candidates.push(e.startsAt);
    candidates.push(e.endsAt);
  }

  const minMs = Math.min(...candidates.map((d) => d.getTime()));
  const maxMs = Math.max(...candidates.map((d) => d.getTime()));
  // Snap range to whole weeks so the day grid lines up with weekend shading.
  const minDate = startOfWeek(new Date(minMs));
  const rawMax = new Date(maxMs);
  rawMax.setHours(23, 59, 59, 999);
  // End on the Sunday of the last touched week.
  const endMon = startOfWeek(rawMax);
  const maxDate = addDays(endMon, 6);
  maxDate.setHours(23, 59, 59, 999);

  const totalDays =
    Math.round((maxDate.getTime() - minDate.getTime()) / DAY_MS) + 1;

  const pctForDate = (d: Date) => {
    const days = (d.getTime() - minDate.getTime()) / DAY_MS;
    return (days / (totalDays - 1)) * 100;
  };
  const pctForOffset = (anchor: Date, offsetDays: number) =>
    pctForDate(addDays(anchor, offsetDays));

  // ── campaign-period geometry — re-used as a faint backdrop under every
  // production row so the user reads "Anna's recording sits in T2 of the
  // campaign narrative" at a glance. Computed once here, passed down. ────
  const campaignPeriodBands = resolvedPeriods.map((p, idx) => {
    const left = pctForOffset(kickoffAt, p.startOffsetDays);
    const right = pctForOffset(kickoffAt, p.endOffsetDays + 1);
    return {
      code: p.code,
      tone: toneForIndex(idx),
      left,
      width: Math.max(0, right - left),
    };
  });

  // ── month boundaries for axis ──────────────────────────────────────────
  const monthBoundaries: { offset: number; label: string }[] = [];
  let prevMonth = -1;
  for (let i = 0; i < totalDays; i++) {
    const d = addDays(minDate, i);
    if (i === 0) {
      prevMonth = d.getMonth();
      continue;
    }
    if (d.getMonth() !== prevMonth) {
      monthBoundaries.push({ offset: i, label: MONTH_PL[d.getMonth()] });
      prevMonth = d.getMonth();
    }
  }

  // ── weekly Monday ticks ────────────────────────────────────────────────
  const weekTicks: { offset: number; date: Date }[] = [];
  for (let i = 0; i < totalDays; i++) {
    const d = addDays(minDate, i);
    if ((d.getDay() || 7) === 1) {
      weekTicks.push({ offset: i, date: d });
    }
  }

  const looseEntries = entries.filter((e) => e.productionId == null);

  const showsToday =
    today.getTime() >= minDate.getTime() && today.getTime() <= maxDate.getTime();

  return (
    <section className="card-editorial p-5 space-y-4">
      <header className="flex items-baseline justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-muted-foreground">
            Wspólny plan kampanii
          </h2>
          <p className="text-xs text-muted-foreground mt-1 max-w-2xl">
            Tu zobaczysz jak narracja kampanii (góra) zazębia się z
            harmonogramem nagrywek i publikacji artystów (środek). Każdy pas
            to jedna produkcja - wiesz na rzut oka kiedy kto nagrywa i kiedy
            wychodzi materiał.
          </p>
        </div>
        <div className="flex items-baseline gap-3 text-[10px] uppercase tracking-[0.12em] text-muted-foreground tabular-nums shrink-0">
          <span>{fmtDayMonth(minDate)} {minDate.getFullYear()}</span>
          <span>→</span>
          <span>{fmtDayMonth(maxDate)} {maxDate.getFullYear()}</span>
          <span className="opacity-70">, {totalDays} dni</span>
        </div>
      </header>

      <div className="space-y-1">
        {/* month labels row */}
        <DateAxis
          minDate={minDate}
          totalDays={totalDays}
          monthBoundaries={monthBoundaries}
          weekTicks={weekTicks}
          pctForDate={pctForDate}
        />
      </div>

      {/* periods strip */}
      <PeriodsStrip
        kickoffAt={kickoffAt}
        periods={resolvedPeriods}
        pctForOffset={pctForOffset}
        totalDays={totalDays}
        minDate={minDate}
        showsToday={showsToday}
        today={today}
        pctForDate={pctForDate}
      />

      {/* production rows */}
      {productions.length > 0 ? (
        <ProductionsLane
          productions={productions}
          pctForOffset={pctForOffset}
          pctForDate={pctForDate}
          minDate={minDate}
          maxDate={maxDate}
          showsToday={showsToday}
          today={today}
          campaignPeriodBands={campaignPeriodBands}
        />
      ) : (
        <div className="rounded-lg border border-dashed border-border bg-card/30 px-4 py-6 text-center text-xs text-muted-foreground">
          Brak produkcji powiązanych z tą kampanią. Utwórz produkcję na{' '}
          <Link href="/productions" className="underline hover:text-foreground">
            /productions
          </Link>{' '}
          i przypnij ją do tej kampanii - pojawi się tu jako wiersz nagrań,
          obróbki i publikacji.
        </div>
      )}

      {/* loose calendar entries */}
      {looseEntries.length > 0 ? (
        <LooseEntriesLane
          entries={looseEntries}
          pctForDate={pctForDate}
          minDate={minDate}
          maxDate={maxDate}
          showsToday={showsToday}
          today={today}
        />
      ) : null}

      {/* legend */}
      <Legend periods={resolvedPeriods} />
    </section>
  );
}

// Re-export legacy named export name in case external code imports it. The
// shape is now richer — callers must pass productions + entries as well.
export { CampaignTimeline as CampaignTimelineV2 };
