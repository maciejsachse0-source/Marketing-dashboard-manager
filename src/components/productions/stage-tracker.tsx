'use client';

import { useOptimistic, useTransition, useState } from 'react';
import { Check } from 'lucide-react';
import { setProductionStatus } from '@/server/actions/productions';
import {
  PRODUCTION_PROGRESSION,
  type ProductionStatus,
} from '../../../drizzle/schema';

import { STAGE_LABEL } from '@/lib/production-stages';

type WeekPhase = 'T1' | 'T2' | 'T3';

type Category = {
  key: string;
  label: string;
  /** Last status in this category — clicking this tick sets production here. */
  endStage: ProductionStatus;
  stages: ProductionStatus[];
  /** Pipeline week this category belongs to. Same key in kanban-view. */
  week: WeekPhase;
};

const CATEGORIES: Category[] = [
  {
    key: 'outreach',
    label: 'Outreach',
    endStage: 'cam-meeting-set',
    stages: ['email-sent', 'terms-accepted', 'cam-meeting-set'],
    week: 'T1',
  },
  {
    key: 'ustalenia',
    label: 'Ustalenia z kamerzystą',
    endStage: 'script-sent',
    stages: ['cam-date-shared', 'script-discussed', 'script-sent'],
    week: 'T1',
  },
  { key: 'nagrywanie', label: 'Nagrywanie', endStage: 'shooting', stages: ['shooting'], week: 'T2' },
  { key: 'obrobka', label: 'Obróbka', endStage: 'editing', stages: ['editing'], week: 'T2' },
  { key: 'publikacja', label: 'Publikacja', endStage: 'publishing', stages: ['publishing'], week: 'T3' },
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

const STAGE_INDEX: Record<ProductionStatus, number> = Object.fromEntries(
  PRODUCTION_PROGRESSION.map((s, i) => [s, i]),
) as Record<ProductionStatus, number>;

function categoryState(cat: Category, status: ProductionStatus): 'passed' | 'active' | 'pending' {
  if (status === 'cancelled') return 'pending';
  const cur = STAGE_INDEX[status];
  const endIdx = STAGE_INDEX[cat.endStage];
  const startIdx = STAGE_INDEX[cat.stages[0]];
  if (cur >= endIdx) return 'passed';
  if (cur >= startIdx) return 'active';
  return 'pending';
}

export function StageTracker({
  productionId,
  status,
}: {
  productionId: number;
  status: ProductionStatus;
}) {
  const [optimisticStatus, setOptimisticStatus] = useOptimistic(status);
  const [, startTransition] = useTransition();
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);

  const passedCount = CATEGORIES.filter((c) => categoryState(c, optimisticStatus) === 'passed').length;
  const fillPct = (passedCount / CATEGORIES.length) * 100;

  const onClickCategory = (cat: Category) => {
    const state = categoryState(cat, optimisticStatus);
    // Toggle: if already passed, regress to the stage right BEFORE this category;
    // otherwise advance to its end stage.
    let next: ProductionStatus;
    if (state === 'passed') {
      const startIdx = STAGE_INDEX[cat.stages[0]];
      next = startIdx === 0 ? 'email-sent' : PRODUCTION_PROGRESSION[startIdx - 1];
    } else {
      next = cat.endStage;
    }
    startTransition(async () => {
      setOptimisticStatus(next);
      await setProductionStatus(productionId, next);
    });
  };

  const hoveredCat = CATEGORIES.find((c) => c.key === hoveredKey);
  const activeCat = CATEGORIES.find((c) => categoryState(c, optimisticStatus) === 'active');
  const labelCat = hoveredCat ?? activeCat;
  const detailedStatusLabel = STAGE_LABEL[optimisticStatus] ?? optimisticStatus;

  return (
    <div className="select-none">
      {/* Header */}
      <div className="flex items-baseline justify-between gap-3 mb-3">
        <div className="flex items-baseline gap-2 min-w-0">
          <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground font-medium">
            {labelCat?.label ?? 'Pipeline'}
          </span>
          <span className="text-sm font-semibold tracking-tight truncate">
            {hoveredCat ? hoveredCat.label : detailedStatusLabel}
          </span>
        </div>
        <span className="text-[11px] text-muted-foreground tabular-nums shrink-0">
          {passedCount}/{CATEGORIES.length}
        </span>
      </div>

      {/* T1 / T2 / T3 weekly frames — same week-buckets as the kanban */}
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

      {/* Track + ticks — aligned to the 5-col grid above */}
      <div className="relative grid grid-cols-5 items-center">
        <div
          className="absolute top-1/2 -translate-y-1/2 h-[3px] rounded-full bg-border/70 pointer-events-none"
          style={{ left: '10%', right: '10%' }}
        />
        <div
          className="absolute top-1/2 -translate-y-1/2 h-[3px] rounded-full pointer-events-none transition-[width] duration-300 ease-out"
          style={{
            left: '10%',
            width: `${(passedCount / CATEGORIES.length) * 80}%`,
            background: 'linear-gradient(90deg, var(--accent-blue-soft) 0%, var(--accent-blue) 100%)',
          }}
        />

        {CATEGORIES.map((cat) => {
          const state = categoryState(cat, optimisticStatus);
          const isHovered = hoveredKey === cat.key;
          return (
            <div key={cat.key} className="grid place-items-center">
              <button
                type="button"
                onMouseEnter={() => setHoveredKey(cat.key)}
                onMouseLeave={() => setHoveredKey(null)}
                onFocus={() => setHoveredKey(cat.key)}
                onBlur={() => setHoveredKey(null)}
                onClick={() => onClickCategory(cat)}
                aria-label={`${cat.label} (${state === 'passed' ? 'zaliczone' : state === 'active' ? 'w trakcie' : 'nie zaliczone'})`}
                aria-current={state === 'active' ? 'step' : undefined}
                className={`relative grid place-items-center rounded-full transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                  state === 'active'
                    ? 'w-7 h-7 bg-foreground text-background ring-4 ring-[var(--accent-blue)]/25 scale-105'
                    : state === 'passed'
                      ? 'w-6 h-6 bg-[var(--accent-blue)] text-white hover:scale-110'
                      : 'w-5 h-5 bg-background border-2 border-border hover:border-foreground/50 hover:scale-110'
                } ${isHovered && state !== 'active' ? 'ring-4 ring-foreground/10' : ''}`}
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

      {/* Category labels under the bar */}
      <div className="grid grid-cols-5 gap-0 mt-3">
        {CATEGORIES.map((cat) => {
          const state = categoryState(cat, optimisticStatus);
          return (
            <div key={cat.key} className="text-center">
              <span
                className={`text-[10px] uppercase tracking-[0.12em] font-semibold ${
                  state === 'active'
                    ? 'text-foreground'
                    : state === 'passed'
                      ? 'text-[var(--accent-blue)]'
                      : 'text-muted-foreground/60'
                }`}
              >
                {cat.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
