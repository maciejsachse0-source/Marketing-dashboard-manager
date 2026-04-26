'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { setProductionStatus } from '@/server/actions/productions';
import {
  PRODUCTION_PROGRESSION,
  type ProductionStatus,
} from '../../../drizzle/schema';
import { STATUS_LABEL } from './status-pill';

export function ProductionStatusButtons({
  id,
  current,
}: {
  id: number;
  current: ProductionStatus;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const change = (next: ProductionStatus) => {
    if (next === current) return;
    startTransition(async () => {
      try {
        await setProductionStatus(id, next);
        toast.success(`Status: ${STATUS_LABEL[next]}`);
        router.refresh();
      } catch (e) {
        toast.error('Nie udało się zmienić statusu', {
          description: e instanceof Error ? e.message : String(e),
        });
      }
    });
  };

  if (current === 'cancelled') {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Anulowane.</span>
        <Button size="sm" variant="outline" onClick={() => change('idea')} disabled={pending}>
          Wznów
        </Button>
      </div>
    );
  }

  const idx = PRODUCTION_PROGRESSION.indexOf(current);
  const prev = idx > 0 ? PRODUCTION_PROGRESSION[idx - 1] : null;
  const next = idx >= 0 && idx < PRODUCTION_PROGRESSION.length - 1 ? PRODUCTION_PROGRESSION[idx + 1] : null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs text-muted-foreground mr-1">Workflow:</span>
      {prev ? (
        <Button size="sm" variant="outline" onClick={() => change(prev)} disabled={pending}>
          ← {STATUS_LABEL[prev]}
        </Button>
      ) : null}
      {next ? (
        <Button size="sm" onClick={() => change(next)} disabled={pending}>
          {STATUS_LABEL[next]} →
        </Button>
      ) : null}
      <Button
        size="sm"
        variant="ghost"
        onClick={() => change('cancelled')}
        disabled={pending}
        className="ml-auto text-rose-600 hover:text-rose-700"
      >
        Anuluj produkcję
      </Button>
    </div>
  );
}

export function ProductionStatusPicker({
  id,
  current,
}: {
  id: number;
  current: ProductionStatus;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const change = (next: ProductionStatus) => {
    if (next === current) return;
    startTransition(async () => {
      try {
        await setProductionStatus(id, next);
        toast.success(`Status: ${STATUS_LABEL[next]}`);
        router.refresh();
      } catch (e) {
        toast.error('Błąd', {
          description: e instanceof Error ? e.message : String(e),
        });
      }
    });
  };

  return (
    <details className="group">
      <summary className="text-xs text-muted-foreground hover:text-foreground cursor-pointer list-none inline-flex items-center gap-1">
        Skok do dowolnego statusu ▾
      </summary>
      <div className="mt-2 flex flex-wrap gap-1">
        {PRODUCTION_PROGRESSION.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => change(s)}
            disabled={pending || s === current}
            className={`px-2 py-1 rounded border text-[10px] transition ${
              s === current
                ? 'border-foreground bg-foreground text-background'
                : 'border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground'
            }`}
          >
            {STATUS_LABEL[s]}
          </button>
        ))}
      </div>
    </details>
  );
}
