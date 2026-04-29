'use client';

import { useTransition } from 'react';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { moveStepInCategory } from '@/server/actions/production-custom-steps';
import type { ProductionStage } from '../../../drizzle/schema';

/**
 * Hover-revealed ↑/↓ buttons used to reorder a single step within its
 * category's joint sequence. Used on:
 *  - canonical SubStageButton rows (passes `stepKey = ProductionStatus`)
 *  - CustomStepRow already has its own copy; both routes call the same
 *    server action so the behavior is identical.
 *
 * Disabled states are computed by the parent based on the joint sequence
 * position so the user can't move past a category boundary.
 */
export function MoveArrows({
  productionId,
  category,
  stepKey,
  canMoveUp,
  canMoveDown,
  className,
}: {
  productionId: number;
  category: ProductionStage;
  stepKey: string;
  canMoveUp: boolean;
  canMoveDown: boolean;
  className?: string;
}) {
  const [, startTransition] = useTransition();
  const onMove = (direction: 'up' | 'down') => {
    startTransition(() => {
      moveStepInCategory(productionId, category, stepKey, direction);
    });
  };
  return (
    <div className={`flex items-center gap-0.5 shrink-0 ${className ?? ''}`}>
      <button
        type="button"
        onClick={() => onMove('up')}
        disabled={!canMoveUp}
        className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition"
        aria-label="Przesuń w górę"
        title="Przesuń w górę"
      >
        <ArrowUp className="w-3.5 h-3.5" strokeWidth={2} />
      </button>
      <button
        type="button"
        onClick={() => onMove('down')}
        disabled={!canMoveDown}
        className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition"
        aria-label="Przesuń w dół"
        title="Przesuń w dół"
      >
        <ArrowDown className="w-3.5 h-3.5" strokeWidth={2} />
      </button>
    </div>
  );
}
