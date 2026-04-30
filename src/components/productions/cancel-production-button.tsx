'use client';

import { useTransition } from 'react';
import { Ban, Undo2 } from 'lucide-react';
import { setProductionCancelled } from '@/server/actions/production-steps';

/**
 * Toggle a production's cancellation. Replaces the legacy "set status to
 * 'cancelled'" mutation. Sets/clears `productions.cancelledAt`.
 */
export function CancelProductionButton({
  productionId,
  cancelled,
}: {
  productionId: number;
  cancelled: boolean;
}) {
  const [pending, startTransition] = useTransition();

  const onClick = () => {
    if (cancelled) {
      if (!confirm('Wznowić produkcję?')) return;
    } else {
      if (!confirm('Anulować produkcję?\n\nKroki zostaną zachowane — można wznowić później.')) return;
    }
    startTransition(async () => {
      await setProductionCancelled(productionId, !cancelled);
    });
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition disabled:opacity-50 ${
        cancelled
          ? 'border-emerald-300 text-emerald-700 hover:bg-emerald-50'
          : 'border-rose-200 text-rose-700 hover:bg-rose-50 hover:border-rose-400'
      }`}
    >
      {cancelled ? (
        <>
          <Undo2 className="w-3.5 h-3.5" />
          Wznów
        </>
      ) : (
        <>
          <Ban className="w-3.5 h-3.5" />
          Anuluj produkcję
        </>
      )}
    </button>
  );
}
