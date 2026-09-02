/**
 * Model rozmieszczenia kroków produkcji wewnątrz pasm T1/T2/T3. Przeniesiony
 * bez zmiany treści z `gantt-view.tsx` w F2-02: to była pierwsza połowa
 * obliczeń funkcji `GanttRowView`.
 */
import { STATUS_LABEL as PROD_STATUS_LABEL } from '@/components/productions/status-pill';
import { startOfWeek as startOfWeekFn } from '@/lib/dates';
import { resolveCategorySequence } from '@/lib/category-sequence';
import { periodsRelativeToT0Mon } from '@/lib/production-periods';
import type { CustomStep, ProductionStatus } from '../../../drizzle/schema';
import { STAGE_CATEGORIES, type GanttRow, type StageCategory, type WeekFrameCode } from './gantt-geometry';

export type WorkItem = {
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

export function buildDraft(row: GanttRow): { t0MonForSteps: Date; draft: WorkItem[] } {

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


  return { t0MonForSteps, draft };
}
