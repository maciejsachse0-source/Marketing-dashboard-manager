'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight, Plus, CalendarPlus, Bot } from 'lucide-react';
import { addDays, startOfWeek } from '@/lib/dates';
import type { CalendarEntry, CalendarType, Production } from '../../../drizzle/schema';
import { Button } from '@/components/ui/button';
import { WeekView } from './week-view';
import { EntryDialog } from './entry-dialog';
import { TYPE_LABEL, TYPE_PILL, CONTENT_STATE_LABEL, LEGEND_SWATCH } from './type-color';
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
      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-md border border-border overflow-hidden">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="px-2 py-1.5 hover:bg-muted/60 transition"
            aria-label="Poprzedni tydzień"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={goToday}
            className="px-3 py-1.5 text-xs font-medium border-x border-border hover:bg-muted/60 transition"
          >
            Dziś
          </button>
          <button
            type="button"
            onClick={() => navigate(1)}
            className="px-2 py-1.5 hover:bg-muted/60 transition"
            aria-label="Następny tydzień"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        <div className="text-sm font-semibold tabular-nums">{formatRange(weekStart)}</div>

        <div className="ml-auto flex items-center gap-2">
          <Link
            href="/agents/schedule-manager"
            className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border border-border hover:bg-muted/40 hover:border-foreground/30 transition"
          >
            <Bot className="w-3.5 h-3.5" /> Zaplanuj przez agenta
          </Link>
          <Button size="sm" variant="outline" onClick={openCreate}>
            <CalendarPlus className="w-4 h-4 mr-1" /> Wpis
          </Button>
          <Button size="sm" onClick={() => setWizardOpen(true)}>
            <Plus className="w-4 h-4 mr-1" /> Nowa produkcja
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-1">
          <button
            type="button"
            onClick={() => setFilterType('all')}
            className={`px-2.5 py-1 rounded-md border transition ${
              filterType === 'all'
                ? 'border-foreground bg-foreground text-background'
                : 'border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground'
            }`}
          >
            Wszystko
          </button>
          {CALENDAR_TYPES.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setFilterType(t)}
              className={`px-2.5 py-1 rounded-md border transition ${
                filterType === t
                  ? `${TYPE_PILL[t]} ring-1 ring-foreground/30`
                  : 'border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground'
              }`}
            >
              {TYPE_LABEL[t]}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
          <LegendSwatch
            className={LEGEND_SWATCH['planned-empty']}
            label={CONTENT_STATE_LABEL['planned-empty']}
          />
          <LegendSwatch
            className={LEGEND_SWATCH['content-ready']}
            label={CONTENT_STATE_LABEL['content-ready']}
          />
          <LegendSwatch
            className={LEGEND_SWATCH.done}
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
      <span className={`inline-block w-3.5 h-3.5 rounded ${className}`} />
      {label}
    </span>
  );
}

export { startOfWeek };
