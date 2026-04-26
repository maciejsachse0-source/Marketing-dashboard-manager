'use client';

import { useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { addDays, startOfWeek } from '@/lib/dates';
import type { CalendarEntry, CalendarType } from '../../../drizzle/schema';
import { Button } from '@/components/ui/button';
import { WeekView } from './week-view';
import { EntryDialog } from './entry-dialog';
import { TYPE_LABEL, TYPE_PILL } from './type-color';
import { CALENDAR_TYPES } from '../../../drizzle/schema';

function formatRange(weekStart: Date) {
  const end = addDays(weekStart, 6);
  const sameMonth = weekStart.getMonth() === end.getMonth();
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
  const startLabel = weekStart.toLocaleDateString('pl-PL', opts);
  const endLabel = end.toLocaleDateString('pl-PL', sameMonth ? { day: 'numeric' } : opts);
  return `${startLabel} – ${endLabel} ${end.getFullYear()}`;
}

export function CalendarShell({
  weekStart,
  entries,
}: {
  weekStart: Date;
  entries: CalendarEntry[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CalendarEntry | null>(null);
  const [filterType, setFilterType] = useState<CalendarType | 'all'>('all');

  const filtered = useMemo(
    () => (filterType === 'all' ? entries : entries.filter((e) => e.type === filterType)),
    [entries, filterType],
  );

  const navigate = (delta: number) => {
    const next = addDays(weekStart, delta * 7);
    const params = new URLSearchParams(searchParams);
    params.set('week', next.toISOString().slice(0, 10));
    router.push(`/calendar?${params.toString()}`);
  };

  const goToday = () => {
    const params = new URLSearchParams(searchParams);
    params.delete('week');
    router.push(`/calendar${params.toString() ? `?${params.toString()}` : ''}`);
  };

  const openCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => navigate(-1)}>
          ←
        </Button>
        <Button variant="outline" size="sm" onClick={goToday}>
          Dziś
        </Button>
        <Button variant="outline" size="sm" onClick={() => navigate(1)}>
          →
        </Button>
        <div className="text-sm font-medium px-2">{formatRange(weekStart)}</div>

        <div className="ml-auto flex items-center gap-2">
          <Link
            href="/agents/schedule-manager"
            className="text-xs px-3 py-1.5 rounded border border-border hover:border-foreground/40 transition"
          >
            Zaplanuj przez agenta
          </Link>
          <Button size="sm" onClick={openCreate}>
            + Dodaj wpis
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1 text-xs">
        <button
          type="button"
          onClick={() => setFilterType('all')}
          className={`px-2.5 py-1 rounded border transition ${
            filterType === 'all'
              ? 'border-foreground bg-foreground text-background'
              : 'border-border text-muted-foreground hover:border-foreground/40'
          }`}
        >
          Wszystko
        </button>
        {CALENDAR_TYPES.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setFilterType(t)}
            className={`px-2.5 py-1 rounded border transition ${
              filterType === t
                ? `${TYPE_PILL[t]} ring-1 ring-foreground/20`
                : 'border-border text-muted-foreground hover:border-foreground/40'
            }`}
          >
            {TYPE_LABEL[t]}
          </button>
        ))}
      </div>

      <WeekView
        weekStart={weekStart}
        entries={filtered}
        onEntryClick={(e) => {
          setEditing(e);
          setDialogOpen(true);
        }}
      />

      <EntryDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        entry={editing}
        defaultStart={weekStart}
      />
    </div>
  );
}

export { startOfWeek };
