'use client';

import { useTransition } from 'react';
import { ProductionStepTracker } from './production-step-tracker';
import { cascadeStepsTo } from '@/server/actions/production-steps';
import type { ProductionStep } from '../../../drizzle/schema';

/**
 * Thin wrapper that wires the click-on-tick handler to the cascade server
 * action. Kept separate so the tracker itself stays presentational and
 * easy to reuse (e.g. in production list cards).
 */
export function ProductionStepTrackerClient({
  productionId,
  steps,
  cancelled,
}: {
  productionId: number;
  steps: ProductionStep[];
  cancelled: boolean;
}) {
  const [, startTransition] = useTransition();

  const onCascadeTo = (stepId: string, mode: 'mark' | 'unmark') => {
    startTransition(() => {
      cascadeStepsTo(productionId, stepId, mode);
    });
  };

  return (
    <ProductionStepTracker
      steps={steps}
      cancelled={cancelled}
      onCascadeTo={onCascadeTo}
    />
  );
}
