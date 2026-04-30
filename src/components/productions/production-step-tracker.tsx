'use client';

import { useState } from 'react';
import { Check } from 'lucide-react';
import type { ProductionStage, ProductionStep } from '../../../drizzle/schema';

type WeekPhase = 'T1' | 'T2' | 'T3';

const CATEGORY_META: Record<
  ProductionStage,
  { label: string; week: WeekPhase }
> = {
  outreach: { label: 'Outreach', week: 'T1' },
  ustalenia: { label: 'Ustalenia + scenariusz', week: 'T1' },
  nagrywanie: { label: 'Nagrywanie', week: 'T2' },
  obrobka: { label: 'Obróbka', week: 'T2' },
  publikacja: { label: 'Publikacja', week: 'T3' },
};

const CATEGORY_ORDER: ProductionStage[] = [
  'outreach',
  'ustalenia',
  'nagrywanie',
  'obrobka',
  'publikacja',
];

const WEEK_FRAMES: { code: WeekPhase; span: number; tone: string; label: string }[] = [
  {
    code: 'T1',
    span: 2,
    tone: 'border-amber-300/70 bg-amber-50/60 text-amber-900',
    label: 'Outreach + ustalenia',
  },
  {
    code: 'T2',
    span: 2,
    tone: 'border-violet-300/70 bg-violet-50/60 text-violet-900',
    label: 'Nagrywka + obróbka',
  },
  {
    code: 'T3',
    span: 1,
    tone: 'border-emerald-300/70 bg-emerald-50/60 text-emerald-900',
    label: 'Publikacja',
  },
];

type CategoryState = 'passed' | 'active' | 'pending' | 'empty';

/** A category's state derived from its steps:
 *  - empty:   no steps in this category (template doesn't include it)
 *  - passed:  every step is done
 *  - active:  some done, some not — or some active in earlier categories
 *             but not yet here (still earliest pending)
 *  - pending: nothing done
 *
 * For the top-line tracker the user wants: which category is "currently being
 * worked on?" That's the FIRST category where not every step is done. */
function categoryStateFor(steps: ProductionStep[]): CategoryState {
  if (steps.length === 0) return 'empty';
  if (steps.every((s) => !!s.doneAt)) return 'passed';
  if (steps.some((s) => !!s.doneAt)) return 'active';
  return 'pending';
}

/**
 * Top-line pipeline progress strip — 5 ticks across the 3 weekly frames.
 * Replaces the legacy `StageTracker`. Reads `production.steps` directly.
 *
 * Click semantics: clicking a category jumps the cascade to the LAST step in
 * that category (mark) or the step BEFORE the first one (unmark) — consistent
 * with the old "click the tick = move production state forward to here".
 */
export function ProductionStepTracker({
  steps,
  cancelled,
  onCascadeTo,
}: {
  steps: ProductionStep[];
  cancelled: boolean;
  /** Optional cascade hook — when provided, clicking a category tick fires it
   *  with the target step id. Page-level wires it to `cascadeStepsTo`. */
  onCascadeTo?: (stepId: string, mode: 'mark' | 'unmark') => void;
}) {
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);

  // Compute per-category state once.
  const stateByCat = new Map<ProductionStage, CategoryState>();
  const stepsByCat = new Map<ProductionStage, ProductionStep[]>();
  for (const cat of CATEGORY_ORDER) {
    const inCat = steps.filter((s) => s.category === cat);
    stepsByCat.set(cat, inCat);
    stateByCat.set(cat, categoryStateFor(inCat));
  }

  // Find the "current" category — first non-passed, non-empty one.
  const activeCatKey = CATEGORY_ORDER.find((c) => {
    const st = stateByCat.get(c);
    return st === 'active' || st === 'pending';
  });

  const passedCount = CATEGORY_ORDER.filter(
    (c) => stateByCat.get(c) === 'passed',
  ).length;
  const totalNonEmpty = CATEGORY_ORDER.filter(
    (c) => stateByCat.get(c) !== 'empty',
  ).length;

  const hoveredCat = hoveredKey
    ? (hoveredKey as ProductionStage)
    : null;
  const labelCat = hoveredCat ?? activeCatKey ?? null;

  const onClickCategory = (cat: ProductionStage) => {
    if (!onCascadeTo) return;
    const st = stateByCat.get(cat);
    if (st === 'empty') return;
    const inCat = stepsByCat.get(cat) ?? [];
    if (st === 'passed') {
      // Unmark: target the FIRST step in this category — cascade-unmark
      // unmarks it + everything after, leaving the category pending.
      const first = inCat[0];
      if (first) onCascadeTo(first.id, 'unmark');
    } else {
      // Mark: target the LAST step in this category — cascade-mark marks
      // it + everything before, fully passing the category.
      const last = inCat[inCat.length - 1];
      if (last) onCascadeTo(last.id, 'mark');
    }
  };

  return (
    <div className="select-none">
      <div className="flex items-baseline justify-between gap-3 mb-3">
        <div className="flex items-baseline gap-2 min-w-0">
          <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground font-medium">
            {labelCat ? CATEGORY_META[labelCat].label : 'Pipeline'}
          </span>
          <span className="text-sm font-semibold tracking-tight truncate">
            {cancelled
              ? 'Produkcja anulowana'
              : labelCat
                ? `${stepsByCat.get(labelCat)?.filter((s) => s.doneAt).length ?? 0}/${stepsByCat.get(labelCat)?.length ?? 0} kroków`
                : 'Wszystko zrobione'}
          </span>
        </div>
        <span className="text-[11px] text-muted-foreground tabular-nums shrink-0">
          {passedCount}/{totalNonEmpty}
        </span>
      </div>

      <div className="grid grid-cols-5 gap-1.5 mb-2">
        {WEEK_FRAMES.map((frame) => (
          <div
            key={frame.code}
            className={`rounded-lg border ${frame.tone} px-2 py-1 flex items-center justify-center gap-1.5`}
            style={{ gridColumn: `span ${frame.span} / span ${frame.span}` }}
            title={frame.label}
          >
            <span className="text-[10px] font-bold tracking-[0.2em] tabular-nums">
              {frame.code}
            </span>
            <span className="text-[9px] uppercase tracking-[0.14em] font-medium opacity-70 truncate hidden sm:inline">
              {frame.label}
            </span>
          </div>
        ))}
      </div>

      <div className="relative grid grid-cols-5 items-center">
        <div
          className="absolute top-1/2 -translate-y-1/2 h-[3px] rounded-full bg-border/70 pointer-events-none"
          style={{ left: '10%', right: '10%' }}
        />
        <div
          className="absolute top-1/2 -translate-y-1/2 h-[3px] rounded-full pointer-events-none transition-[width] duration-300 ease-out"
          style={{
            left: '10%',
            width: `${(passedCount / Math.max(1, totalNonEmpty)) * 80}%`,
            background:
              'linear-gradient(90deg, var(--accent-blue-soft) 0%, var(--accent-blue) 100%)',
          }}
        />

        {CATEGORY_ORDER.map((cat) => {
          const state = stateByCat.get(cat) ?? 'empty';
          const isHovered = hoveredKey === cat;
          const isEmpty = state === 'empty';
          return (
            <div key={cat} className="grid place-items-center">
              <button
                type="button"
                onMouseEnter={() => setHoveredKey(cat)}
                onMouseLeave={() => setHoveredKey(null)}
                onFocus={() => setHoveredKey(cat)}
                onBlur={() => setHoveredKey(null)}
                onClick={() => onClickCategory(cat)}
                disabled={cancelled || isEmpty || !onCascadeTo}
                aria-label={`${CATEGORY_META[cat].label} (${state})`}
                aria-current={state === 'active' ? 'step' : undefined}
                className={`relative grid place-items-center rounded-full transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                  isEmpty
                    ? 'w-4 h-4 bg-muted border border-border cursor-not-allowed opacity-50'
                    : state === 'active'
                      ? 'w-7 h-7 bg-foreground text-background ring-4 ring-[var(--accent-blue)]/25 scale-105 cursor-pointer'
                      : state === 'passed'
                        ? 'w-6 h-6 bg-[var(--accent-blue)] text-white hover:scale-110 cursor-pointer'
                        : 'w-5 h-5 bg-background border-2 border-border hover:border-foreground/50 hover:scale-110 cursor-pointer'
                } ${isHovered && state !== 'active' && !isEmpty ? 'ring-4 ring-foreground/10' : ''} ${cancelled ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {state === 'passed' ? (
                  <Check className="w-3.5 h-3.5" strokeWidth={3} />
                ) : state === 'active' ? (
                  <span className="block w-2 h-2 rounded-full bg-background animate-pulse" />
                ) : null}
              </button>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-5 gap-0 mt-3">
        {CATEGORY_ORDER.map((cat) => {
          const state = stateByCat.get(cat) ?? 'empty';
          return (
            <div key={cat} className="text-center">
              <span
                className={`text-[10px] uppercase tracking-[0.12em] font-semibold ${
                  state === 'active'
                    ? 'text-foreground'
                    : state === 'passed'
                      ? 'text-[var(--accent-blue)]'
                      : state === 'empty'
                        ? 'text-muted-foreground/30'
                        : 'text-muted-foreground/60'
                }`}
              >
                {CATEGORY_META[cat].label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
