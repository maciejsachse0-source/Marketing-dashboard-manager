'use client';

import Link from 'next/link';
import type {
  Artist,
  CalendarEntry,
  Production,
  ProductionPeriods,
} from '../../../drizzle/schema';
import {
  resolvePeriods,
  type TemplatePeriod,
} from '@/lib/production-periods';
import { fmtDayMonth, MONTH_PL, toneForIndex } from '@/lib/period-tones';
import { startOfWeek, addDays } from '@/lib/dates';
import { TYPE_COLOR, TYPE_LABEL } from '../calendar/type-color';

const DAY_MS = 24 * 60 * 60 * 1000;

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

type ProductionWithArtist = Production & {
  artist: Pick<Artist, 'id' | 'name' | 'handle'> | null;
};

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
            to jedna produkcja — wiesz na rzut oka kiedy kto nagrywa i kiedy
            wychodzi materiał.
          </p>
        </div>
        <div className="flex items-baseline gap-3 text-[10px] uppercase tracking-[0.12em] text-muted-foreground tabular-nums shrink-0">
          <span>{fmtDayMonth(minDate)} {minDate.getFullYear()}</span>
          <span>→</span>
          <span>{fmtDayMonth(maxDate)} {maxDate.getFullYear()}</span>
          <span className="opacity-70">· {totalDays} dni</span>
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
          i przypnij ją do tej kampanii — pojawi się tu jako wiersz nagrań,
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

function DateAxis({
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

function PeriodsStrip({
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
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.14em] text-muted-foreground font-medium">
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
        aria-label="Pas narracji kampanii — okresy T1..Tn"
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
                title={`${p.code} · ${phaseTitle}: ${fmtDayMonth(startDate)} → ${fmtDayMonth(endDate)} · ${lengthDays} dni${p.description ? `\n\n${p.description}` : ''}`}
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
                  {fmtDayMonth(startDate)} → {fmtDayMonth(endDate)}
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


type PeriodBand = {
  code: string;
  tone: ReturnType<typeof toneForIndex>;
  left: number;
  width: number;
};

function ProductionsLane({
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

function ProductionRow({
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
  const stepsTotal = production.steps?.length ?? 0;
  const stepsDone = production.steps?.filter((s) => s.doneAt).length ?? 0;
  const progress =
    stepsTotal > 0 ? Math.round((stepsDone / stepsTotal) * 100) : 0;

  const displayName = production.artist?.name ?? production.title;
  const subLabel = production.artist
    ? production.title
    : production.type === 'solo'
      ? 'solo'
      : '';

  return (
    <Link
      href={`/productions/${production.id}`}
      className={`group grid grid-cols-[12rem_1fr] items-stretch hover:bg-muted/40 ui-transition ${isLast ? '' : 'border-b border-border'} ${cancelled ? 'opacity-50' : ''}`}
    >
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
      </div>

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

function LooseEntriesLane({
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
                title={`${TYPE_LABEL[e.type]}: ${e.title} · ${e.startsAt.toLocaleString('pl-PL', { dateStyle: 'short', timeStyle: 'short' })}${e.status === 'done' ? ' ✓' : e.status === 'cancelled' ? ' ✗' : ''}`}
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

function WeekendShading({
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

function Legend({ periods }: { periods: TemplatePeriod[] }) {
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
              {p.name ? <span className="opacity-70 font-normal"> · {p.name}</span> : null}
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

// Re-export legacy named export name in case external code imports it. The
// shape is now richer — callers must pass productions + entries as well.
export { CampaignTimeline as CampaignTimelineV2 };
