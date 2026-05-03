'use client';

import { useEffect, useState, useTransition } from 'react';
import { CalendarRange, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { shiftProductionT1Start } from '@/server/actions/production-steps';

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function toDateInputValue(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Always-visible date input for the production's T1 (first period) start.
 * Picking a new day fires `shiftProductionT1Start` immediately — t0At, every
 * step.dateIso, and every linked calendar entry move together by the same
 * Δdays.
 */
export function T1StartEditor({
  productionId,
  t1Start,
  disabled,
}: {
  productionId: number;
  t1Start: Date;
  disabled?: boolean;
}) {
  const initial = toDateInputValue(t1Start);
  const [value, setValue] = useState(initial);
  const [pending, startTransition] = useTransition();

  // Sync local input back to the server-rendered value after a successful
  // shift — otherwise stale draft would override the next render.
  useEffect(() => {
    setValue(initial);
  }, [initial]);

  const commit = (next: string) => {
    if (!next || next === initial) {
      setValue(initial);
      return;
    }
    const picked = new Date(`${next}T00:00:00`);
    if (Number.isNaN(picked.getTime())) {
      toast.error('Niepoprawna data');
      setValue(initial);
      return;
    }
    startTransition(async () => {
      const res = await shiftProductionT1Start(productionId, picked.toISOString());
      if (!res.ok) {
        toast.error('Nie udało się przesunąć', { description: res.error });
        setValue(initial);
        return;
      }
      toast.success('Timeline przesunięty');
    });
  };

  return (
    <label
      className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-background text-sm font-medium transition ${
        disabled
          ? 'opacity-50 cursor-not-allowed'
          : 'hover:border-foreground/40 focus-within:border-foreground/60 focus-within:ring-2 focus-within:ring-ring'
      }`}
    >
      <CalendarRange className="w-4 h-4 text-muted-foreground shrink-0" strokeWidth={1.75} />
      <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground font-semibold shrink-0">
        Start produkcji
      </span>
      <input
        type="date"
        value={value}
        disabled={disabled || pending}
        onChange={(e) => setValue(e.target.value)}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            (e.target as HTMLInputElement).blur();
          }
          if (e.key === 'Escape') {
            setValue(initial);
            (e.target as HTMLInputElement).blur();
          }
        }}
        className="bg-transparent text-sm font-semibold tabular-nums focus:outline-none disabled:cursor-not-allowed"
      />
      {pending ? (
        <Loader2 className="w-3.5 h-3.5 text-muted-foreground animate-spin shrink-0" />
      ) : null}
    </label>
  );
}
