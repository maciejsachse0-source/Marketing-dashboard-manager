'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { addDays, startOfWeek } from '@/lib/dates';
import type { CalendarEntry, CalendarType, Production } from '../../../drizzle/schema';
import { Button } from '@/components/ui/button';
import { WeekView } from './week-view';
import { EntryDialog } from './entry-dialog';
import { TYPE_LABEL, TYPE_PILL, CONTENT_STATE_LABEL } from './type-color';
import { CALENDAR_TYPES } from '../../../drizzle/schema';
import { updateCalendarEntry } from '@/server/actions/calendar';
import { useShortcut } from '@/lib/use-shortcut';
import { ProductionDrawer } from '@/components/productions/production-drawer';
import { ProductionWizard } from '@/components/productions/production-wizard';
import type { ProductionTemplate } from '@/lib/templates';

function formatRange(weekStart: Date) {
  const end = addDays(weekStart, 6);
  const sameMonth = weekStart.getMonth() === end.getMonth();
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
  const startLabel = weekStart.toLocaleDateString('pl-PL', opts);
  const endLabel = end.toLocaleDateString('pl-PL', sameMonth ? { day: 'numeric' } : opts);
  return `${startLabel} – ${endLabel} ${end.getFullYear()}`;
}

type ArtistOption = { id: number; name: string; handle: string | null };
type VideographerOption = { id: number; name: string; hourlyRate: number | null };

export function CalendarShell({
  weekStart,
  entries,
  productions,
  templates,
  artists,
  videographers,
}: {
  weekStart: Date;
  entries: CalendarEntry[];
  productions: Record<number, Production>;
  templates: ProductionTemplate[];
  artists: ArtistOption[];
  videographers: VideographerOption[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [editing, setEditing] = useState<CalendarEntry | null>(null);
  const [drawerEntryId, setDrawerEntryId] = useState<number | null>(null);
  const [filterType, setFilterType] = useState<CalendarType | 'all'>('all');
  const [, startTransition] = useTransition();

  const onEntryClick = (entry: CalendarEntry) => {
    if (entry.productionId) {
      setDrawerEntryId(entry.id);
    } else {
      setEditing(entry);
      setDialogOpen(true);
    }
  };

  const onEntryDrop = (entryId: number, newStartsAt: Date) => {
    const entry = entries.find((e) => e.id === entryId);
    if (!entry) return;
    const duration = entry.endsAt.getTime() - entry.startsAt.getTime();
    const newEndsAt = new Date(newStartsAt.getTime() + duration);
    if (
      newStartsAt.getTime() === entry.startsAt.getTime() &&
      newEndsAt.getTime() === entry.endsAt.getTime()
    ) {
      return;
    }
    startTransition(async () => {
      try {
        await updateCalendarEntry({
          id: entryId,
          startsAt: newStartsAt.toISOString(),
          endsAt: newEndsAt.toISOString(),
        });
        toast.success(
          `Przeniesiono "${entry.title}" → ${newStartsAt.toLocaleString('pl-PL', {
            day: '2-digit',
            month: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
          })}`,
        );
        router.refresh();
      } catch (e) {
        toast.error('Nie udało się przenieść', {
          description: e instanceof Error ? e.message : String(e),
        });
      }
    });
  };

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

  useShortcut('n', () => openCreate(), []);
  useShortcut('p', () => setWizardOpen(true), []);

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
          <Button size="sm" variant="outline" onClick={openCreate}>
            + Wpis
          </Button>
          <Button size="sm" onClick={() => setWizardOpen(true)}>
            + Nowa produkcja
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-1">
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
        <div className="ml-auto flex items-center gap-2 text-[10px] text-muted-foreground">
          <LegendSwatch
            className="bg-emerald-500/8 border border-dashed border-emerald-500/50"
            label={CONTENT_STATE_LABEL['planned-empty']}
          />
          <LegendSwatch
            className="bg-emerald-500/35 border border-emerald-400 ring-1 ring-inset ring-emerald-300/40"
            label={CONTENT_STATE_LABEL['content-ready']}
          />
          <LegendSwatch
            className="bg-emerald-500/25 border border-emerald-500/70"
            label={CONTENT_STATE_LABEL.done}
          />
        </div>
      </div>

      <WeekView
        weekStart={weekStart}
        entries={filtered}
        productions={productions}
        onEntryClick={onEntryClick}
        onEntryDrop={onEntryDrop}
      />

      <EntryDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        entry={editing}
        defaultStart={weekStart}
      />

      <ProductionWizard
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        templates={templates}
        artists={artists}
        videographers={videographers}
        defaultStart={weekStart}
      />

      <ProductionDrawer
        entryId={drawerEntryId}
        open={drawerEntryId !== null}
        onClose={() => setDrawerEntryId(null)}
      />
    </div>
  );
}

function LegendSwatch({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`inline-block w-3 h-3 rounded-sm ${className}`} />
      {label}
    </span>
  );
}

export { startOfWeek };
