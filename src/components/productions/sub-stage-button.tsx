'use client';

import { useOptimistic, useTransition } from 'react';
import { Check, Circle } from 'lucide-react';
import { setProductionStatus } from '@/server/actions/productions';
import type { ProductionStatus } from '../../../drizzle/schema';

export function SubStageButton({
  productionId,
  stage,
  label,
  state,
}: {
  productionId: number;
  stage: ProductionStatus;
  label: string;
  state: 'passed' | 'active' | 'pending';
}) {
  const [optimisticState, setOptimisticState] = useOptimistic(state);
  const [pending, startTransition] = useTransition();

  const onClick = () => {
    startTransition(async () => {
      // Toggle: if passed → regress to one before; otherwise advance to this stage.
      setOptimisticState(optimisticState === 'passed' ? 'pending' : 'active');
      await setProductionStatus(productionId, stage);
    });
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className={`group flex items-center gap-2.5 w-full text-left px-3 py-2 rounded-xl border transition ${
        optimisticState === 'active'
          ? 'border-foreground bg-foreground text-background'
          : optimisticState === 'passed'
            ? 'border-[var(--accent-blue)]/30 bg-[var(--accent-blue-tint)] hover:border-[var(--accent-blue)]/60'
            : 'border-border bg-card hover:border-foreground/40'
      } ${pending ? 'opacity-60 pointer-events-none' : ''}`}
    >
      {optimisticState === 'passed' ? (
        <span className="w-4 h-4 rounded-full bg-[var(--accent-blue)] grid place-items-center text-white shrink-0">
          <Check className="w-2.5 h-2.5" strokeWidth={3} />
        </span>
      ) : optimisticState === 'active' ? (
        <span className="w-4 h-4 rounded-full bg-background grid place-items-center text-foreground shrink-0">
          <span className="block w-1.5 h-1.5 rounded-full bg-foreground animate-pulse" />
        </span>
      ) : (
        <Circle className="w-4 h-4 text-muted-foreground/60 shrink-0" strokeWidth={1.75} />
      )}
      <span
        className={`text-sm font-medium ${
          optimisticState === 'active'
            ? 'text-background'
            : optimisticState === 'passed'
              ? 'text-foreground'
              : 'text-muted-foreground group-hover:text-foreground'
        }`}
      >
        {label}
      </span>
      <span
        className={`ml-auto text-[10px] uppercase tracking-[0.12em] font-semibold ${
          optimisticState === 'active'
            ? 'text-background/80'
            : optimisticState === 'passed'
              ? 'text-[var(--accent-blue)]'
              : 'text-muted-foreground/60'
        }`}
      >
        {optimisticState === 'active' ? 'w trakcie' : optimisticState === 'passed' ? 'zaliczone' : ''}
      </span>
    </button>
  );
}
