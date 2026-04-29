'use client';

import Link from 'next/link';
import { useOptimistic, useState, useTransition } from 'react';
import { ArrowRight, Check, CheckCircle2, ChevronDown, ExternalLink } from 'lucide-react';
import { PersonAvatar, SoloAvatar, OrphanArtistAvatar } from '@/components/productions/artist-avatar';
import {
  ProductionTypeBadge,
  STATUS_LABEL as PROD_STATUS_LABEL,
} from '@/components/productions/status-pill';
import { SubStageButton } from '@/components/productions/sub-stage-button';
import { StageDatePicker } from '@/components/productions/stage-date-picker';
import { CustomStepRow } from '@/components/productions/custom-step-row';
import { CustomStepAddInline } from '@/components/productions/custom-step-add';
import { DeleteProductionButton } from '@/components/productions/delete-production-button';
import { setProductionStatus } from '@/server/actions/productions';
import { cascadeStepsTo } from '@/server/actions/production-custom-steps';
import { startOfWeek as startOfWeekFn } from '@/lib/dates';
import { STAGE_LABEL, STAGE_HINT } from '@/lib/production-stages';
import { resolveCategorySequence } from '@/lib/category-sequence';
import { FRAME_STYLE, type WeekFrame } from '@/lib/category-colors';
import { MoveArrows } from '@/components/productions/move-arrows';
import {
  PRODUCTION_PROGRESSION,
  type CustomStep,
  type Platform,
  type ProductionStage,
  type ProductionStatus,
  type ProductionType,
} from '../../../drizzle/schema';

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
    label: 'Ustalenia z kamerzystą',
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

const FRAME_TONE: Record<
  WeekFrameCode,
  { bg: string; border: string; ink: string; chip: string; passed: string; active: string; pending: string }
> = {
  T1: {
    bg: 'bg-amber-200/70',
    border: 'border-amber-500/70',
    ink: 'text-amber-950',
    chip: 'bg-amber-300/80 border-amber-500',
    passed: 'bg-amber-500 border-amber-600 text-white',
    active: 'bg-amber-50 border-amber-500 ring-4 ring-amber-300/50 text-amber-900',
    pending: 'bg-white border-amber-300 hover:border-amber-500 text-amber-700',
  },
  T2: {
    bg: 'bg-violet-200/70',
    border: 'border-violet-500/70',
    ink: 'text-violet-950',
    chip: 'bg-violet-300/80 border-violet-500',
    passed: 'bg-violet-500 border-violet-600 text-white',
    active: 'bg-violet-50 border-violet-500 ring-4 ring-violet-300/50 text-violet-900',
    pending: 'bg-white border-violet-300 hover:border-violet-500 text-violet-700',
  },
  T3: {
    bg: 'bg-emerald-200/70',
    border: 'border-emerald-500/70',
    ink: 'text-emerald-950',
    chip: 'bg-emerald-300/80 border-emerald-500',
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
  // its T-band even before the user records a real date.
  const t0Mon = startOfWeekFn(row.t0At);
  const offset = TENTATIVE_OFFSET_FROM_T0_MON[stage] ?? 0;
  const def = new Date(t0Mon);
  def.setDate(def.getDate() + offset);
  return { date: def, source: 'tentative' };
}

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
): { code: WeekFrameCode; startDay: number; endDay: number }[] {
  const t0Mon = startOfWeekFn(t0); // Monday of T-0's week
  const t3Start = Math.round(dayDiff(t0Mon, firstDay));
  const raw = [
    { code: 'T1' as WeekFrameCode, startDay: t3Start - 14, endDay: t3Start - 8 },
    { code: 'T2' as WeekFrameCode, startDay: t3Start - 7, endDay: t3Start - 1 },
    { code: 'T3' as WeekFrameCode, startDay: t3Start, endDay: t3Start + 6 },
  ];
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
          <div className="border-b border-border/60 px-5 py-3 text-xs uppercase tracking-[0.14em] text-muted-foreground font-semibold">
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
                    className={`px-3 py-2.5 border-l border-border/60 ${
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
                    className={`px-1 py-1.5 border-l text-center ${
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
          {rows.map((row) => (
            <GanttRowView
              key={row.id}
              row={row}
              firstDay={firstDay}
              totalDays={totalDays}
              dayWidthPct={dayWidthPct}
              days={days}
              todayIdx={todayIdx}
              todayInWindow={todayInWindow}
            />
          ))}
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
}: {
  row: GanttRow;
  firstDay: Date;
  totalDays: number;
  dayWidthPct: number;
  days: { isWeekend: boolean }[];
  todayIdx: number;
  todayInWindow: boolean;
}) {
  const [optimisticStatus, setOptimisticStatus] = useOptimistic(row.status);
  const [, startTransition] = useTransition();
  const [expanded, setExpanded] = useState(false);

  const setStatus = (next: ProductionStatus) => {
    startTransition(async () => {
      setOptimisticStatus(next);
      await setProductionStatus(row.id, next);
    });
  };

  // Per-category checkpoints (5 of them). Out-of-window checkpoints are
  // filtered — clipping them all to dayIdx=0 stacks ticks + labels on top of
  // each other for productions whose pipeline starts before/after the visible
  // strip (e.g. a published production where T-0 is days behind, so all
  // earlier-stage milestones land at the left edge). Same pattern as subSteps.
  const allCheckpoints = STAGE_CATEGORIES.map((cat) => {
    const { date, source } = resolveStageDate(cat.endStage, row);
    const rawIdx = dayDiff(date, firstDay);
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

  // T1/T2/T3 full-week bands anchored on T-0
  const frameBands = computeFrameBands(row.t0At, firstDay, totalDays);

  // Sub-stage pins — every EXPLICITLY recorded stepDate becomes a pin on its
  // band. Pins reflect what the user typed under each step on the production
  // page (or in the inline expanded panel). Auto-derived dates (editing =
  // shoot+1) and T-0 (publishing) are NOT pinned: editing already has its
  // milestone tick under T2, and the T3 band itself communicates the T-0 day.
  const stagePins: {
    stage: ProductionStatus;
    label: string;
    frame: WeekFrameCode;
    dayIdx: number;
    dateLabel: string;
  }[] = [];
  for (const cat of STAGE_CATEGORIES) {
    for (const stage of cat.subStages) {
      const isoDate = row.stepDates?.[stage];
      if (!isoDate) continue;
      const date = new Date(isoDate);
      const idx = dayDiff(date, firstDay);
      if (idx < 0 || idx >= totalDays) continue;
      stagePins.push({
        stage,
        label: PROD_STATUS_LABEL[stage],
        frame: cat.frame,
        dayIdx: idx,
        dateLabel: date.toLocaleDateString('pl-PL', { dateStyle: 'medium' }),
      });
    }
  }

  // Effective sub-step list — joint canonical + custom sequence per category,
  // resolved via `resolveCategorySequence` so a category that has been touched
  // by `moveStepInCategory` reads from its persisted `stepOrder` while
  // untouched categories fall back to legacy positionAfter ordering.
  const t0MonForSteps = startOfWeekFn(row.t0At);
  const customStepsByCat = row.customSteps ?? {};
  const stepOrderByCat = row.stepOrder ?? {};

  type Draft = {
    kind: 'canonical' | 'custom';
    stage: ProductionStatus | null;
    customId: string | null;
    label: string;
    positionAfter: ProductionStatus | null;
    cat: StageCategory;
    frame: WeekFrameCode;
    day: number;
    doneAt: string | null;
  };
  const draft: Draft[] = [];
  for (const cat of STAGE_CATEGORIES) {
    const allCustoms = (customStepsByCat[cat.key] ?? []) as CustomStep[];
    const storedOrder = stepOrderByCat[cat.key];
    const sequence = resolveCategorySequence(cat.key, allCustoms, storedOrder);
    if (sequence.length === 0) continue;

    // Day offsets per item in this category. Two modes:
    //  - Reordered (storedOrder set): redistribute evenly across the band's
    //    [first canonical, last canonical] TENTATIVE range so left-to-right in
    //    the gantt matches the user's chosen sequence.
    //  - Legacy: canonicals at TENTATIVE, customs interpolated between them.
    const offsets = cat.subStages.map((s) => TENTATIVE_OFFSET_FROM_T0_MON[s] ?? 0);
    const lo = Math.min(...offsets);
    const hi = Math.max(...offsets);
    const days = new Array<number>(sequence.length).fill(0);
    if (storedOrder && storedOrder.length > 0) {
      if (sequence.length === 1) {
        days[0] = (lo + hi) / 2;
      } else {
        const span = hi - lo;
        for (let k = 0; k < sequence.length; k++) {
          days[k] = lo + (k / (sequence.length - 1)) * span;
        }
      }
    } else {
      // Pass 1: canonicals
      sequence.forEach((it, k) => {
        if (it.kind === 'canonical') days[k] = TENTATIVE_OFFSET_FROM_T0_MON[it.stage] ?? 0;
      });
      // Pass 2: customs interpolated between adjacent canonicals
      let k = 0;
      while (k < sequence.length) {
        if (sequence[k].kind === 'custom') {
          let beforeIdx = k - 1;
          while (beforeIdx >= 0 && sequence[beforeIdx].kind !== 'canonical') beforeIdx--;
          let afterIdx = k;
          while (afterIdx < sequence.length && sequence[afterIdx].kind !== 'canonical') afterIdx++;
          const beforeDay = beforeIdx >= 0 ? days[beforeIdx] : afterIdx < sequence.length ? days[afterIdx] : lo;
          const afterDay = afterIdx < sequence.length ? days[afterIdx] : beforeDay + 1;
          const customCount = afterIdx - beforeIdx - 1;
          const gap = afterDay - beforeDay;
          let n = 1;
          for (let j = beforeIdx + 1; j < afterIdx; j++) {
            days[j] = beforeDay + (n / (customCount + 1)) * gap;
            n++;
          }
          k = afterIdx;
        } else {
          k++;
        }
      }
    }

    sequence.forEach((it, k) => {
      if (it.kind === 'canonical') {
        draft.push({
          kind: 'canonical',
          stage: it.stage,
          customId: null,
          label: PROD_STATUS_LABEL[it.stage],
          positionAfter: null,
          cat,
          frame: cat.frame,
          day: days[k],
          doneAt: null,
        });
      } else {
        draft.push({
          kind: 'custom',
          stage: null,
          customId: it.step.id,
          label: it.step.label,
          positionAfter: it.step.positionAfter ?? null,
          cat,
          frame: cat.frame,
          day: days[k],
          doneAt: it.step.doneAt,
        });
      }
    });
  }

  // 3) Compute dayIdx, clipping, numbering. Out-of-window steps get filtered.
  // Day-to-x: t0Mon's offset from firstDay is integer days; add the (possibly
  // fractional) `day` directly. Earlier we built a Date and used dayDiff +
  // fracDays, which dropped half a day on negative fractions (e.g. day=-12.5
  // resolved to rawIdx=0.5 when terms-accepted at day=-13 was rawIdx=1, so the
  // custom rendered LEFT of the canonical it should sit between).
  const t0MonOffset = dayDiff(t0MonForSteps, firstDay);
  const allSubSteps: SubStepInfo[] = draft.map((d, idx) => {
    const rawIdx = t0MonOffset + d.day;
    const clippedIdx = Math.max(0, Math.min(totalDays - 1, rawIdx));
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
    };
  });
  // Render only in-window steps. Stacking ticks at the same edge for past /
  // future productions is unreadable; skipping is cleaner.
  const subSteps = allSubSteps.filter((s) => s.outOfWindow == null);

  // Right column dynamic height — flat now (no vertical custom stacking).
  const rightColumnHeight = 16.5;

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

  // Next step indicator — first step that is NOT yet DONE (i.e., not 'passed').
  // With cascade semantics, status='editing' means steps 1..7 are done and step
  // 8 is the active "next to mark done". So the indicator must surface the
  // 'active' canonical, not skip it.
  const stepStateOf = (s: SubStepInfo): 'passed' | 'active' | 'pending' => {
    if (cancelled) return 'pending';
    if (s.kind === 'canonical' && s.stage) return subStageState(s.stage, optimisticStatus);
    if (s.kind === 'custom') {
      if (s.doneAt) return 'passed';
      if (s.positionAfter && STAGE_INDEX[optimisticStatus] > STAGE_INDEX[s.positionAfter]) return 'passed';
      return 'pending';
    }
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
    <div className="border-t border-border/40 hover:bg-muted/15 ui-transition group">
      <div
        className="grid gap-0"
        style={{ gridTemplateColumns: `22rem 1fr` }}
      >
        {/* LEFT: meta + progress bar */}
        <div className="px-5 py-4 flex flex-col gap-3 border-r border-border/40">
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
              {/* Next-step indicator — clean card that tells the user at a
                  glance "what's the next thing to mark done, and which
                  milestone does it live in?". Frame color is reduced to a thin
                  left rail + small dot so the focal point is the step name,
                  not the band. */}
              <NextStepIndicator
                cancelled={cancelled}
                allDone={allDone}
                nextStep={nextStep}
                totalSteps={totalStepCount}
              />
            </div>
          </div>

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
                className={`absolute top-0 bottom-0 ${tone.bg} pointer-events-none border-2 ${tone.border} rounded-md`}
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

          {/* Sub-stage pins — every recorded stepDate becomes a pin on its band.
              Positioned in the bands wrapper so they sit ON the colored area. */}
          {stagePins.map((pin) => {
            const tone = FRAME_TONE[pin.frame];
            const x = (pin.dayIdx + 0.5) * dayWidthPct;
            return (
              <div
                key={pin.stage}
                className="absolute top-0 bottom-0 z-10 pointer-events-auto"
                style={{ left: `${x}%`, transform: 'translateX(-50%)', width: '12px' }}
                title={`${pin.label} — ${pin.dateLabel}`}
              >
                {/* vertical pin shaft */}
                <span
                  className={`absolute top-2 bottom-2 left-1/2 -translate-x-1/2 w-px ${tone.passed.split(' ')[0]} opacity-60`}
                  aria-hidden
                />
                {/* pin head */}
                <span
                  className={`absolute top-0 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full border-2 border-card shadow-sm ${tone.passed.split(' ')[0]}`}
                  aria-hidden
                />
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
          const colourBorder =
            cat.frame === 'T1'
              ? 'border-amber-400/80'
              : cat.frame === 'T2'
                ? 'border-violet-400/80'
                : 'border-emerald-400/80';

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
                className={`absolute pointer-events-none border-l-2 ${colourBorder}`}
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
                        className={`absolute pointer-events-none border-l-2 border-dashed ${colourBorder}`}
                        style={{
                          top: JUNCTION_Y,
                          height: JUNCTION_TO_SUB_HEIGHT,
                          left: `${x}%`,
                          transform: 'translateX(-0.5px)',
                        }}
                      />
                      {/* connector (horizontal) — from this x to trunk x */}
                      <div
                        className={`absolute pointer-events-none border-t-2 border-dashed ${colourBorder}`}
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
  cancelled,
  allDone,
  nextStep,
  totalSteps,
}: {
  cancelled: boolean;
  allDone: boolean;
  nextStep: SubStepInfo | null;
  totalSteps: number;
}) {
  if (cancelled) {
    return (
      <div className="mt-2.5 flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50/70 px-2.5 py-1.5 animate-fade-in">
        <span className="grid place-items-center w-5 h-5 rounded-full bg-rose-500 text-white text-[10px] font-bold">
          ×
        </span>
        <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-rose-700">
          Anulowane
        </span>
      </div>
    );
  }
  if (allDone) {
    return (
      <div className="mt-2.5 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50/70 px-2.5 py-1.5 animate-scale-in">
        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" strokeWidth={2.5} />
        <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-emerald-800">
          Wszystkie kroki gotowe
        </span>
      </div>
    );
  }
  if (!nextStep) return null;

  // Frame-keyed accents — lifted from FRAME_TONE but applied as a left rail +
  // numbered dot rather than a full chip background. Keeps the indicator
  // visually quiet while still telegraphing the current band.
  const frameAccent = {
    T1: { rail: 'bg-amber-500', dot: 'bg-amber-500 text-white', ink: 'text-amber-950', faint: 'text-amber-700', glow: 'shadow-amber-200/60' },
    T2: { rail: 'bg-violet-500', dot: 'bg-violet-500 text-white', ink: 'text-violet-950', faint: 'text-violet-700', glow: 'shadow-violet-200/60' },
    T3: { rail: 'bg-emerald-500', dot: 'bg-emerald-500 text-white', ink: 'text-emerald-950', faint: 'text-emerald-700', glow: 'shadow-emerald-200/60' },
  }[nextStep.frame];

  return (
    <div
      key={`${nextStep.kind}:${nextStep.stage ?? nextStep.customId}`}
      className="mt-2.5 relative rounded-lg border border-border bg-card pl-3 pr-2.5 py-2 flex items-center gap-2.5 hover:border-foreground/30 hover:shadow-md hover:-translate-y-px ui-transition group/next animate-fade-up"
      title={`${nextStep.cat.label} · krok ${nextStep.n}/${totalSteps}: ${nextStep.label}`}
    >
      <span
        aria-hidden
        className={`absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-full ${frameAccent.rail} ui-transition group-hover/next:top-1 group-hover/next:bottom-1`}
      />
      <span
        className={`grid place-items-center w-7 h-7 rounded-full text-[11px] font-bold tabular-nums shrink-0 ${frameAccent.dot} shadow-sm ${frameAccent.glow} ui-transition group-hover/next:scale-105`}
      >
        {nextStep.n}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <span className="text-[9px] uppercase tracking-[0.14em] font-semibold text-muted-foreground">
            Następny krok
          </span>
          <span className="text-[9px] tabular-nums text-muted-foreground/70">
            {nextStep.n}/{totalSteps}
          </span>
        </div>
        <div className={`text-[12.5px] font-semibold leading-tight truncate ${frameAccent.ink}`}>
          {nextStep.label}
        </div>
        <div className={`text-[10px] leading-tight mt-0.5 truncate ${frameAccent.faint}`}>
          {nextStep.cat.label}
        </div>
      </div>
      <ArrowRight
        className={`w-3.5 h-3.5 shrink-0 ${frameAccent.faint} ui-transition group-hover/next:translate-x-0.5`}
        strokeWidth={2.25}
      />
    </div>
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
}: {
  productionId: number;
  checkpoints: CheckpointInfo[];
  allSubSteps: SubStepInfo[];
  dayWidthPct: number;
  status: ProductionStatus;
  cancelled: boolean;
  onChange: (next: ProductionStatus) => void;
}) {
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const [, startMilestoneTransition] = useTransition();

  // Sequential cascade — clicking a milestone marks ALL canonical sub-stages
  // up to and including that milestone's endStage as DONE (and all customs in
  // between), or unmarks the entire category if it's already passed. Mirrors
  // SubStepBar.onStepClick — single source of truth for "kroki po kolei".
  const onClickCategory = (cat: (typeof STAGE_CATEGORIES)[number]) => {
    if (cancelled) return;
    const state = categoryState(cat, status);
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
      cascadeStepsTo(productionId, { kind: 'canonical', stage: targetStage }, mode);
    });
  };

  const tickX = (cp: CheckpointInfo) => (cp.dayIdx + 0.5) * dayWidthPct;

  if (checkpoints.length === 0) return null;

  const sortedByX = [...checkpoints].sort((a, b) => a.dayIdx - b.dayIdx);
  const firstX = tickX(sortedByX[0]);
  const lastX = tickX(sortedByX[sortedByX.length - 1]);
  const trackWidth = Math.max(0, lastX - firstX);

  // Progress fill: stretch from first tick to the rightmost passed tick.
  const passedTicksByX = sortedByX.filter((cp) => categoryState(cp.cat, status) === 'passed');
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
        const state = categoryState(cp.cat, status);
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

      {/* Labels under each tick — name + date (or "ustaw datę" if tentative).
          Centered on tick x. Width caps prevent runaway in narrow zooms. */}
      {checkpoints.map((cp) => {
        const state = categoryState(cp.cat, status);
        const tentative = cp.source === 'tentative';
        const x = tickX(cp);
        const dateText = tentative
          ? 'ustaw datę'
          : cp.date.toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit' });
        return (
          <div
            key={`label-${cp.cat.key}`}
            className="absolute text-center pointer-events-none px-1"
            style={{
              top: LABEL_TOP,
              left: `${x}%`,
              transform: 'translateX(-50%)',
              width: '6.5rem',
            }}
          >
            <div
              className={`text-[10px] uppercase tracking-[0.1em] font-semibold leading-tight truncate ${
                state === 'active'
                  ? 'text-foreground'
                  : state === 'passed'
                    ? 'text-[var(--accent-blue)]'
                    : 'text-muted-foreground/70'
              }`}
              title={cp.cat.label}
            >
              {cp.cat.label}
            </div>
            <div
              className={`text-[10px] tabular-nums leading-tight mt-0.5 ${
                tentative ? 'italic text-muted-foreground/60' : 'text-muted-foreground'
              }`}
            >
              {dateText}
            </div>
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
};

function SubStepBar({
  productionId,
  subSteps,
  allSubSteps,
  dayWidthPct,
  status,
  cancelled,
  onChange,
}: {
  productionId: number;
  subSteps: SubStepInfo[];
  allSubSteps: SubStepInfo[];
  dayWidthPct: number;
  status: ProductionStatus;
  cancelled: boolean;
  onChange: (next: ProductionStatus) => void;
}) {
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const [optimisticCustomDone, setOptimisticCustomDone] = useState<Record<string, boolean>>({});
  const [, startTransition] = useTransition();

  const stepX = (s: SubStepInfo) => (s.dayIdx + 0.5) * dayWidthPct;

  // Effective done state for a custom step — local optimistic OR DB doneAt OR
  // status has progressed past its insertion point.
  const isCustomPassed = (s: SubStepInfo): boolean => {
    if (s.kind !== 'custom' || !s.customId) return false;
    const overrideKey = `${s.cat.key}:${s.customId}`;
    if (overrideKey in optimisticCustomDone) return optimisticCustomDone[overrideKey];
    if (s.doneAt) return true;
    if (s.positionAfter && STAGE_INDEX[status] > STAGE_INDEX[s.positionAfter]) return true;
    return false;
  };

  const stateOf = (s: SubStepInfo): 'passed' | 'active' | 'pending' => {
    if (s.kind === 'canonical' && s.stage) return subStageState(s.stage, status);
    if (s.kind === 'custom') return isCustomPassed(s) ? 'passed' : 'pending';
    return 'pending';
  };

  const keyOf = (s: SubStepInfo) => (s.kind === 'canonical' ? s.stage! : `c:${s.customId}`);

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

    // Optimistic: every custom in [0..lastDoneIdx] = done, rest = not.
    const lastDoneIdx = mode === 'mark' ? idxInAll : idxInAll - 1;
    const nextOverrides: Record<string, boolean> = {};
    for (let i = 0; i < allSubSteps.length; i++) {
      const step = allSubSteps[i];
      if (step.kind === 'custom' && step.customId) {
        const overrideKey = `${step.cat.key}:${step.customId}`;
        nextOverrides[overrideKey] = i <= lastDoneIdx;
      }
    }
    setOptimisticCustomDone(nextOverrides);

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

    const target =
      s.kind === 'canonical' && s.stage
        ? { kind: 'canonical' as const, stage: s.stage }
        : { kind: 'custom' as const, category: s.cat.key, stepId: s.customId! };
    startTransition(() => {
      cascadeStepsTo(productionId, target, mode);
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
  const LABEL_TOP = '14.5rem';

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

      {/* Active-step floating label — shows the active canonical step OR the
          hovered step (canonical or custom). */}
      {(() => {
        const hoveredStep = subSteps.find((s) => keyOf(s) === hoveredKey);
        const activeStep = subSteps.find((s) => stateOf(s) === 'active');
        const labelStep = hoveredStep ?? activeStep;
        if (!labelStep) return null;
        const x = stepX(labelStep);
        return (
          <div
            className="absolute z-10 text-center pointer-events-none whitespace-nowrap"
            style={{ top: LABEL_TOP, left: `${x}%`, transform: 'translateX(-50%)' }}
          >
            <span className="text-[10px] uppercase tracking-[0.1em] font-semibold text-foreground bg-card border border-border rounded-md px-2 py-0.5 shadow-sm">
              {labelStep.n}. {labelStep.label}
            </span>
          </div>
        );
      })()}
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
                        category={cat}
                        currentStatus={currentStatus}
                        stepDates={stepDates}
                        customSteps={(row.customSteps ?? {})[cat.key] ?? []}
                        storedOrder={(row.stepOrder ?? {})[cat.key]}
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
  category,
  currentStatus,
  stepDates,
  customSteps,
  storedOrder,
  startNumber,
}: {
  productionId: number;
  category: StageCategory;
  currentStatus: ProductionStatus;
  stepDates: Partial<Record<ProductionStatus, string>>;
  customSteps: CustomStep[];
  storedOrder: string[] | undefined;
  /** 1-based global step number for the first item in this category — each
   *  subsequent item uses startNumber + seqIdx. Matches gantt sub-step n. */
  startNumber: number;
}) {
  const states = category.subStages.map((s) => subStageState(s, currentStatus));
  const allPassed = states.every((s) => s === 'passed');
  const anyActive = states.includes('active');
  const groupTone = allPassed ? 'passed' : anyActive ? 'active' : 'pending';
  const passedCount = states.filter((s) => s === 'passed').length;
  const sequence = resolveCategorySequence(category.key, customSteps, storedOrder);

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
          {passedCount}/{category.subStages.length} kroków
        </span>
      </div>

      <div className="p-4 space-y-3">
        {sequence.map((item, seqIdx) => {
          const canMoveUp = seqIdx > 0;
          const canMoveDown = seqIdx < sequence.length - 1;
          if (item.kind === 'canonical') {
            const stage = item.stage;
            const stageIdx = category.subStages.indexOf(stage);
            const stepDateIso = stepDates[stage] ?? null;
            const derivedIso =
              stage === 'editing' && stepDates.shooting
                ? deriveEditingIso(stepDates.shooting)
                : null;
            return (
              <div key={`c:${stage}`} className="group space-y-1.5">
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <SubStageButton
                      productionId={productionId}
                      stage={stage}
                      label={STAGE_LABEL[stage]}
                      state={stageIdx >= 0 ? states[stageIdx] : 'pending'}
                      displayNumber={startNumber + seqIdx}
                    />
                  </div>
                  <MoveArrows
                    productionId={productionId}
                    category={category.key}
                    stepKey={stage}
                    canMoveUp={canMoveUp}
                    canMoveDown={canMoveDown}
                    className="opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition pt-1.5"
                  />
                </div>
                {STAGE_HINT[stage] ? (
                  <p className="pl-7 text-[11px] text-muted-foreground/80 italic">
                    {STAGE_HINT[stage]}
                  </p>
                ) : null}
                <StageDatePicker
                  productionId={productionId}
                  stage={stage}
                  mode={category.dateMode}
                  currentIso={stepDateIso}
                  derivedIso={derivedIso}
                  withTime={category.withTime}
                  label={category.dateLabel}
                />
              </div>
            );
          }
          return (
            <CustomStepRow
              key={`x:${item.step.id}`}
              productionId={productionId}
              category={category.key}
              step={item.step}
              canMoveUp={canMoveUp}
              canMoveDown={canMoveDown}
              displayNumber={startNumber + seqIdx}
            />
          );
        })}
        <div className="pt-1">
          <CustomStepAddInline
            productionId={productionId}
            category={category.key}
            canonicalStages={category.subStages}
          />
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
