'use client';

import { useState, useTransition } from 'react';
import { Calendar, CalendarPlus, Trash2, Lock } from 'lucide-react';
import { setStageDate } from '@/server/actions/production-step-dates';
import type { ProductionStatus } from '../../../drizzle/schema';

type Mode = 'record' | 'calendar' | 'derived' | 'none';

function toLocalInputValue(d: Date): string {
  // datetime-local expects YYYY-MM-DDTHH:mm without timezone
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatDate(d: Date, withTime: boolean): string {
  return withTime
    ? d.toLocaleString('pl-PL', { dateStyle: 'medium', timeStyle: 'short' })
    : d.toLocaleDateString('pl-PL', { dateStyle: 'medium' });
}

export function StageDatePicker({
  productionId,
  stage,
  mode,
  currentIso,
  derivedIso,
  withTime = true,
  label,
}: {
  productionId: number;
  stage: ProductionStatus;
  mode: Mode;
  currentIso: string | null;
  derivedIso?: string | null;
  withTime?: boolean;
  label: string;
}) {
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (mode === 'none') return null;

  if (mode === 'derived') {
    const date = derivedIso ? new Date(derivedIso) : null;
    return (
      <div className="pl-7 inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <Lock className="w-3 h-3" />
        <span className="italic">{label}:</span>
        <span className="font-medium tabular-nums">
          {date ? formatDate(date, withTime) : 'czeka na datę nagrań'}
        </span>
      </div>
    );
  }

  const date = currentIso ? new Date(currentIso) : null;

  const save = (iso: string | null) => {
    setError(null);
    startTransition(async () => {
      const res = await setStageDate(productionId, stage, iso);
      if (!res.ok) {
        setError(res.error);
      } else {
        setEditing(false);
      }
    });
  };

  // Compact view — show date or CTA. Click to expand to input.
  if (!editing) {
    return (
      <div className="pl-7">
        <button
          type="button"
          onClick={() => setEditing(true)}
          className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[11px] font-medium transition ${
            date
              ? 'bg-[var(--accent-blue-tint)] text-[var(--accent-blue)] hover:bg-[var(--accent-blue-soft)]/40'
              : 'border border-dashed border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground'
          }`}
        >
          {date ? <Calendar className="w-3 h-3" /> : <CalendarPlus className="w-3 h-3" />}
          <span className="italic">{label}:</span>
          <span className="not-italic font-medium tabular-nums">
            {date ? formatDate(date, withTime) : 'wpisz'}
          </span>
        </button>
        {mode === 'calendar' && date ? (
          <span className="ml-2 text-[10px] uppercase tracking-[0.12em] text-[var(--accent-blue)] font-semibold">
            · w kalendarzu
          </span>
        ) : null}
      </div>
    );
  }

  // Edit view — input + save/cancel/clear
  return (
    <div className="pl-7 flex items-center gap-2 flex-wrap">
      <span className="text-[11px] italic text-muted-foreground">{label}:</span>
      <input
        type={withTime ? 'datetime-local' : 'date'}
        defaultValue={date ? toLocalInputValue(date) : ''}
        autoFocus
        disabled={pending}
        onBlur={(e) => {
          const v = e.target.value;
          if (!v) {
            setEditing(false);
            return;
          }
          const iso = new Date(v).toISOString();
          if (iso !== currentIso) save(iso);
          else setEditing(false);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setEditing(false);
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        }}
        className="px-2 py-1 rounded-md border border-border bg-background text-[11px] font-medium tabular-nums focus:outline-none focus:ring-2 focus:ring-ring"
      />
      {date ? (
        <button
          type="button"
          onClick={() => save(null)}
          disabled={pending}
          className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-destructive transition"
          title="Usuń datę"
        >
          <Trash2 className="w-3 h-3" />
          wyczyść
        </button>
      ) : null}
      {error ? <span className="text-[11px] text-destructive">{error}</span> : null}
    </div>
  );
}
