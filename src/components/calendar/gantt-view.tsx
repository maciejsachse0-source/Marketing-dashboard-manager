'use client';

import Link from 'next/link';
import { useOptimistic, useState, useTransition } from 'react';
import { ArrowRight, Check, CheckCircle2, ChevronDown, ExternalLink, FolderOpen } from 'lucide-react';
import { PersonAvatar, SoloAvatar, OrphanArtistAvatar } from '@/components/productions/artist-avatar';
import {
  ProductionTypeBadge,
  STATUS_LABEL as PROD_STATUS_LABEL,
} from '@/components/productions/status-pill';
import { DeleteProductionButton } from '@/components/productions/delete-production-button';
import { cascadeStepsTo } from '@/server/actions/production-steps';
import { openProductionFolder } from '@/server/actions/production-folder';
import { startOfWeek as startOfWeekFn } from '@/lib/dates';
import { STAGE_LABEL, STAGE_HINT } from '@/lib/production-stages';
import { resolveCategorySequence } from '@/lib/category-sequence';
import { FRAME_STYLE, type WeekFrame } from '@/lib/category-colors';
import {
  PRODUCTION_PROGRESSION,
  type CustomStep,
  type Platform,
  type ProductionPeriods,
  type ProductionStage,
  type ProductionStatus,
  type ProductionStep,
  type ProductionType,
} from '../../../drizzle/schema';
import { periodsRelativeToT0Mon } from '@/lib/production-periods';
import { ProductionStepRow } from '@/components/productions/production-step-row';
import { AddStepInline } from '@/components/productions/add-step-inline';

type DateMode = 'record' | 'calendar' | 'derived' | 'none';

const DAY_MS = 24 * 60 * 60 * 1000;

type WeekFrameCode = 'T1' | 'T2' | 'T3';

/**
 * 5 main pipeline checkpoints — anchored on the LAST sub-stage of each category.
 * Date for each checkpoint comes EXCLUSIVELY from the production:
 *   - stepDates[endStage] when the user has recorded a date on the production page
 *   - shooting + 1 day for `editing` (auto-derived, matches production page)
 *   - row.t0At for `publishing` (publication date == T-0)
 *   - otherwise: TENTATIVE — milestone rendered at default offset for visual
 *     orientation, but with dashed border and no date, signalling "ustaw na produkcji"
 */
type StageCategory = {
  key: ProductionStage;
  label: string;
  short: string;
  description: string;
  hint: string;
  endStage: ProductionStatus;
  subStages: ProductionStatus[];
  frame: WeekFrameCode;
  dateMode: DateMode;
  dateLabel: string;
  withTime: boolean;
};

const STAGE_CATEGORIES: StageCategory[] = [
  {
    key: 'outreach',
    label: 'Outreach',
    short: 'OUTR.',
    description: 'Kontakt z artystą, akceptacja warunków, ustalenie daty z kamerzystą.',
    hint: 'wzorce maila, screen rozmowy, umowa.pdf',
    endStage: 'cam-meeting-set',
    subStages: ['email-sent', 'terms-accepted', 'cam-meeting-set'],
    frame: 'T1',
    dateMode: 'record',
    dateLabel: 'kiedy się wydarzyło',
    withTime: false,
  },
  {
    key: 'ustalenia',
    label: 'Ustalenia + scenariusz',
    short: 'UST.',
    description: 'Przekazanie daty + omówienie i wysłanie scenariusza.',
    hint: 'scenariusz PDF, shotlist, packing list, callsheet',
    endStage: 'script-sent',
    subStages: ['cam-date-shared', 'script-discussed', 'script-sent'],
    frame: 'T1',
    dateMode: 'calendar',
    dateLabel: 'termin',
    withTime: true,
  },
  {
    key: 'nagrywanie',
    label: 'Nagrywanie',
    short: 'NAGR.',
    description: 'Nagrywki — w studio lub w terenie.',
    hint: 'surówki, BTS, audio raw',
    endStage: 'shooting',
    subStages: ['shooting'],
    frame: 'T2',
    dateMode: 'calendar',
    dateLabel: 'data nagrań',
    withTime: true,
  },
  {
    key: 'obrobka',
    label: 'Obróbka',
    short: 'MONT.',
    description: 'Montaż — następnego dnia po nagrywkach.',
    hint: 'wersje robocze, master video',
    endStage: 'editing',
    subStages: ['editing'],
    frame: 'T2',
    dateMode: 'derived',
    dateLabel: 'auto: dzień po nagrywkach',
    withTime: true,
  },
  {
    key: 'publikacja',
    label: 'Publikacja',
    short: 'PUB.',
    description: 'Upload na platformy.',
    hint: 'thumbs, exports per platforma',
    endStage: 'publishing',
    subStages: ['publishing'],
    frame: 'T3',
    dateMode: 'none',
    dateLabel: '',
    withTime: false,
  },
];

// Section frames for the row's expanded panel — derived from the shared
// FRAME_STYLE table so the gantt and the templates page stay color-synced.
const EXPANDED_FRAMES: { code: WeekFrame; label: string; border: string; bg: string; badge: string; accent: string }[] =
  (['T1', 'T2', 'T3'] as const).map((code) => {
    const f = FRAME_STYLE[code];
    return { code, label: f.label, border: f.border, bg: f.bg, badge: f.badge, accent: f.accent };
  });

function deriveEditingIso(shootIso: string): string {
  const d = new Date(shootIso);
  d.setDate(d.getDate() + 1);
  d.setHours(10, 0, 0, 0);
  return d.toISOString();
}

function subStageState(
  stage: ProductionStatus,
  current: ProductionStatus,
): 'passed' | 'active' | 'pending' {
  if (current === 'cancelled') return 'pending';
  const cur = STAGE_INDEX[current];
  const idx = STAGE_INDEX[stage];
  if (idx < cur) return 'passed';
  if (idx === cur) return 'active';
  return 'pending';
}

/**
 * TENTATIVE milestone positions — relative to MONDAY of T-0's week (t0Mon).
 * Layout requirement: T1/T2/T3 each = 1 week; OUTR.+UST. inside T1, NAGR.+MONT.
 * inside T2, PUB. inside T3. Defaults spread the two ticks across each band:
 *
 *   T1 (t0Mon-14 .. t0Mon-8)  →  OUTR. on Wed,  UST. on Sat
 *   T2 (t0Mon-7  .. t0Mon-1)  →  NAGR. on Wed, MONT. on Fri
 *   T3 (t0Mon    .. t0Mon+6)  →  PUB.  on T-0 (real day, always set)
 */
const TENTATIVE_OFFSET_FROM_T0_MON: Partial<Record<ProductionStatus, number>> = {
  // T1 — outreach (steps 1-3)
  'email-sent': -14, // Mon of T1
  'terms-accepted': -13, // Tue of T1
  'cam-meeting-set': -12, // Wed of T1 (Outreach milestone end)
  // T1 — ustalenia (steps 4-6)
  'cam-date-shared': -11, // Thu of T1
  'script-discussed': -10, // Fri of T1
  'script-sent': -9, // Sat of T1 (Ustalenia milestone end)
  // T2 — nagrywanie + obróbka (steps 7-8)
  shooting: -5, // Wed of T2
  editing: -3, // Fri of T2
  // T3 — publikacja (step 9)
  publishing: 0, // Mon of T3 (= T-0)
};

// Wyciszone tła pasów (100/55) zamiast 200/70 — pasy nadal czytelnie kodują
// fazę, ale nie konkurują z krokami nad nimi. Ramki cieńsze (border zamiast
// border-2) i mniej nasycone (400/50). Mocne kolory (500) zostają dla
// chip-pinów i passed-stanów — tam liczy się kontrast vs. tła.
const FRAME_TONE: Record<
  WeekFrameCode,
  { bg: string; border: string; ink: string; chip: string; passed: string; active: string; pending: string }
> = {
  T1: {
    bg: 'bg-amber-100/55',
    border: 'border-amber-400/55',
    ink: 'text-amber-900',
    chip: 'bg-amber-200/80 border-amber-400',
    passed: 'bg-amber-500 border-amber-600 text-white',
    active: 'bg-amber-50 border-amber-500 ring-4 ring-amber-300/50 text-amber-900',
    pending: 'bg-white border-amber-300 hover:border-amber-500 text-amber-700',
  },
  T2: {
    bg: 'bg-violet-100/55',
    border: 'border-violet-400/55',
    ink: 'text-violet-900',
    chip: 'bg-violet-200/80 border-violet-400',
    passed: 'bg-violet-500 border-violet-600 text-white',
    active: 'bg-violet-50 border-violet-500 ring-4 ring-violet-300/50 text-violet-900',
    pending: 'bg-white border-violet-300 hover:border-violet-500 text-violet-700',
  },
  T3: {
    bg: 'bg-emerald-100/55',
    border: 'border-emerald-400/55',
    ink: 'text-emerald-900',
    chip: 'bg-emerald-200/80 border-emerald-400',
    passed: 'bg-emerald-500 border-emerald-600 text-white',
    active: 'bg-emerald-50 border-emerald-500 ring-4 ring-emerald-300/50 text-emerald-900',
    pending: 'bg-white border-emerald-300 hover:border-emerald-500 text-emerald-700',
  },
};

const STAGE_INDEX: Record<ProductionStatus, number> = Object.fromEntries(
  PRODUCTION_PROGRESSION.map((s, i) => [s, i]),
) as Record<ProductionStatus, number>;

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function dayDiff(d: Date, origin: Date): number {
  return (startOfDay(d).getTime() - startOfDay(origin).getTime()) / DAY_MS;
}

export type GanttRow = {
  id: number;
  title: string;
  slug: string;
  type: ProductionType;
  status: ProductionStatus;
  t0At: Date;
  stepDates: Partial<Record<ProductionStatus, string>> | null;
  customSteps: Partial<Record<ProductionStage, CustomStep[]>> | null;
  stepOrder: Partial<Record<ProductionStage, string[]>> | null;
  /** New flexible-steps payload — used by the expanded view to render the
   *  full pipeline list. Synthesized legacy fields above stay for now to
   *  keep the strip's status/date math unchanged during the cleanup window. */
  steps: ProductionStep[];
  /** Persisted T-period overrides cloned from the template at production
   *  creation. Null for legacy rows; consumers fall back to defaults. */
  periods: ProductionPeriods | null;
  cancelled: boolean;
  artistName: string | null;
  artistHandle: string | null;
  videographerName: string | null;
  platforms: Platform[] | null;
};

function categoryState(
  cat: (typeof STAGE_CATEGORIES)[number],
  current: ProductionStatus,
): 'passed' | 'active' | 'pending' {
  if (current === 'cancelled') return 'pending';
  const cur = STAGE_INDEX[current];
  const endIdx = STAGE_INDEX[cat.endStage];
  const startIdx = STAGE_INDEX[cat.subStages[0]];
  if (cur >= endIdx) return 'passed';
  if (cur >= startIdx) return 'active';
  return 'pending';
}

/** Stable key for a sub-step regardless of where it's referenced from. The
 *  optimistic-done map (shared between the milestone bar and sub-step bar)
 *  is keyed off this so a click on either surface updates both views in the
 *  same paint. Must be type-only — defined here, not inside any component —
 *  so all readers compute the same key. */
function subStepKey(s: { kind: 'canonical' | 'custom'; stage: ProductionStatus | null; customId: string | null }): string {
  return s.kind === 'canonical' ? `cn:${s.stage}` : `cs:${s.customId}`;
}

type MilestoneSource = 'recorded' | 'derived' | 't0' | 'tentative';

/**
 * Resolve the canonical date for a category checkpoint. Returns:
 *   - recorded:  user set stepDates[endStage] explicitly
 *   - derived:   auto-derived (currently editing = shooting + 1 day)
 *   - t0:        publishing always = t0At
 *   - tentative: no real date — return default-offset position only for layout
 */
function resolveStageDate(
  stage: ProductionStatus,
  row: GanttRow,
): { date: Date; source: MilestoneSource } {
  const iso = row.stepDates?.[stage];
  if (iso) return { date: new Date(iso), source: 'recorded' };
  if (stage === 'editing' && row.stepDates?.shooting) {
    const d = new Date(row.stepDates.shooting);
    d.setDate(d.getDate() + 1);
    return { date: d, source: 'derived' };
  }
  if (stage === 'publishing') {
    return { date: row.t0At, source: 't0' };
  }
  // Tentative: default offset relative to T-0 Monday — keeps the dot inside
  // its T-band even before the user records a real date. When the production
  // has custom periods, clamp the offset to the matching period's bounds so
  // narrow bands (e.g. Mon-Fri) don't push the dot outside.
  const t0Mon = startOfWeekFn(row.t0At);
  let offset = TENTATIVE_OFFSET_FROM_T0_MON[stage] ?? 0;
  const code = STAGE_TO_PERIOD[stage];
  if (code) {
    // Periods are stored 0-anchored at pipeline start; shift them so the
    // publikacja period sits on t0Mon = 0, matching the gantt's frame model.
    const period = periodsRelativeToT0Mon(row.periods).find((p) => p.code === code);
    if (period) {
      offset = Math.max(period.startOffsetDays, Math.min(period.endOffsetDays, offset));
    }
  }
  const def = new Date(t0Mon);
  def.setDate(def.getDate() + offset);
  return { date: def, source: 'tentative' };
}

/** Map of legacy canonical stages → their T-period code, used by tentative
 *  placement to clamp default offsets to user-customised period bounds. */
const STAGE_TO_PERIOD: Partial<Record<ProductionStatus, WeekFrameCode>> = {
  'email-sent': 'T1',
  'terms-accepted': 'T1',
  'cam-meeting-set': 'T1',
  'cam-date-shared': 'T1',
  'script-discussed': 'T1',
  'script-sent': 'T1',
  shooting: 'T2',
  editing: 'T2',
  publishing: 'T3',
};

const resolveSubStageDate = resolveStageDate;

/**
 * T1/T2/T3 colored backdrop bands — each = exactly 1 full week (Mon-Sun),
 * anchored on the production's T-0 week:
 *
 *   T1 = the week containing OUTR. + UST.    (2 weeks before T-0)
 *   T2 = the week containing NAGR. + MONT.   (1 week  before T-0)
 *   T3 = the week containing PUB. (= T-0)
 *
 * Bands are clipped to the visible window.
 */
function computeFrameBands(
  t0: Date,
  firstDay: Date,
  totalDays: number,
  periods: ProductionPeriods | null,
): { code: WeekFrameCode; startDay: number; endDay: number }[] {
  const t0Mon = startOfWeekFn(t0); // Monday of T-0's week
  const t0MonDay = Math.round(dayDiff(t0Mon, firstDay));
  // Shift periods so the publikacja period sits on t0Mon — turns the
  // 0-anchored "from pipeline start" offsets into negative-from-T0 offsets
  // that the strip's T-frame model understands.
  const resolved = periodsRelativeToT0Mon(periods);
  const raw = resolved.map((p) => ({
    code: p.code as WeekFrameCode,
    startDay: t0MonDay + p.startOffsetDays,
    endDay: t0MonDay + p.endOffsetDays,
  }));
  return raw
    .map((b) => ({
      ...b,
      startDay: Math.max(0, b.startDay),
      endDay: Math.min(totalDays - 1, b.endDay),
    }))
    .filter((b) => b.startDay <= b.endDay);
}

export function GanttView({
  weeks,
  rows,
  minWidthPx = 1900,
}: {
  weeks: Date[];
  rows: GanttRow[];
  minWidthPx?: number;
}) {
  if (weeks.length === 0) return null;
  const firstDay = startOfDay(weeks[0]);
  const totalWeeks = weeks.length;
  const totalDays = totalWeeks * 7;
  const dayWidthPct = 100 / totalDays;
  const todayIdx = Math.round(dayDiff(new Date(), firstDay));
  const todayInWindow = todayIdx >= 0 && todayIdx < totalDays;

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

  // ISO week number — far more useful for syncing across people than "1, 2, 3"
  const isoWeek = (d: Date): number => {
    const t = new Date(d);
    t.setHours(0, 0, 0, 0);
    t.setDate(t.getDate() + 3 - ((t.getDay() + 6) % 7));
    const yearStart = new Date(t.getFullYear(), 0, 4);
    return 1 + Math.round(((t.getTime() - yearStart.getTime()) / 86400000 - 3 + ((yearStart.getDay() + 6) % 7)) / 7);
  };
  const todayISO = isoWeek(new Date());

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
            <LegendDot variant="dashed" label="domyślna pozycja — ustaw datę" />
          </span>
        </div>

        {/* Week + day header */}
        <div
          className="grid gap-0 sticky top-0 z-30 bg-background/95 backdrop-blur"
          style={{ gridTemplateColumns: `22rem 1fr` }}
        >
          <div className="border-b border-r border-border/60 px-5 py-3 text-xs uppercase tracking-[0.14em] text-muted-foreground font-semibold sticky left-0 z-40 bg-background/95 backdrop-blur shadow-[2px_0_6px_-2px_rgb(0_0_0_/_0.08)]">
            Produkcja · pipeline
          </div>
          <div>
            <div
              className="grid border-b border-border/40"
              style={{ gridTemplateColumns: `repeat(${totalWeeks}, 1fr)` }}
            >
              {weeks.map((w, i) => {
                const wEnd = new Date(w);
                wEnd.setDate(wEnd.getDate() + 6);
                const isCurrent = isoWeek(w) === todayISO;
                return (
                  <div
                    key={i}
                    className={`px-3 py-2 border-l border-border/60 ${
                      i === totalWeeks - 1 ? 'border-r' : ''
                    } ${isCurrent ? 'bg-foreground/5' : ''}`}
                  >
                    <div
                      className={`text-[10px] uppercase tracking-[0.14em] font-bold ${
                        isCurrent ? 'text-foreground' : 'text-muted-foreground/70'
                      }`}
                    >
                      Tydz. {isoWeek(w)}
                      {isCurrent ? ' · teraz' : ''}
                    </div>
                    <div
                      className={`text-sm tabular-nums ${
                        isCurrent ? 'font-bold text-foreground' : 'text-muted-foreground'
                      }`}
                    >
                      {w.toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit' })}
                      {' – '}
                      {wEnd.toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit' })}
                    </div>
                  </div>
                );
              })}
            </div>
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
          </div>
        </div>

        {rows.length === 0 ? (
          <div className="px-6 py-20 text-center">
            <div className="text-sm font-semibold text-foreground mb-1">
              Brak produkcji w tym oknie
            </div>
            <p className="text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
              Spróbuj rozszerzyć zoom, zmienić zakres tygodni, zresetować filtry albo
              utworzyć nową produkcję — milestone&apos;y pojawią się jako pinezki na osi.
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

function GanttRowView({
  row,
  firstDay,
  totalDays,
  dayWidthPct,
  days,
  todayIdx,
  todayInWindow,
  isFirstOfArtist,
  showArtistGap,
}: {
  row: GanttRow;
  firstDay: Date;
  totalDays: number;
  dayWidthPct: number;
  days: { isWeekend: boolean }[];
  todayIdx: number;
  todayInWindow: boolean;
  isFirstOfArtist: boolean;
  showArtistGap: boolean;
}) {
  const [optimisticStatus, setOptimisticStatus] = useOptimistic(row.status);
  const [, startTransition] = useTransition();
  const [expanded, setExpanded] = useState(false);
  // Shared optimistic done-state keyed by subStepKey. Both PipelineMilestones
  // (clicking the Outreach/Ustalenia/etc. tick) and SubStepBar (clicking a
  // numbered circle) update this same map so the two surfaces never disagree
  // during the optimistic window. Without this lift, clicking the milestone
  // tick would only update `optimisticStatus` while the per-step doneAts
  // (which now drive sub-step rendering after the cascade-doneAt rewrite)
  // stayed stale until the server revalidate landed.
  const [optimisticDoneByKey, setOptimisticDoneByKey] = useState<Record<string, boolean>>({});

  const setStatus = (next: ProductionStatus) => {
    // Optimistic-only update — the children (PipelineMilestones, SubStepBar)
    // call `cascadeStepsTo` themselves to persist; this just keeps the UI
    // mirror in sync until the cascade revalidates.
    startTransition(() => {
      setOptimisticStatus(next);
    });
  };

  // T1/T2/T3 full-week bands anchored on T-0 — sourced from the production's
  // own periods (cloned from its template) so two productions with different
  // templates can render different bands on the same gantt.
  const frameBands = computeFrameBands(row.t0At, firstDay, totalDays, row.periods);

  // Sub-step pins are computed FURTHER DOWN — after `allSubSteps` is built —
  // so each pin can carry the global step number `n` and the matching frame
  // resolved by the placement model. Keeping the band render code below the
  // pin computation keeps the JSX clean.

  // Effective sub-step list — joint canonical + custom sequence per category,
  // resolved via `resolveCategorySequence` so a category that has been touched
  // by `moveStepInCategory` reads from its persisted `stepOrder` while
  // untouched categories fall back to legacy positionAfter ordering.
  const t0MonForSteps = startOfWeekFn(row.t0At);
  const customStepsByCat = row.customSteps ?? {};
  const stepOrderByCat = row.stepOrder ?? {};

  // PLACEMENT MODEL — uniform distribution INSIDE the T-frame.
  //
  // Each T-frame (T1 / T2 / T3) is exactly 7 days (Mon..Sun) anchored on
  // T-0's week. Every category belongs to a single frame:
  //   T1 = outreach + ustalenia      (must finish in week T-2)
  //   T2 = nagrywanie + obróbka      (must finish in week T-1)
  //   T3 = publikacja                (release week)
  //
  // Items belonging to a frame are distributed uniformly across that frame's
  // INNER span (a 5-day window inside the 7-day band). The 1-day reserve at
  // each cross-frame boundary keeps adjacent milestone labels — OBRÓBKA and
  // PUBLIKACJA, USTALENIA and NAGRYWANIE — from colliding when the frames
  // happen to have items at their respective edges.
  //
  // T3 anchors its first slot on T-0 (Monday) so single-item publikacja still
  // lands on the release day; trailing publikacja customs spread from there.
  //
  // The end canonical of each category (cat.endStage) carries the milestone
  // tick. With uniform distribution it lands wherever its position in the
  // frame's flat sequence puts it; the tick re-anchors on that swept day so
  // the trunk + tick + circle stay vertically aligned.
  //
  // Recorded sub-stage dates of NON-end canonicals no longer drive the step
  // circle's x-coordinate (uniform distribution wins — that's what keeps
  // items inside their band). Those recorded dates remain visible as
  // `stagePins` on the colored band — separate visual layer, no overlap risk.
  // Inner-placement window per frame: each band's full span minus a 1-day
  // reserve at the trailing edge. The reserve keeps adjacent labels (e.g.
  // OBR. at the end of T2 vs. PUB. at the start of T3) from colliding when
  // both frames have items at their respective boundaries. For 1-day bands
  // (where reserve would invert), we collapse to the start day.
  // Frame bounds in t0Mon-relative coordinates: shift the 0-anchored periods
  // so the publikacja band sits on t0Mon and earlier bands sweep backward.
  // Without this shift, a row with the default periods would render every
  // checkpoint in the publication week instead of cascading T-2 → T-1 → T-0.
  const resolvedFramePeriods = periodsRelativeToT0Mon(row.periods);
  const FRAME_BOUNDS: Record<WeekFrameCode, { startDay: number; endDay: number }> = {
    T1: { startDay: -14, endDay: -9 },
    T2: { startDay: -7, endDay: -2 },
    T3: { startDay: 0, endDay: 5 },
  };
  for (const p of resolvedFramePeriods) {
    const code = p.code as WeekFrameCode;
    const start = p.startOffsetDays;
    const end = p.endOffsetDays;
    FRAME_BOUNDS[code] = {
      startDay: start,
      endDay: end > start ? end - 1 : start,
    };
  }

  type WorkItem = {
    cat: StageCategory;
    frame: WeekFrameCode;
    kind: 'canonical' | 'custom';
    stage: ProductionStatus | null;
    customId: string | null;
    label: string;
    positionAfter: ProductionStatus | null;
    doneAt: string | null;
    day: number;
    isEnd: boolean;
  };
  const draft: WorkItem[] = [];

  for (const frameCode of ['T1', 'T2', 'T3'] as const) {
    const bounds = FRAME_BOUNDS[frameCode];
    const frameSpan = bounds.endDay - bounds.startDay; // 6 days
    const cats = STAGE_CATEGORIES.filter((c) => c.frame === frameCode);

    type FrameSeqItem =
      | { cat: StageCategory; kind: 'canonical'; stage: ProductionStatus }
      | { cat: StageCategory; kind: 'custom'; step: CustomStep };
    const frameSeq: FrameSeqItem[] = [];

    for (const cat of cats) {
      const allCustoms = (customStepsByCat[cat.key] ?? []) as CustomStep[];
      const storedOrder = stepOrderByCat[cat.key];
      const sequence = resolveCategorySequence(cat.key, allCustoms, storedOrder);
      for (const it of sequence) {
        if (it.kind === 'canonical') {
          frameSeq.push({ cat, kind: 'canonical', stage: it.stage });
        } else {
          frameSeq.push({ cat, kind: 'custom', step: it.step });
        }
      }
    }

    const N = frameSeq.length;
    if (N === 0) continue;

    frameSeq.forEach((entry, k) => {
      // Single-item frame anchors on its band's Monday — preserves the
      // semantic that publikacja (T3 alone) sits on T-0.
      const day =
        N === 1 ? bounds.startDay : bounds.startDay + (k / (N - 1)) * frameSpan;

      if (entry.kind === 'canonical') {
        // Pull the canonical's actual doneAt out of the production's flat
        // steps[] so the gantt's per-step state can rely on the real source
        // of truth instead of inferring done-ness from the derived
        // ProductionStatus alone. Status-only derivation goes wrong at the
        // terminal stage (status='publishing' marks publishing canonical as
        // 'active' even after it's been marked done), and that mismatch
        // causes the canonical to appear to "unmark itself" when a later
        // custom is unmarked.
        const canonicalStep = (row.steps ?? []).find((x) => x.id === entry.stage);
        draft.push({
          cat: entry.cat,
          frame: frameCode,
          kind: 'canonical',
          stage: entry.stage,
          customId: null,
          label: PROD_STATUS_LABEL[entry.stage],
          positionAfter: null,
          doneAt: canonicalStep?.doneAt ?? null,
          day,
          isEnd: entry.stage === entry.cat.endStage,
        });
      } else {
        draft.push({
          cat: entry.cat,
          frame: frameCode,
          kind: 'custom',
          stage: null,
          customId: entry.step.id,
          label: entry.step.label,
          positionAfter: entry.step.positionAfter ?? null,
          doneAt: entry.step.doneAt,
          day,
          isEnd: false,
        });
      }
    });
  }

  // Each category's milestone tick re-anchors on the swept position of its
  // end canonical so the trunk line + tick + circle always share an x.
  const endDayByCategory: Partial<Record<ProductionStage, number>> = {};
  for (const d of draft) {
    if (d.isEnd) endDayByCategory[d.cat.key] = d.day;
  }

  // Per-category checkpoints (5 of them). Out-of-window checkpoints are
  // filtered — clipping them all to dayIdx=0 stacks ticks + labels on top of
  // each other for productions whose pipeline starts before/after the visible
  // strip (e.g. a published production where T-0 is days behind, so all
  // earlier-stage milestones land at the left edge). Same pattern as subSteps.
  const t0MonOffsetForCheckpoints = dayDiff(t0MonForSteps, firstDay);
  const allCheckpoints = STAGE_CATEGORIES.map((cat) => {
    const { date, source } = resolveStageDate(cat.endStage, row);
    // Position from the SWEPT end-canonical day if available — keeps tick
    // glued to its circle even after sweep-shifts. Date label uses the
    // original resolved date (so users still see the recorded calendar
    // date in the milestone label).
    const sweptDay = endDayByCategory[cat.key];
    const rawIdx =
      sweptDay !== undefined
        ? t0MonOffsetForCheckpoints + sweptDay
        : dayDiff(date, firstDay);
    const clippedIdx = Math.max(0, Math.min(totalDays - 1, rawIdx));
    const outOfWindow: 'before' | 'after' | null =
      rawIdx < 0 ? 'before' : rawIdx >= totalDays ? 'after' : null;
    return {
      cat,
      date,
      source,
      dayIdx: clippedIdx,
      outOfWindow,
      state: categoryState(cat, optimisticStatus),
    };
  });
  const checkpoints = allCheckpoints.filter((cp) => cp.outOfWindow == null);

  // 3) Compute dayIdx, clipping, numbering. Out-of-window steps get filtered.
  // Day-to-x: t0Mon's offset from firstDay is integer days; add the (possibly
  // fractional) `day` directly. Reuse the same offset that drove checkpoint
  // positioning so trunk + tick + circle stay in lockstep.
  //
  // Per-step dates are resolved separately from per-step positions:
  //   • POSITION drives the circle's x-coordinate and is uniformly distributed
  //     inside the band (so steps stay neatly inside their week even before
  //     the user records anything).
  //   • DATE drives the small inline date chip under the circle and reflects
  //     ONLY user-recorded / derived / t0 anchors. Tentative slots show no
  //     date chip — the band already telegraphs "tygodnia X".
  const allSubSteps: SubStepInfo[] = draft.map((d, idx) => {
    const rawIdx = t0MonOffsetForCheckpoints + d.day;
    const clippedIdx = Math.max(0, Math.min(totalDays - 1, rawIdx));

    let date: Date | null = null;
    let dateSource: 'recorded' | 'derived' | 't0' | null = null;
    if (d.kind === 'canonical' && d.stage) {
      const resolved = resolveSubStageDate(d.stage, row);
      if (resolved.source !== 'tentative') {
        date = resolved.date;
        dateSource = resolved.source;
      }
    }

    return {
      kind: d.kind,
      stage: d.stage,
      customId: d.customId,
      label: d.label,
      n: idx + 1,
      cat: d.cat,
      frame: d.frame,
      day: d.day,
      dayIdx: clippedIdx,
      outOfWindow: rawIdx < 0 ? 'before' : rawIdx >= totalDays ? 'after' : null,
      doneAt: d.doneAt,
      positionAfter: d.positionAfter,
      date,
      dateSource,
      withTime: d.cat.withTime,
    };
  });
  // Render only in-window steps. Stacking ticks at the same edge for past /
  // future productions is unreadable; skipping is cleaner.
  const subSteps = allSubSteps.filter((s) => s.outOfWindow == null);

  // Sub-step pins on the colored T1/T2/T3 bands — every step (canonical OR
  // custom) whose user-entered `dateIso` falls inside the visible window
  // becomes a numbered chip ON its category's band. The chip carries the
  // global step number; hover surfaces label + date + description.
  //
  // Auto-derived dates (editing = shoot+1) and the production-level T-0 are
  // intentionally NOT pinned — they don't represent a date the user typed
  // *into a step row*, and the milestone tick / T3 band already telegraph
  // those anchors.
  const subStepById = new Map<string, SubStepInfo>();
  for (const s of allSubSteps) {
    const id = s.kind === 'canonical' && s.stage ? (s.stage as string) : s.customId;
    if (id) subStepById.set(id, s);
  }
  const stagePins: {
    stepId: string;
    label: string;
    description: string | null;
    frame: WeekFrameCode;
    dayIdx: number;
    dateLabel: string;
    n: number;
    /** Index within the same-day stack (0 = topmost). */
    stackIdx: number;
    /** Total pins sharing this dayIdx — used to center the stack. */
    stackSize: number;
  }[] = [];
  for (const step of row.steps ?? []) {
    if (!step.dateIso) continue;
    const date = new Date(step.dateIso);
    const idx = dayDiff(date, firstDay);
    if (idx < 0 || idx >= totalDays) continue;
    const sub = subStepById.get(step.id);
    if (!sub) continue;
    const dateLabel = sub.withTime
      ? date.toLocaleString('pl-PL', {
          dateStyle: 'medium',
          timeStyle: 'short',
        })
      : date.toLocaleDateString('pl-PL', { dateStyle: 'medium' });
    stagePins.push({
      stepId: step.id,
      label: step.label,
      description: step.description?.trim() ? step.description.trim() : null,
      frame: sub.frame,
      dayIdx: idx,
      dateLabel,
      n: sub.n,
      stackIdx: 0,
      stackSize: 1,
    });
  }
  // Pins sharing the same dayIdx would render on top of each other. Group
  // them and assign vertical stack positions so the user can see and hover
  // each one individually. Order within the stack follows step number `n`
  // so the visual stack reads top→bottom in step order.
  {
    const byDay = new Map<number, typeof stagePins>();
    for (const pin of stagePins) {
      const list = byDay.get(pin.dayIdx);
      if (list) list.push(pin);
      else byDay.set(pin.dayIdx, [pin]);
    }
    for (const list of byDay.values()) {
      if (list.length <= 1) continue;
      list.sort((a, b) => a.n - b.n);
      list.forEach((pin, i) => {
        pin.stackIdx = i;
        pin.stackSize = list.length;
      });
    }
  }

  // Right column dynamic height. After removing the per-step date chips and
  // the floating active-step label, nothing extends below the sub-bar circle
  // (last visual at ~14rem). Half a rem of breathing room keeps the bottom
  // border tidy.
  const rightColumnHeight = 14.75;

  const t0Days = Math.round((row.t0At.getTime() - Date.now()) / DAY_MS);
  const tLabel = t0Days === 0 ? 'T-0' : t0Days > 0 ? `T-${t0Days}` : `T+${Math.abs(t0Days)}`;
  const displayName = row.artistName ?? row.title;
  const orphanWithArtist = row.type === 'with-artist' && !row.artistName;
  const subtitle = row.artistName
    ? row.artistHandle ?? row.title
    : orphanWithArtist
      ? 'bez artysty — przypisz w produkcji'
      : 'solo';
  const cancelled = optimisticStatus === 'cancelled';

  // Per-step state derived strictly from each step's own doneAt (the data
  // truth-source) plus visual order. The first step in visual order whose
  // doneAt is null is the active one; everything before it is passed
  // (cascade-implied), everything after it is pending. We deliberately
  // don't consult ProductionStatus or the legacy positionAfter rule: those
  // produced phantom passed/active states that diverged from the actual
  // doneAt and made click-to-unmark feel unresponsive.
  // Effective doneAt — optimistic override (set by either the milestone
  // click or the sub-step click) wins over the row.steps server value so
  // both surfaces stay in lockstep during the optimistic window.
  const stripIsDone = (s: SubStepInfo): boolean => {
    const k = subStepKey(s);
    if (k in optimisticDoneByKey) return optimisticDoneByKey[k];
    return !!s.doneAt;
  };
  const stripFirstUndoneIdx = (() => {
    if (cancelled) return -1;
    for (let i = 0; i < allSubSteps.length; i++) {
      if (!stripIsDone(allSubSteps[i])) return i;
    }
    return -1;
  })();
  const stepStateOf = (s: SubStepInfo): 'passed' | 'active' | 'pending' => {
    if (cancelled) return 'pending';
    const i = allSubSteps.indexOf(s);
    if (stripFirstUndoneIdx < 0) return 'passed';
    if (i < 0) return stripIsDone(s) ? 'passed' : 'pending';
    if (i < stripFirstUndoneIdx) return 'passed';
    if (i === stripFirstUndoneIdx) return 'active';
    return 'pending';
  };
  // "All done" = production has reached publishing AND every custom step is
  // checked off. Publishing is the terminal status; once status='publishing'
  // and no customs remain, the workflow has nothing left to mark.
  const customsRemaining = allSubSteps.some(
    (s) => s.kind === 'custom' && stepStateOf(s) !== 'passed',
  );
  const allDone =
    !cancelled && STAGE_INDEX[optimisticStatus] >= STAGE_INDEX.publishing && !customsRemaining;
  const nextStep =
    cancelled || allDone
      ? null
      : allSubSteps.find((s) => stepStateOf(s) !== 'passed') ?? null;
  const totalStepCount = allSubSteps.length;

  return (
    <div
      className={`${
        showArtistGap
          ? 'mt-10 pt-4 border-t-[3px] border-double border-foreground/25'
          : isFirstOfArtist
            ? 'border-t border-border/70'
            : ''
      } hover:bg-muted/15 ui-transition group`}
    >
      <div
        className="grid gap-0"
        style={{ gridTemplateColumns: `22rem 1fr` }}
      >
        {/* LEFT: meta + progress bar — sticky-left so the artist name +
            next-step indicator stay readable while the user scrolls the
            timeline horizontally. z-30 so it sits above the gantt's step
            buttons (z-20) but below the sticky header (z-40). */}
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
                      className="flex-1 block text-base font-bold tracking-tight truncate hover:text-[var(--accent-blue)] transition"
                      title={`${displayName} — pełny widok produkcji`}
                    >
                      {displayName}
                    </Link>
                    <button
                      type="button"
                      onClick={() => setExpanded((v) => !v)}
                      className="shrink-0 p-1 rounded-md hover:bg-muted active:scale-90 ui-transition text-muted-foreground hover:text-foreground"
                      aria-expanded={expanded}
                      aria-label={expanded ? 'Zwiń szczegóły' : 'Rozwiń szczegóły'}
                      title={expanded ? 'Zwiń szczegóły' : 'Rozwiń szczegóły'}
                    >
                      <ChevronDown
                        className={`w-4 h-4 transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] ${expanded ? 'rotate-180' : ''}`}
                      />
                    </button>
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
                <ProductionTypeBadge type={row.type} />
                {row.videographerName ? (
                  <span
                    className="text-muted-foreground truncate"
                    title={`Kamerzysta: ${row.videographerName}`}
                  >
                    · kam:{' '}
                    <span className="font-semibold text-foreground/80">{row.videographerName}</span>
                  </span>
                ) : null}
              </div>
            </>
          ) : (
            // Same-artist follow-up row: account header is suppressed so the
            // cluster reads as one artist with multiple parallel tracks, but
            // the type badge ("solo" / "z artystą") stays visible under the
            // next-step indicator — within an artist cluster solo and
            // with-artist tracks need to be told apart at a glance.
            <>
              <NextStepIndicator
                productionId={row.id}
                cancelled={cancelled}
                allDone={allDone}
                nextStep={nextStep}
                totalSteps={totalStepCount}
              />
              <div className="flex items-center gap-1.5 text-[11px] mt-auto">
                <ProductionTypeBadge type={row.type} />
                {row.videographerName ? (
                  <span
                    className="text-muted-foreground truncate"
                    title={`Kamerzysta: ${row.videographerName}`}
                  >
                    · kam:{' '}
                    <span className="font-semibold text-foreground/80">{row.videographerName}</span>
                  </span>
                ) : null}
              </div>
            </>
          )}
        </div>

      {/* RIGHT: timeline. Three vertically-stacked layers, all sharing the same
          calendar coordinate system (% of dayWidthPct):
            1. Bands T1/T2/T3 (top) with sub-stage pins for recorded dates
            2. Main 5-milestone bar (Outreach/Ustalenia/Nagr/Mont/Pub) at the
               recorded/default date of each milestone end-stage + labels
            3. 9-step numbered sub-bar — each step at its own calendar date so
               steps 1-3 land under Outreach, 4-6 under Ustalenia, 7 under Nagr,
               8 under Mont, 9 under Pub. The sub-bar physically cannot exceed
               the T1+T2+T3 span because no step has a default offset outside
               of those weeks. */}
      <div
        className="relative"
        style={{ height: `${rightColumnHeight}rem` }}
      >
        {/* Bands strip — calendar-grid background and weekend stripes are
            confined to this top region. Below, the milestone area has a clean
            background so the ticks/labels are not visually crowded. */}
        <div
          className="absolute top-0 left-0 right-0 h-[5.5rem]"
          style={{
            backgroundImage: `repeating-linear-gradient(to right, transparent 0, transparent calc(${dayWidthPct}% - 1px), var(--border) calc(${dayWidthPct}% - 1px), var(--border) ${dayWidthPct}%)`,
          }}
        >
          {days.map((d, i) =>
            d.isWeekend ? (
              <div
                key={`we-${i}`}
                className="absolute top-0 bottom-0 bg-muted/30 pointer-events-none"
                style={{ left: `${i * dayWidthPct}%`, width: `${dayWidthPct}%` }}
              />
            ) : null,
          )}

          {frameBands.map((band) => {
            const tone = FRAME_TONE[band.code];
            const left = band.startDay * dayWidthPct;
            const width = (band.endDay - band.startDay + 1) * dayWidthPct;
            return (
              <div
                key={band.code}
                className={`absolute top-0 bottom-0 ${tone.bg} pointer-events-none border ${tone.border} rounded-md`}
                style={{ left: `${left}%`, width: `${width}%` }}
                aria-hidden
              >
                <span
                  className={`absolute top-2 left-3 text-[11px] uppercase tracking-[0.2em] font-bold ${tone.ink} opacity-90`}
                >
                  {band.code}
                </span>
              </div>
            );
          })}

          {/* Folder shortcuts — quick-open the production work-folder stage in
              the OS file manager. T2 hosts nagrywanie + obrobka (raw footage
              + edit projects); T3 hosts publikacja (per-platform finals).
              T1 is communication-only — no working folder. Rendered as
              siblings of the band rectangles so the band can stay
              pointer-events-none while the buttons remain clickable. */}
          {frameBands.map((band) => {
            const stages: { stage: 'nagrywanie' | 'obrobka' | 'publikacja'; label: string }[] =
              band.code === 'T2'
                ? [
                    { stage: 'nagrywanie', label: 'nagrywanie' },
                    { stage: 'obrobka', label: 'obróbka' },
                  ]
                : band.code === 'T3'
                  ? [{ stage: 'publikacja', label: 'publikacja' }]
                  : [];
            if (stages.length === 0) return null;
            const tone = FRAME_TONE[band.code];
            const right = (band.endDay + 1) * dayWidthPct;
            return (
              <div
                key={`folders-${band.code}`}
                className="absolute top-1.5 flex gap-1 pointer-events-auto z-10"
                style={{
                  left: `${right}%`,
                  transform: 'translateX(calc(-100% - 0.375rem))',
                }}
              >
                {stages.map(({ stage, label }) => (
                  <button
                    key={stage}
                    type="button"
                    onClick={() => {
                      void openProductionFolder(row.id, stage).then((res) => {
                        if (!res.ok) console.warn('[gantt] open folder failed:', res.error);
                      });
                    }}
                    aria-label={`Otwórz folder ${label} dla ${displayName}`}
                    title={`Otwórz folder: ${label}`}
                    className={`grid place-items-center w-6 h-6 rounded ${tone.passed} shadow-sm hover:scale-110 hover:shadow-md transition focus:outline-none focus-visible:ring-2 focus-visible:ring-foreground/40`}
                  >
                    <FolderOpen className="w-3.5 h-3.5" />
                  </button>
                ))}
              </div>
            );
          })}

          {/* Sub-step pins — every step with a user-entered `dateIso` becomes
              a numbered chip on its category's band. The chip sits in the
              middle of the band so it doesn't crowd the T1/T2/T3 corner tag.
              Hover (or keyboard focus) reveals a styled card with: step
              number, label, date, and the full description. */}
          {stagePins.map((pin) => {
            const tone = FRAME_TONE[pin.frame];
            const x = (pin.dayIdx + 0.5) * dayWidthPct;
            const ariaLabel = [
              `Krok ${pin.n}: ${pin.label}`,
              pin.dateLabel,
              pin.description,
            ]
              .filter(Boolean)
              .join(' — ');
            // Vertical offset for same-day pin stacks. 1.875rem ≈ pin
            // height (1.75rem) + 0.125rem gap so neighbours never touch.
            // We center the stack around 50% so a 2-pin stack reads as
            // one above the other within the band.
            const PIN_STACK_SPACING_REM = 1.875;
            const offsetRem =
              (pin.stackIdx - (pin.stackSize - 1) / 2) * PIN_STACK_SPACING_REM;
            return (
              <div
                key={`pin-${pin.stepId}`}
                className="group/pin absolute z-20 pointer-events-auto"
                style={{
                  left: `${x}%`,
                  top: '50%',
                  transform: `translate(-50%, calc(-50% + ${offsetRem}rem))`,
                }}
              >
                {/* vertical guide — thin tick connecting chip to the band edges
                    so the eye can trace the chip back to its calendar day. */}
                <span
                  className={`absolute left-1/2 -translate-x-1/2 -top-4 -bottom-4 w-px ${tone.passed.split(' ')[0]} opacity-40 group-hover/pin:opacity-80 transition`}
                  aria-hidden
                />
                <button
                  type="button"
                  aria-label={ariaLabel}
                  tabIndex={0}
                  className={`relative grid place-items-center w-7 h-7 rounded-full text-[11px] font-bold tabular-nums border-2 border-white shadow-md ring-1 ring-black/5 ${tone.passed} cursor-help group-hover/pin:scale-110 group-hover/pin:shadow-lg group-focus-within/pin:scale-110 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-foreground/40`}
                >
                  {pin.n}
                </button>
                {/* Hover/focus card — appears above the pin with full step
                    context. Uses pointer-events-none so it never traps the
                    cursor; the parent group keeps it visible while the user
                    hovers anywhere within the pin container. */}
                <div
                  role="tooltip"
                  className="opacity-0 group-hover/pin:opacity-100 group-focus-within/pin:opacity-100 transition-opacity duration-150 pointer-events-none absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 rounded-lg border border-border bg-popover text-popover-foreground shadow-xl px-3 py-2.5"
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <span
                      className={`grid place-items-center w-5 h-5 rounded-full text-[10px] font-bold tabular-nums shadow-sm ${tone.passed}`}
                    >
                      {pin.n}
                    </span>
                    <span className="text-[10px] uppercase tracking-[0.14em] font-semibold text-muted-foreground">
                      Krok {pin.n}
                    </span>
                  </div>
                  <div className="text-sm font-semibold leading-snug text-foreground">
                    {pin.label}
                  </div>
                  <div className="mt-0.5 text-[11px] tabular-nums text-muted-foreground">
                    {pin.dateLabel}
                  </div>
                  {pin.description ? (
                    <div className="mt-2 pt-2 border-t border-border/70 text-[11.5px] italic text-muted-foreground leading-snug whitespace-pre-wrap">
                      {pin.description}
                    </div>
                  ) : null}
                  {/* Arrow tail pointing down to the chip */}
                  <span
                    aria-hidden
                    className="absolute top-full left-1/2 -translate-x-1/2 -mt-px w-2 h-2 rotate-45 bg-popover border-r border-b border-border"
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Tree-pattern guides — for each category, the END canonical sub-step
            has a SOLID vertical "trunk" running from its circle up to the
            milestone tick. Earlier canonical AND inserted custom sub-steps
            have a SHORT dashed vertical going up to a junction height, then a
            dashed horizontal connector merging into the trunk. */}
        {STAGE_CATEGORIES.map((cat) => {
          const inCat = subSteps.filter((s) => s.cat.key === cat.key);
          if (inCat.length === 0) return null;
          const endStep =
            inCat.find((s) => s.kind === 'canonical' && s.stage === cat.endStage) ?? inCat[inCat.length - 1];
          const endX = (endStep.dayIdx + 0.5) * dayWidthPct;
          // Trunk (solid pionowy łącznik milestone→circle) — średnio widoczny.
          // Branches (dashed) — wyraźnie cichsze, żeby gęstwina kreseł w
          // kategoriach z wieloma krokami (np. 6+ w T1) nie zalewała wiersza.
          const trunkBorder =
            cat.frame === 'T1'
              ? 'border-amber-400/60'
              : cat.frame === 'T2'
                ? 'border-violet-400/60'
                : 'border-emerald-400/60';
          const branchBorder =
            cat.frame === 'T1'
              ? 'border-amber-400/40'
              : cat.frame === 'T2'
                ? 'border-violet-400/40'
                : 'border-emerald-400/40';

          // Vertical positions:
          //   - milestone tick bottom edge ≈ 8.25rem (main bar TRACK_TOP 7.5rem + tick 0.75rem)
          //   - sub-step circle top edge ≈ 13.125rem (sub-bar TRACK_TOP 13.5rem - 0.375rem)
          //   - JUNCTION (where horizontal connectors live) — sits in the upper
          //     part of the gap so the rake "sweeps" up toward the milestone
          const TRUNK_TOP = '8.25rem'; // top of the trunk/junction verticals
          const JUNCTION_Y = '9.5rem'; // where horizontal arms meet the trunk
          const JUNCTION_TO_SUB_HEIGHT = '3.625rem'; // 13.125 - 9.5

          return (
            <div key={`tree-${cat.key}`} aria-hidden>
              {/* Trunk: solid vertical from milestone tick down to sub-bar at end-step x */}
              <div
                className={`absolute pointer-events-none border-l-2 ${trunkBorder}`}
                style={{
                  top: TRUNK_TOP,
                  height: '4.875rem', // 13.125 - 8.25
                  left: `${endX}%`,
                  transform: 'translateX(-0.5px)',
                }}
              />

              {/* Branches: for each non-end sub-step, draw the rake tooth.
                  - vertical from sub-step circle up to JUNCTION_Y (dashed)
                  - horizontal from this x to endX at JUNCTION_Y (dashed) */}
              {inCat
                .filter((s) => s !== endStep)
                .map((s) => {
                  const x = (s.dayIdx + 0.5) * dayWidthPct;
                  const goesRight = x < endX;
                  const horizLeft = goesRight ? x : endX;
                  const horizWidth = Math.abs(endX - x);
                  const branchKey = s.kind === 'canonical' ? `cn:${s.stage}` : `cs:${s.customId}`;
                  return (
                    <div key={`branch-${branchKey}`}>
                      {/* tooth (vertical) — from circle up to junction */}
                      <div
                        className={`absolute pointer-events-none border-l-2 border-dashed ${branchBorder}`}
                        style={{
                          top: JUNCTION_Y,
                          height: JUNCTION_TO_SUB_HEIGHT,
                          left: `${x}%`,
                          transform: 'translateX(-0.5px)',
                        }}
                      />
                      {/* connector (horizontal) — from this x to trunk x */}
                      <div
                        className={`absolute pointer-events-none border-t-2 border-dashed ${branchBorder}`}
                        style={{
                          top: JUNCTION_Y,
                          left: `${horizLeft}%`,
                          width: `${horizWidth}%`,
                          transform: 'translateY(-1px)',
                        }}
                      />
                    </div>
                  );
                })}
            </div>
          );
        })}

        {/* Track + 5 milestones positioned at their calendar dates.
            Track connects them visually so the row reads as one journey. */}
        <PipelineMilestones
          productionId={row.id}
          checkpoints={checkpoints}
          allSubSteps={allSubSteps}
          dayWidthPct={dayWidthPct}
          status={optimisticStatus}
          cancelled={cancelled}
          onChange={setStatus}
          optimisticDoneByKey={optimisticDoneByKey}
          setOptimisticDoneByKey={setOptimisticDoneByKey}
        />

        {/* Today vertical line — full height, passes through both regions */}
        {todayInWindow ? (
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-rose-500/80 pointer-events-none z-[5]"
            style={{ left: `calc(${(todayIdx + 0.5) * dayWidthPct}% - 1px)` }}
            aria-hidden
          />
        ) : null}

        {cancelled ? (
          <div
            className="absolute inset-0 bg-rose-500/5 pointer-events-none flex items-center justify-center"
            aria-hidden
          >
            <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-rose-700 bg-rose-100/80 px-2 py-0.5 rounded">
              anulowane
            </span>
          </div>
        ) : null}

        {/* 9-step numbered sub-bar — positioned at each step's calendar date so
            it physically clusters under its parent milestone. */}
        <SubStepBar
          productionId={row.id}
          subSteps={subSteps}
          allSubSteps={allSubSteps}
          dayWidthPct={dayWidthPct}
          status={optimisticStatus}
          cancelled={cancelled}
          onChange={setStatus}
          optimisticDoneByKey={optimisticDoneByKey}
          setOptimisticDoneByKey={setOptimisticDoneByKey}
        />
      </div>
      </div>

      {expanded ? (
        <div className="animate-fade-up">
          <ExpandedDetails
            row={row}
            currentStatus={optimisticStatus}
            tLabel={tLabel}
          />
        </div>
      ) : null}
    </div>
  );
}

/**
 * Next-step indicator card — the "what do I do next?" answer at a glance.
 * Three states: cancelled (rose), all-done (emerald), next-step (frame-tinted).
 *
 * Visual: card with a thin colored left rail (frame T1/T2/T3 = amber/violet/
 * emerald). Focal point is the step name in the dark accent ink — not the
 * band background. A small numbered dot (frame-colored) on the left tells the
 * user which step in the sequence is up. Frame label is demoted to a single-
 * line caption to avoid the "label-over-label" feel of the prior pill stack.
 */
function NextStepIndicator({
  productionId,
  cancelled,
  allDone,
  nextStep,
  totalSteps,
}: {
  productionId: number;
  cancelled: boolean;
  allDone: boolean;
  nextStep: SubStepInfo | null;
  totalSteps: number;
}) {
  if (cancelled) {
    return (
      <div className="flex items-center gap-3 rounded-xl border-2 border-rose-200 bg-rose-50/70 px-3 py-2 animate-fade-in">
        <span className="grid place-items-center w-9 h-9 rounded-full bg-rose-500 text-white text-base font-bold shadow-sm shrink-0">
          ×
        </span>
        <span className="text-sm font-bold uppercase tracking-[0.14em] text-rose-700">
          Anulowane
        </span>
      </div>
    );
  }
  if (allDone) {
    return (
      <div className="flex items-center gap-3 rounded-xl border-2 border-emerald-200 bg-emerald-50/70 px-3 py-2 animate-scale-in">
        <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" strokeWidth={2.5} />
        <span className="text-sm font-bold uppercase tracking-[0.14em] text-emerald-800">
          Wszystkie kroki gotowe
        </span>
      </div>
    );
  }
  if (!nextStep) return null;

  // Frame-keyed accents — left rail + numbered dot tinted to T1/T2/T3 so the
  // user can spot which band the upcoming step lives in without reading the
  // caption.
  const frameAccent = {
    T1: { rail: 'bg-amber-500', dot: 'bg-amber-500 text-white', ink: 'text-amber-950', faint: 'text-amber-700', glow: 'shadow-amber-200/70' },
    T2: { rail: 'bg-violet-500', dot: 'bg-violet-500 text-white', ink: 'text-violet-950', faint: 'text-violet-700', glow: 'shadow-violet-200/70' },
    T3: { rail: 'bg-emerald-500', dot: 'bg-emerald-500 text-white', ink: 'text-emerald-950', faint: 'text-emerald-700', glow: 'shadow-emerald-200/70' },
  }[nextStep.frame];

  return (
    <Link
      key={`${nextStep.kind}:${nextStep.stage ?? nextStep.customId}`}
      href={`/productions/${productionId}`}
      className="relative rounded-xl border-2 border-border bg-card pl-4 pr-3 py-2.5 flex items-center gap-3 hover:border-foreground/40 hover:shadow-lg hover:-translate-y-0.5 ui-transition group/next animate-fade-up no-underline"
      title={`${nextStep.cat.label} · krok ${nextStep.n}/${totalSteps}: ${nextStep.label}`}
    >
      <span
        aria-hidden
        className={`absolute left-0 top-1.5 bottom-1.5 w-[4px] rounded-full ${frameAccent.rail} ui-transition group-hover/next:top-1 group-hover/next:bottom-1`}
      />
      <span
        className={`grid place-items-center w-10 h-10 rounded-full text-base font-bold tabular-nums shrink-0 ${frameAccent.dot} shadow-md ${frameAccent.glow} ui-transition group-hover/next:scale-105`}
      >
        {nextStep.n}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[10px] uppercase tracking-[0.18em] font-bold text-muted-foreground">
            Następny krok
          </span>
          <span className="text-[10px] tabular-nums text-muted-foreground/70 font-semibold">
            {nextStep.n}/{totalSteps}
          </span>
        </div>
        <div className={`text-base font-bold leading-tight truncate ${frameAccent.ink}`}>
          {nextStep.label}
        </div>
        <div className={`text-xs leading-tight mt-1 truncate font-medium ${frameAccent.faint}`}>
          {nextStep.cat.label}
        </div>
      </div>
      <ArrowRight
        className={`w-5 h-5 shrink-0 ${frameAccent.faint} ui-transition group-hover/next:translate-x-0.5`}
        strokeWidth={2.5}
      />
    </Link>
  );
}

/**
 * Pipeline milestones — same visual language as the StageTracker on the
 * production page (track + 5 ticks + labels) BUT positioned at the actual
 * calendar dates of each milestone, so each tick sits directly under the
 * T1/T2/T3 band it belongs to:
 *   • Outreach + Ustalenia z kamerzystą → under T1
 *   • Nagrywanie + Obróbka              → under T2
 *   • Publikacja                        → under T3
 *
 * Coordinates are % of the full timeline (same system as the bands above),
 * so when bands shift left/right with T-0, ticks shift with them.
 */
function PipelineMilestones({
  productionId,
  checkpoints,
  allSubSteps,
  dayWidthPct,
  status,
  cancelled,
  onChange,
  optimisticDoneByKey,
  setOptimisticDoneByKey,
}: {
  productionId: number;
  checkpoints: CheckpointInfo[];
  allSubSteps: SubStepInfo[];
  dayWidthPct: number;
  status: ProductionStatus;
  cancelled: boolean;
  onChange: (next: ProductionStatus) => void;
  optimisticDoneByKey: Record<string, boolean>;
  setOptimisticDoneByKey: (next: Record<string, boolean>) => void;
}) {
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const [, startMilestoneTransition] = useTransition();

  // Cascade-aware effective doneAt for each sub-step — mirrors SubStepBar.
  const isStepDone = (s: SubStepInfo): boolean => {
    const k = subStepKey(s);
    if (k in optimisticDoneByKey) return optimisticDoneByKey[k];
    return !!s.doneAt;
  };
  const firstUndoneIdx = (() => {
    if (cancelled) return -1;
    for (let i = 0; i < allSubSteps.length; i++) {
      if (!isStepDone(allSubSteps[i])) return i;
    }
    return -1;
  })();
  // Milestone state derived from sub-step cascade so the main tick and the
  // numbered circle below it can never disagree. categoryState() (the legacy
  // status-based comparison) reported "passed" for the terminal categories
  // even when their only canonical was still active, because it compares
  // STAGE_INDEX[status] >= STAGE_INDEX[endStage] — true at status=endStage.
  // Anchoring on firstUndoneIdx removes that boundary inconsistency.
  const milestoneState = (cat: (typeof STAGE_CATEGORIES)[number]): 'passed' | 'active' | 'pending' => {
    if (cancelled) return 'pending';
    const catIdxs = allSubSteps
      .map((s, i) => (s.cat.key === cat.key ? i : -1))
      .filter((i) => i >= 0);
    if (catIdxs.length === 0) return 'pending';
    const firstCatIdx = catIdxs[0];
    const lastCatIdx = catIdxs[catIdxs.length - 1];
    if (firstUndoneIdx < 0) return 'passed';
    if (firstUndoneIdx > lastCatIdx) return 'passed';
    if (firstUndoneIdx >= firstCatIdx) return 'active';
    return 'pending';
  };

  // Sequential cascade — clicking a milestone marks ALL canonical sub-stages
  // up to and including that milestone's endStage as DONE (and all customs in
  // between), or unmarks the entire category if it's already passed. Mirrors
  // SubStepBar.onStepClick — single source of truth for "kroki po kolei".
  const onClickCategory = (cat: (typeof STAGE_CATEGORIES)[number]) => {
    if (cancelled) return;
    const state = milestoneState(cat);
    const mode: 'mark' | 'unmark' = state === 'passed' ? 'unmark' : 'mark';

    // Target: the canonical step at the FIRST sub-stage of this category for
    // unmark (so the whole category becomes not-done), or the LAST sub-stage
    // (endStage) for mark.
    const targetStage = mode === 'mark' ? cat.endStage : cat.subStages[0];
    const targetIdxInAll = allSubSteps.findIndex(
      (s) => s.kind === 'canonical' && s.stage === targetStage,
    );
    if (targetIdxInAll < 0) return;

    const lastDoneIdx = mode === 'mark' ? targetIdxInAll : targetIdxInAll - 1;

    // Optimistic: write the same cascade-shape doneAt map the SubStepBar
    // would write — every step at idx ≤ lastDoneIdx becomes done, the rest
    // become not done. Without this, the sub-step circles wouldn't react
    // to a milestone click until the server revalidate landed (because the
    // sub-step rendering reads from optimisticDoneByKey + s.doneAt, never
    // from the canonical-derived ProductionStatus).
    const nextOverrides: Record<string, boolean> = {};
    for (let i = 0; i < allSubSteps.length; i++) {
      nextOverrides[subStepKey(allSubSteps[i])] = i <= lastDoneIdx;
    }
    setOptimisticDoneByKey(nextOverrides);

    let highestCanonicalIdx = -1;
    for (let i = 0; i <= lastDoneIdx; i++) {
      const step = allSubSteps[i];
      if (step.kind === 'canonical' && step.stage) {
        const sIdx = STAGE_INDEX[step.stage];
        if (sIdx > highestCanonicalIdx) highestCanonicalIdx = sIdx;
      }
    }
    const nextStatus: ProductionStatus =
      highestCanonicalIdx < 0
        ? 'email-sent'
        : PRODUCTION_PROGRESSION[Math.min(highestCanonicalIdx + 1, PRODUCTION_PROGRESSION.length - 1)];
    onChange(nextStatus);

    startMilestoneTransition(() => {
      // New cascade signature: stepId is the canonical step's id, which —
      // for migrated productions — equals its old ProductionStatus value.
      cascadeStepsTo(productionId, targetStage, mode);
    });
  };

  const tickX = (cp: CheckpointInfo) => (cp.dayIdx + 0.5) * dayWidthPct;

  if (checkpoints.length === 0) return null;

  const sortedByX = [...checkpoints].sort((a, b) => a.dayIdx - b.dayIdx);
  const firstX = tickX(sortedByX[0]);
  const lastX = tickX(sortedByX[sortedByX.length - 1]);
  const trackWidth = Math.max(0, lastX - firstX);

  // Progress fill: stretch from first tick to the rightmost passed tick.
  const passedTicksByX = sortedByX.filter((cp) => milestoneState(cp.cat) === 'passed');
  const lastPassedX = passedTicksByX.length > 0 ? tickX(passedTicksByX[passedTicksByX.length - 1]) : firstX;
  const progressWidth = Math.max(0, lastPassedX - firstX);

  // Track sits below the 88px-tall bands strip, with breathing room.
  const TRACK_TOP = '7.5rem';
  const LABEL_TOP = '9rem';

  return (
    <>
      {/* Track (background) */}
      <div
        className="absolute h-[3px] rounded-full bg-border pointer-events-none"
        style={{ top: TRACK_TOP, left: `${firstX}%`, width: `${trackWidth}%`, transform: 'translateY(-50%)' }}
        aria-hidden
      />
      {/* Track (progress fill) */}
      <div
        className="absolute h-[3px] rounded-full pointer-events-none transition-[width] duration-300 ease-out"
        style={{
          top: TRACK_TOP,
          left: `${firstX}%`,
          width: `${progressWidth}%`,
          transform: 'translateY(-50%)',
          background: 'linear-gradient(90deg, var(--accent-blue-soft) 0%, var(--accent-blue) 100%)',
        }}
        aria-hidden
      />

      {/* 5 milestone ticks — positioned at calendar dates */}
      {checkpoints.map((cp) => {
        const state = milestoneState(cp.cat);
        const isHovered = hoveredKey === cp.cat.key;
        const tentative = cp.source === 'tentative';
        const x = tickX(cp);

        const stateLabel =
          state === 'passed'
            ? '✓ zaliczone (klik = cofnij)'
            : state === 'active'
              ? 'w trakcie (klik = odhacz całą fazę)'
              : 'do zrobienia (klik = odhacz)';
        const dateLabel = tentative
          ? 'brak daty — ustaw na produkcji'
          : cp.date.toLocaleDateString('pl-PL', { dateStyle: 'medium' });
        const tooltip = `${cp.cat.label} · ${dateLabel}${cp.outOfWindow === 'before' ? ' (przed oknem)' : cp.outOfWindow === 'after' ? ' (po oknie)' : ''} · ${stateLabel}`;

        return (
          <button
            key={cp.cat.key}
            type="button"
            disabled={cancelled}
            onMouseEnter={() => setHoveredKey(cp.cat.key)}
            onMouseLeave={() => setHoveredKey(null)}
            onFocus={() => setHoveredKey(cp.cat.key)}
            onBlur={() => setHoveredKey(null)}
            onClick={() => onClickCategory(cp.cat)}
            aria-label={tooltip}
            aria-current={state === 'active' ? 'step' : undefined}
            aria-pressed={state === 'passed'}
            title={tooltip}
            className={`absolute z-10 grid place-items-center rounded-full transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
              cancelled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
            } ${
              state === 'active'
                ? 'w-7 h-7 bg-foreground text-background ring-4 ring-[var(--accent-blue)]/25 scale-105'
                : state === 'passed'
                  ? 'w-6 h-6 bg-[var(--accent-blue)] text-white hover:scale-110'
                  : `w-5 h-5 bg-background border-2 ${tentative ? 'border-dashed border-muted-foreground/50' : 'border-border'} hover:border-foreground/50 hover:scale-110`
            } ${isHovered && state !== 'active' ? 'ring-4 ring-foreground/10' : ''}`}
            style={{
              top: TRACK_TOP,
              left: `${x}%`,
              transform: 'translate(-50%, -50%)',
            }}
          >
            {state === 'passed' ? (
              <Check className="w-3.5 h-3.5" strokeWidth={3} />
            ) : state === 'active' ? (
              <span className="block w-2 h-2 rounded-full bg-background animate-pulse" />
            ) : null}
            {cp.outOfWindow ? (
              <span
                aria-hidden
                className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 rounded-full bg-background border border-border grid place-items-center text-[8px] font-bold text-muted-foreground"
              >
                {cp.outOfWindow === 'before' ? '‹' : '›'}
              </span>
            ) : null}
          </button>
        );
      })}

      {/* Labels under each tick — name + weekday + date (or "ustaw datę" if
          tentative). Centered on tick x. Width caps prevent runaway in narrow
          zooms. Date is split into weekday badge + day.month so the calendar
          context is scannable at a glance ("śr 14.05" beats "14.05" alone).
          Time is appended only for stages whose checkpoint is a calendar slot
          (nagrywanie/obrobka) AND a real date was recorded — tentative dates
          deliberately skip the time noise. */}
      {checkpoints.map((cp) => {
        const state = milestoneState(cp.cat);
        const tentative = cp.source === 'tentative';
        const x = tickX(cp);
        const weekday = cp.date.toLocaleDateString('pl-PL', { weekday: 'short' });
        const dayMonth = cp.date.toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit' });
        const showTime = !tentative && cp.cat.withTime && cp.source !== 'tentative';
        const time = showTime
          ? cp.date.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })
          : null;
        const sourceHint =
          cp.source === 'derived' ? 'auto' : cp.source === 't0' ? 'T-0' : null;
        return (
          <div
            key={`label-${cp.cat.key}`}
            className="absolute pointer-events-none"
            style={{
              top: LABEL_TOP,
              left: `${x}%`,
              transform: 'translateX(-50%)',
              width: '7rem',
            }}
          >
            <div
              className={`text-[10px] uppercase tracking-[0.1em] font-semibold leading-tight truncate text-center ${
                state === 'active'
                  ? 'text-foreground'
                  : state === 'passed'
                    ? 'text-[var(--accent-blue)]'
                    : 'text-muted-foreground'
              }`}
              title={cp.cat.label}
            >
              {cp.cat.label}
            </div>
            {tentative ? (
              <div className="text-[10px] italic text-muted-foreground/60 text-center mt-0.5 leading-tight">
                ustaw datę
              </div>
            ) : (
              <div className="mt-0.5 flex items-baseline justify-center gap-1 leading-tight">
                <span
                  className={`text-[9px] uppercase tracking-[0.16em] font-semibold ${
                    state === 'active' || state === 'passed'
                      ? 'text-muted-foreground'
                      : 'text-muted-foreground/60'
                  }`}
                  title={cp.date.toLocaleDateString('pl-PL', { weekday: 'long' })}
                >
                  {weekday}
                </span>
                <span
                  className={`text-[11px] tabular-nums font-semibold ${
                    state === 'active'
                      ? 'text-foreground'
                      : state === 'passed'
                        ? 'text-[var(--accent-blue)]'
                        : 'text-muted-foreground'
                  }`}
                >
                  {dayMonth}
                </span>
                {time ? (
                  <span className="text-[10px] tabular-nums text-muted-foreground/80">
                    · {time}
                  </span>
                ) : null}
              </div>
            )}
            {sourceHint && !tentative ? (
              <div className="mt-0.5 flex justify-center">
                <span
                  className={`text-[8px] uppercase tracking-[0.16em] font-bold px-1 rounded ${
                    sourceHint === 'T-0'
                      ? 'bg-foreground text-background'
                      : 'bg-muted text-muted-foreground'
                  }`}
                  title={
                    sourceHint === 'T-0'
                      ? 'Dzień publikacji (T-0)'
                      : 'Auto: dzień po nagrywce'
                  }
                >
                  {sourceHint}
                </span>
              </div>
            ) : null}
          </div>
        );
      })}
    </>
  );
}

type CheckpointInfo = {
  cat: (typeof STAGE_CATEGORIES)[number];
  date: Date;
  source: MilestoneSource;
  dayIdx: number;
  outOfWindow: 'before' | 'after' | null;
  state: 'passed' | 'active' | 'pending';
};

/**
 * 9-step numbered sub-progress bar — positioned ABSOLUTELY in the timeline
 * coordinate system. Each step circle sits at its own calendar date (recorded
 * stepDate or default offset from T-0 Monday), so:
 *   • steps 1-3 (Outreach) cluster under the Outreach milestone, inside T1
 *   • steps 4-6 (Ustalenia) cluster under Ustalenia milestone, inside T1
 *   • step 7 (Nagrywanie) under Nagr milestone, inside T2
 *   • step 8 (Obróbka) under Mont milestone, inside T2
 *   • step 9 (Publikacja) under Pub milestone, at start of T3
 * The bar physically cannot exceed T1+T2+T3 width because no step has a
 * default offset outside that range.
 *
 * Click toggles the sub-stage status (auto-advances/regresses the production
 * status, which in turn auto-passes/un-passes the parent milestone via
 * categoryState in the main bar).
 */
type SubStepInfo = {
  /** kind discriminates canonical (linked to ProductionStatus) vs custom
   *  (user-added, identified by id). */
  kind: 'canonical' | 'custom';
  stage: ProductionStatus | null; // null for custom — they have no enum value
  customId: string | null;
  label: string;
  n: number; // dynamic 1..N display number
  cat: StageCategory;
  frame: WeekFrameCode;
  /** day offset from t0Mon — fractional for customs interpolated between
   *  canonical neighbours. */
  day: number;
  dayIdx: number;
  outOfWindow: 'before' | 'after' | null;
  /** For custom only: the doneAt timestamp from DB. */
  doneAt: string | null;
  /** For custom only: the canonical stage AFTER which it sits. */
  positionAfter: ProductionStatus | null;
  /** Resolved scheduling date for the step — drives the inline date chip
   *  rendered under the circle. Source is one of:
   *    recorded   — user typed it under the step on the production page
   *    derived    — auto-derived (editing = shooting + 1d)
   *    t0         — publishing always = t0At
   *    null       — no real date yet (don't render a date chip)
   *  Tentative-positioned canonicals are intentionally null here: their
   *  position alone communicates "default offset" and a fake DD.MM under
   *  every unset step would look like real dates the user agreed to. */
  date: Date | null;
  dateSource: 'recorded' | 'derived' | 't0' | null;
  /** Whether the parent stage carries time-of-day semantics (nagrywka,
   *  obróbka, ustalenia) — controls whether HH:mm is appended to the chip. */
  withTime: boolean;
};

function SubStepBar({
  productionId,
  subSteps,
  allSubSteps,
  dayWidthPct,
  status,
  cancelled,
  onChange,
  optimisticDoneByKey,
  setOptimisticDoneByKey,
}: {
  productionId: number;
  subSteps: SubStepInfo[];
  allSubSteps: SubStepInfo[];
  dayWidthPct: number;
  status: ProductionStatus;
  cancelled: boolean;
  onChange: (next: ProductionStatus) => void;
  optimisticDoneByKey: Record<string, boolean>;
  setOptimisticDoneByKey: (next: Record<string, boolean>) => void;
}) {
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const stepX = (s: SubStepInfo) => (s.dayIdx + 0.5) * dayWidthPct;

  const keyOf = (s: SubStepInfo) => subStepKey(s);

  // Single source of truth for "is this step done?" — optimistic override
  // (shared with PipelineMilestones via the lifted state) wins, then the
  // step's actual doneAt from row.steps. We deliberately do NOT consult the
  // derived ProductionStatus or the legacy positionAfter rule here: those
  // produced phantom-passed states (custom appears done because status
  // moved past its anchor canonical, even though its own doneAt is null)
  // which made unmark clicks invisible.
  const isDone = (s: SubStepInfo): boolean => {
    const k = keyOf(s);
    if (k in optimisticDoneByKey) return optimisticDoneByKey[k];
    return !!s.doneAt;
  };

  // Visual state: cascade-invariant by construction. The first step in
  // visual order whose isDone is false is the active one — everything
  // before it is passed (cascade-implied), everything after it is pending.
  // This guarantees we never render "step N+1 active while step N pending":
  // by definition the active step is the first non-done one, so all earlier
  // steps are done.
  const firstUndoneIdx = (() => {
    if (status === 'cancelled') return -1;
    for (let i = 0; i < allSubSteps.length; i++) {
      if (!isDone(allSubSteps[i])) return i;
    }
    return -1;
  })();

  const stateOf = (s: SubStepInfo): 'passed' | 'active' | 'pending' => {
    if (status === 'cancelled') return 'pending';
    const i = allSubSteps.findIndex((x) => keyOf(x) === keyOf(s));
    if (i < 0) return isDone(s) ? 'passed' : 'pending';
    if (firstUndoneIdx < 0) return 'passed';
    if (i < firstUndoneIdx) return 'passed';
    if (i === firstUndoneIdx) return 'active';
    return 'pending';
  };

  // Sequential cascade — clicking a step propagates state to all earlier steps
  // (mark) or all later steps (unmark). Steps must be completed in order:
  // step N can never be DONE while step N-1 is NOT DONE.
  //
  //   click NOT-DONE step → cascade-mark: target + everything before = DONE
  //   click DONE step     → cascade-unmark: target + everything after = NOT DONE
  //
  // Cascade math uses `allSubSteps` (full ordered list across all categories,
  // including out-of-window) so out-of-window steps participate in ordering
  // even though they're not rendered.
  const onStepClick = (s: SubStepInfo) => {
    if (cancelled) return;
    const idxInAll = allSubSteps.findIndex((x) => keyOf(x) === keyOf(s));
    if (idxInAll < 0) return;
    const isPassed = stateOf(s) === 'passed';
    const mode: 'mark' | 'unmark' = isPassed ? 'unmark' : 'mark';

    // Optimistic: every step in [0..lastDoneIdx] = done, rest = not.
    // Cover BOTH canonicals and customs so the cascade-invariant display
    // matches the in-flight server cascade — server-side cascadeStepsTo
    // operates on the same flat steps[] in the same visual order.
    const lastDoneIdx = mode === 'mark' ? idxInAll : idxInAll - 1;
    const nextOverrides: Record<string, boolean> = {};
    for (let i = 0; i < allSubSteps.length; i++) {
      nextOverrides[keyOf(allSubSteps[i])] = i <= lastDoneIdx;
    }
    setOptimisticDoneByKey(nextOverrides);

    // Optimistic: project new canonical status from cascade. Highest canonical
    // in [0..lastDoneIdx] determines status as one-past (next active), capped
    // at publishing.
    let highestCanonicalIdx = -1;
    for (let i = 0; i <= lastDoneIdx; i++) {
      const step = allSubSteps[i];
      if (step.kind === 'canonical' && step.stage) {
        const sIdx = STAGE_INDEX[step.stage];
        if (sIdx > highestCanonicalIdx) highestCanonicalIdx = sIdx;
      }
    }
    const nextStatus: ProductionStatus =
      highestCanonicalIdx < 0
        ? 'email-sent'
        : PRODUCTION_PROGRESSION[Math.min(highestCanonicalIdx + 1, PRODUCTION_PROGRESSION.length - 1)];
    onChange(nextStatus);

    // New cascade signature: each step has a unique id. Canonical steps use
    // their old ProductionStatus value as id; customs keep their original id.
    const stepId =
      s.kind === 'canonical' && s.stage ? (s.stage as string) : s.customId!;
    startTransition(() => {
      cascadeStepsTo(productionId, stepId, mode);
    });
  };

  if (subSteps.length === 0) return null;

  const sortedByX = [...subSteps].sort((a, b) => a.dayIdx - b.dayIdx);
  const firstX = stepX(sortedByX[0]);
  const lastX = stepX(sortedByX[sortedByX.length - 1]);
  const trackWidth = Math.max(0, lastX - firstX);

  // Progress fill stretches from the first step to the right-most passed step.
  const passedByX = sortedByX.filter((s) => stateOf(s) === 'passed');
  const lastPassedX = passedByX.length > 0 ? stepX(passedByX[passedByX.length - 1]) : firstX;
  const progressWidth = Math.max(0, lastPassedX - firstX);

  // Sit below the main milestone labels — at the very bottom of the row.
  const TRACK_TOP = '13.5rem';

  return (
    <>
      {/* Track (background) */}
      <div
        className="absolute h-[2px] rounded-full bg-border pointer-events-none"
        style={{ top: TRACK_TOP, left: `${firstX}%`, width: `${trackWidth}%`, transform: 'translateY(-50%)' }}
        aria-hidden
      />
      {/* Progress fill */}
      <div
        className="absolute h-[2px] rounded-full pointer-events-none transition-[width] duration-300 ease-out"
        style={{
          top: TRACK_TOP,
          left: `${firstX}%`,
          width: `${progressWidth}%`,
          transform: 'translateY(-50%)',
          background: 'linear-gradient(90deg, var(--accent-blue-soft) 0%, var(--accent-blue) 100%)',
        }}
        aria-hidden
      />

      {/* Per-step date chips were intentionally removed — the user-entered
          date now lives ONLY on the band-level pin (with full hover card).
          Replicating it under each step circle was redundant noise. */}

      {/* Step circles — canonical (numbered, large) and custom (numbered, smaller
          dashed border to telegraph it's a user insert) all in one ordered list. */}
      {subSteps.map((s) => {
        const state = stateOf(s);
        const k = keyOf(s);
        const isHovered = hoveredKey === k;
        const tone = FRAME_TONE[s.frame];
        const accentBorder =
          s.frame === 'T1'
            ? 'border-amber-400'
            : s.frame === 'T2'
              ? 'border-violet-400'
              : 'border-emerald-400';
        const x = stepX(s);
        const isCustom = s.kind === 'custom';

        const tooltipKindPrefix = isCustom ? `Krok ${s.n} (dodatkowy)` : `Krok ${s.n}`;
        const stateLabel =
          state === 'passed'
            ? '✓ zaliczone — klik cofa ten i wszystkie kolejne'
            : state === 'active'
              ? 'w trakcie — klik kończy ten i wszystkie poprzednie'
              : 'do zrobienia — klik kończy ten i wszystkie poprzednie';
        const tooltip = `${tooltipKindPrefix}: ${s.label} (${s.cat.label}) · ${stateLabel}`;

        const onClick = () => onStepClick(s);

        // Custom circles use slightly-thinner border + dashed outline when
        // pending, to telegraph "this is an inserted, user-defined step".
        const customRing = isCustom ? 'ring-1 ring-offset-1 ring-offset-background ring-foreground/15' : '';

        return (
          <button
            key={k}
            type="button"
            disabled={cancelled}
            onMouseEnter={() => setHoveredKey(k)}
            onMouseLeave={() => setHoveredKey(null)}
            onFocus={() => setHoveredKey(k)}
            onBlur={() => setHoveredKey(null)}
            onClick={onClick}
            aria-label={tooltip}
            aria-pressed={state === 'passed'}
            aria-current={state === 'active' ? 'step' : undefined}
            title={tooltip}
            style={{ top: TRACK_TOP, left: `${x}%`, transform: 'translate(-50%, -50%)' }}
            className={`absolute z-20 grid place-items-center rounded-full text-[11px] font-bold tabular-nums transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
              cancelled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
            } ${customRing} ${
              state === 'passed'
                ? `w-6 h-6 ${tone.passed} hover:scale-110 shadow-sm`
                : state === 'active'
                  ? `w-7 h-7 bg-foreground text-background ring-2 ring-offset-1 ring-offset-background scale-110 shadow`
                  : `w-6 h-6 bg-card border-2 ${isCustom ? 'border-dashed' : ''} ${accentBorder} text-muted-foreground hover:border-foreground/60 hover:scale-110`
            } ${isHovered && state !== 'active' ? 'ring-2 ring-foreground/20' : ''}`}
          >
            {s.n}
            {s.outOfWindow ? (
              <span
                aria-hidden
                className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-background border border-border grid place-items-center text-[7px] font-bold text-muted-foreground"
              >
                {s.outOfWindow === 'before' ? '‹' : '›'}
              </span>
            ) : null}
          </button>
        );
      })}

      {/* The bottom floating "active/hover step" label was intentionally
          removed — the band-level pin's hover card now carries the full
          step context (number, label, date, description). Keeping a parallel
          label under the sub-bar duplicated information and crowded the row. */}
    </>
  );
}

/**
 * Expanded row panel — shown below the row when the user clicks the chevron.
 * Mirrors the structure of the /productions/[id] page (T1/T2/T3 framed cards
 * with category sections, sub-stage buttons and date pickers) so the user gets
 * the same editing surface inline. Files / packages / posts are deliberately
 * skipped — for those the user opens the full production page via the CTA.
 */
function ExpandedDetails({
  row,
  currentStatus,
  tLabel,
}: {
  row: GanttRow;
  currentStatus: ProductionStatus;
  tLabel: string;
}) {
  const t0Label = row.t0At.toLocaleString('pl-PL', { dateStyle: 'medium', timeStyle: 'short' });
  const stepDates = row.stepDates ?? {};

  return (
    <div className="border-t border-border/60 bg-muted/20 py-6">
      {/* Sticky-anchored, container-bound width — the gantt strip is min-width
          1900+px and scrolls horizontally inside its overflow container. The
          scroll container is marked `container-type: inline-size`, so `cqw`
          units here resolve to its actual visible width (independent of the
          inner gantt min-width). Sticky pins the panel at left:1rem during
          horizontal scroll; width fills the scroll container minus 2rem on
          each side so T1/T2/T3 sit equally close to both edges. */}
      <div className="sticky left-4 w-[calc(100cqw-2rem)] space-y-6">
        {/* Header: title, T-0 chip + CTA to full production page */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-border/40">
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground font-bold">
              Szczegóły produkcji
            </div>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="text-base font-bold tracking-tight">{row.title}</span>
              <span className="text-xs text-muted-foreground tabular-nums">
                T-0: {t0Label}
              </span>
              <span className="px-1.5 py-0.5 rounded font-medium tabular-nums bg-foreground text-background text-[11px]">
                {tLabel}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <DeleteProductionButton
              productionId={row.id}
              productionName={row.artistName ?? row.title}
              redirectTo="/calendar"
            />
            <Link
              href={`/productions/${row.id}`}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-foreground text-background text-sm font-semibold hover:opacity-90 transition shadow-sm"
            >
              Otwórz pełną kartę
              <ExternalLink className="w-3.5 h-3.5" strokeWidth={2.5} />
            </Link>
          </div>
        </div>

        {/* T1 / T2 / T3 framed cards — same visual language as /productions/[id] */}
        <div className="space-y-5">
          {(() => {
            // Compute global step counter across categories so each step's
            // displayNumber matches its corresponding gantt sub-step circle.
            // Iterate categories in canonical order, accumulate sequence length.
            let stepOffset = 0;
            const offsetsByCat = new Map<string, number>();
            for (const cat of STAGE_CATEGORIES) {
              offsetsByCat.set(cat.key, stepOffset);
              const seq = resolveCategorySequence(
                cat.key,
                (row.customSteps ?? {})[cat.key] ?? [],
                (row.stepOrder ?? {})[cat.key],
              );
              stepOffset += seq.length;
            }
            return EXPANDED_FRAMES.map((frame) => {
              const weekCategories = STAGE_CATEGORIES.filter((c) => c.frame === frame.code);
              return (
                <div
                  key={frame.code}
                  className={`relative rounded-2xl border ${frame.border} ${frame.bg} p-4 sm:p-5 space-y-4`}
                >
                  <header className="flex items-center gap-2.5 px-1 flex-wrap">
                    <span
                      className={`inline-flex items-center justify-center min-w-[2rem] h-6 px-2 rounded-md text-[11px] font-bold tracking-[0.18em] tabular-nums ${frame.badge}`}
                    >
                      {frame.code}
                    </span>
                    <span
                      className={`text-[11px] uppercase tracking-[0.16em] font-semibold ${frame.accent}`}
                    >
                      {frame.label}
                    </span>
                    <span className="ml-auto text-[10px] uppercase tracking-[0.12em] text-muted-foreground tabular-nums">
                      tydzień {frame.code.replace('T', '')}
                    </span>
                  </header>

                  <div className="space-y-3">
                    {weekCategories.map((cat) => (
                      <ExpandedCategorySection
                        key={cat.key}
                        productionId={row.id}
                        productionT0At={row.t0At}
                        productionPeriods={row.periods}
                        category={cat}
                        steps={row.steps}
                        cancelled={row.cancelled}
                        startNumber={(offsetsByCat.get(cat.key) ?? 0) + 1}
                      />
                    ))}
                  </div>
                </div>
              );
            });
          })()}
        </div>

        {/* Footer hint — full editing surface lives on the production page */}
        <p className="text-[11px] text-muted-foreground italic px-1">
          Pliki, pakiety, posty i metryki znajdziesz na pełnej karcie produkcji.
        </p>
      </div>
    </div>
  );
}

function ExpandedCategorySection({
  productionId,
  productionT0At,
  productionPeriods,
  category,
  steps,
  cancelled,
  startNumber,
}: {
  productionId: number;
  productionT0At: Date;
  productionPeriods: import('../../../drizzle/schema').ProductionPeriods | null;
  category: StageCategory;
  steps: ProductionStep[];
  cancelled: boolean;
  /** 1-based global step number for the first item in this category — each
   *  subsequent item uses startNumber + seqIdx. Matches gantt sub-step n. */
  startNumber: number;
}) {
  const stepsInCat = steps.filter((s) => s.category === category.key);
  const passedCount = stepsInCat.filter((s) => !!s.doneAt).length;
  // First non-done step in the WHOLE production is the "active" one — used for
  // tone and the cascade indicator on the row.
  const firstActiveId = steps.find((s) => !s.doneAt)?.id ?? null;
  const groupTone =
    stepsInCat.length === 0
      ? 'pending'
      : passedCount === stepsInCat.length
        ? 'passed'
        : stepsInCat.some((s) => s.id === firstActiveId)
          ? 'active'
          : 'pending';

  return (
    <div
      className={`rounded-xl border bg-card overflow-hidden ${
        groupTone === 'active' ? 'border-foreground/40 shadow-sm' : 'border-border'
      }`}
    >
      <div className="px-4 py-3 border-b border-border flex items-center gap-3 flex-wrap bg-muted/30">
        <span
          className={`pill-label pill-label-sm ${
            groupTone === 'passed' ? 'pill-label-blue' : ''
          }`}
        >
          {category.label}
        </span>
        <span className="text-xs text-muted-foreground flex-1 min-w-0">
          {category.description}
        </span>
        <span className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground tabular-nums font-medium shrink-0">
          {passedCount}/{stepsInCat.length} kroków
        </span>
      </div>

      <div className="p-4 space-y-3">
        {stepsInCat.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-card/50 px-3 py-4 text-center text-[11px] text-muted-foreground">
            Brak kroków w tej kategorii.
          </div>
        ) : (
          stepsInCat.map((step, posInCat) => {
            const canMoveUp = posInCat > 0;
            const canMoveDown = posInCat < stepsInCat.length - 1;
            const state =
              step.doneAt
                ? 'passed'
                : step.id === firstActiveId
                  ? 'active'
                  : 'pending';
            return (
              <ProductionStepRow
                key={step.id}
                productionId={productionId}
                productionT0At={productionT0At}
                productionPeriods={productionPeriods}
                step={step}
                state={state as 'passed' | 'active' | 'pending'}
                displayNumber={startNumber + posInCat}
                canMoveUp={canMoveUp}
                canMoveDown={canMoveDown}
                productionCancelled={cancelled}
              />
            );
          })
        )}
        <div className="pt-1">
          <AddStepInline productionId={productionId} category={category.key} />
        </div>
      </div>
    </div>
  );
}

function LegendChip({ code, tone, label }: { code: string; tone: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className={`inline-block w-8 h-4 rounded border ${tone}`} />
      <span className="font-bold text-foreground text-sm">{code}</span>
      <span className="text-sm text-muted-foreground">{label}</span>
    </span>
  );
}

function LegendDot({ variant, label }: { variant: 'solid' | 'dashed'; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className={`inline-block w-3 h-3 rounded-full bg-card ${
          variant === 'dashed'
            ? 'border-2 border-dashed border-muted-foreground/60'
            : 'border-[3px] border-foreground'
        }`}
        aria-hidden
      />
      <span>{label}</span>
    </span>
  );
}
