'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ChevronLeft, ChevronRight, Plus, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { addDays } from '@/lib/dates';
import { ProductionWizard } from '@/components/productions/production-wizard';
import { useShortcut } from '@/lib/use-shortcut';
import type { ProductionTemplate } from '@/lib/production-templates-types';

type ArtistOption = { id: number; name: string; handle: string | null };
type VideographerOption = { id: number; name: string; hourlyRate: number | null };

type StatusFilter = 'all' | 'in-progress' | 'done' | 'cancelled';
type TypeFilter = 'all' | 'with-artist' | 'solo';
type SortKey = 't0' | 'status' | 'name';
type ViewMode = 'week' | 'month' | 'quarter';

const STATUS_LABEL: Record<StatusFilter, string> = {
  all: 'Wszystkie',
  'in-progress': 'W trakcie',
  done: 'Opublikowane',
  cancelled: 'Anulowane',
};
const TYPE_LABEL: Record<TypeFilter, string> = {
  all: 'Wszystkie',
  'with-artist': 'Z artystą',
  solo: 'Solo',
};
const SORT_LABEL: Record<SortKey, string> = {
  t0: 'Data publikacji',
  status: 'Status',
  name: 'Nazwa',
};

const VIEW_LABEL: Record<ViewMode, string> = {
  week: 'Tydzień',
  month: 'Miesiąc',
  quarter: 'Kwartał',
};

// Zoom labels swap units depending on view mode — at quarter scale "tygodni"
// is awkward so we surface months/quarters instead.
function zoomLabel(view: ViewMode, weeks: number): string {
  if (view === 'quarter') {
    if (weeks === 52) return '1 rok';
    if (weeks === 39) return '9 mies';
    if (weeks === 26) return '6 mies';
  }
  if (view === 'month') {
    const months = Math.round(weeks / 4);
    return `${months} mies`;
  }
  return `${weeks} tyg`;
}

function formatRange(weekStart: Date, weeks: number) {
  const end = addDays(weekStart, weeks * 7 - 1);
  const sameYear = weekStart.getFullYear() === end.getFullYear();
  const startLabel = weekStart.toLocaleDateString('pl-PL', {
    day: 'numeric',
    month: 'short',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
  const endLabel = end.toLocaleDateString('pl-PL', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  return `${startLabel} – ${endLabel}`;
}

type CampaignOption = { id: number; name: string; inWindow: boolean };

export function GanttToolbar({
  weekStart,
  zoom,
  zoomOptions,
  view,
  viewOptions,
  statusFilter,
  typeFilter,
  sortKey,
  visibleCount,
  totalCount,
  artists,
  videographers,
  templates,
  campaignOptions,
  selectedCampaignId,
}: {
  weekStart: Date;
  zoom: number;
  zoomOptions: number[];
  view: ViewMode;
  viewOptions: string[];
  statusFilter: StatusFilter;
  typeFilter: TypeFilter;
  sortKey: SortKey;
  visibleCount: number;
  totalCount: number;
  artists: ArtistOption[];
  videographers: VideographerOption[];
  templates: ProductionTemplate[];
  campaignOptions: CampaignOption[];
  selectedCampaignId: number | null;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [wizardOpen, setWizardOpen] = useState(false);

  const setParam = (key: string, value: string | null) => {
    const params = new URLSearchParams(searchParams);
    if (value === null) params.delete(key);
    else params.set(key, value);
    const qs = params.toString();
    router.push(`/calendar${qs ? `?${qs}` : ''}`);
  };

  // Step size matches the visible window: in month/quarter views a 1-week
  // jump feels lost in the canvas, so we paginate by ~1/4 of the window.
  const stepWeeks = view === 'quarter' ? Math.max(4, Math.floor(zoom / 4))
    : view === 'month' ? Math.max(2, Math.floor(zoom / 4))
    : 1;
  const navigate = (delta: number) => {
    const next = addDays(weekStart, delta * stepWeeks * 7);
    // Use LOCAL Y-M-D, not toISOString(): toISOString returns UTC, so a Monday
    // 00:00 in CEST becomes "Sunday 22:00 UTC" → URL says yesterday → server
    // re-snaps to the same Monday → "next" button silently no-ops.
    const pad = (n: number) => String(n).padStart(2, '0');
    const local = `${next.getFullYear()}-${pad(next.getMonth() + 1)}-${pad(next.getDate())}`;
    setParam('week', local);
  };
  const goToday = () => setParam('week', null);

  // Switching view modes changes which zoom presets are valid — clearing
  // `weeks` lets the server pick that view's default. Without this, switching
  // from quarter (52) to week would land on an invalid 52-week week-view.
  const setView = (next: ViewMode) => {
    const params = new URLSearchParams(searchParams);
    params.set('view', next);
    params.delete('weeks');
    const qs = params.toString();
    router.push(`/calendar${qs ? `?${qs}` : ''}`);
  };

  useShortcut('p', () => setWizardOpen(true), []);

  const filtersActive =
    statusFilter !== 'all' || typeFilter !== 'all' || sortKey !== 't0';
  const resetFilters = () => {
    const params = new URLSearchParams(searchParams);
    params.delete('status');
    params.delete('type');
    params.delete('sort');
    const qs = params.toString();
    router.push(`/calendar${qs ? `?${qs}` : ''}`);
  };

  return (
    <div className="space-y-3.5 mb-6 animate-fade-up">
      {/* Row 1 — Navigation, range, count, action */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-lg border border-border bg-card overflow-hidden shadow-sm">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="px-3 py-2 hover:bg-muted/60 active:bg-muted ui-transition active:scale-[0.97]"
            aria-label={`Cofnij o ${stepWeeks} ${stepWeeks === 1 ? 'tydzień' : 'tygodni'}`}
            title={`Cofnij o ${stepWeeks} ${stepWeeks === 1 ? 'tydzień' : 'tygodni'}`}
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={goToday}
            className="px-4 py-2 text-sm font-semibold border-x border-border hover:bg-muted/60 active:bg-muted ui-transition active:scale-[0.97]"
            title="Wróć do dziś"
          >
            Dziś
          </button>
          <button
            type="button"
            onClick={() => navigate(1)}
            className="px-3 py-2 hover:bg-muted/60 active:bg-muted ui-transition active:scale-[0.97]"
            aria-label={`Naprzód o ${stepWeeks} ${stepWeeks === 1 ? 'tydzień' : 'tygodni'}`}
            title={`Naprzód o ${stepWeeks} ${stepWeeks === 1 ? 'tydzień' : 'tygodni'}`}
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        <div className="flex flex-col leading-tight min-w-0">
          <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground font-bold">
            Widoczny zakres
          </span>
          <span className="text-sm font-bold tabular-nums truncate">
            {formatRange(weekStart, zoom)}
          </span>
        </div>

        <div className="ml-auto flex items-center gap-3">
          <span className="text-sm text-muted-foreground tabular-nums font-medium hidden sm:inline">
            <span className="font-bold text-foreground">{visibleCount}</span>
            {visibleCount !== totalCount ? (
              <span> / {totalCount}</span>
            ) : null}{' '}
            produkcji
          </span>
          <Button size="default" onClick={() => setWizardOpen(true)}>
            <Plus className="w-4 h-4 mr-1.5" /> Nowa produkcja
          </Button>
        </div>
      </div>

      {/* Row 2 — View controls (mode + zoom) + filters + sort */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
        <SegmentedControl
          label="Widok"
          current={view}
          options={viewOptions as ViewMode[]}
          getKey={(v) => v}
          getLabel={(v) => VIEW_LABEL[v]}
          onChange={(v) => setView(v)}
        />

        <SegmentedControl
          label="Zoom"
          current={zoom}
          options={zoomOptions}
          getKey={(z) => String(z)}
          getLabel={(z) => zoomLabel(view, z)}
          onChange={(z) => setParam('weeks', String(z))}
        />

        <span className="hidden md:block h-5 w-px bg-border" aria-hidden />

        <SegmentedControl
          label="Status"
          current={statusFilter}
          options={['all', 'in-progress', 'done', 'cancelled'] as StatusFilter[]}
          getKey={(o) => o}
          getLabel={(o) => STATUS_LABEL[o]}
          onChange={(v) => setParam('status', v === 'all' ? null : v)}
        />
        <SegmentedControl
          label="Typ"
          current={typeFilter}
          options={['all', 'with-artist', 'solo'] as TypeFilter[]}
          getKey={(o) => o}
          getLabel={(o) => TYPE_LABEL[o]}
          onChange={(v) => setParam('type', v === 'all' ? null : v)}
        />
        <SegmentedControl
          label="Sortuj"
          current={sortKey}
          options={['t0', 'status', 'name'] as SortKey[]}
          getKey={(o) => o}
          getLabel={(o) => SORT_LABEL[o]}
          onChange={(v) => setParam('sort', v === 't0' ? null : v)}
        />

        <CampaignSelector
          options={campaignOptions}
          selectedId={selectedCampaignId}
          onChange={(id) =>
            setParam('campaign', id === null ? 'none' : String(id))
          }
        />

        {filtersActive ? (
          <button
            type="button"
            onClick={resetFilters}
            className="ml-auto inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition"
            title="Wyczyść filtry"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Wyczyść filtry
          </button>
        ) : null}
      </div>

      <ProductionWizard
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        artists={artists}
        videographers={videographers}
        templates={templates}
        defaultStart={weekStart}
      />
    </div>
  );
}

function SegmentedControl<T>({
  label,
  current,
  options,
  getKey,
  getLabel,
  onChange,
}: {
  label: string;
  current: T;
  options: T[];
  getKey: (o: T) => string;
  getLabel: (o: T) => string;
  onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex items-center gap-2">
      <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground font-bold">
        {label}
      </span>
      <div className="inline-flex rounded-md border border-border bg-card overflow-hidden shadow-sm">
        {options.map((o) => {
          const selected = getKey(o) === getKey(current);
          return (
            <button
              key={getKey(o)}
              type="button"
              onClick={() => onChange(o)}
              className={`px-2.5 py-1 text-xs font-semibold ui-transition active:scale-[0.96] ${
                selected
                  ? 'bg-foreground text-background shadow-inner'
                  : 'hover:bg-muted/60 text-muted-foreground hover:text-foreground'
              }`}
              aria-pressed={selected}
            >
              {getLabel(o)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Campaign picker — only ONE campaign renders in the gantt narrative strip
 * at a time, so the user must explicitly choose which one. We use a native
 * `<select>` instead of a segmented control because campaign names can be
 * long and the number of campaigns grows linearly while T1/T2/T3 toolbar
 * controls stay short. Campaigns outside the visible window get an annotation
 * so the user knows why selecting them shows the off-window edge preview.
 */
function CampaignSelector({
  options,
  selectedId,
  onChange,
}: {
  options: CampaignOption[];
  selectedId: number | null;
  onChange: (id: number | null) => void;
}) {
  const value = selectedId === null ? 'none' : String(selectedId);
  return (
    <div className="inline-flex items-center gap-2">
      <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground font-bold">
        Kampania
      </span>
      <select
        value={value}
        onChange={(e) => {
          const v = e.target.value;
          onChange(v === 'none' ? null : Number(v));
        }}
        className="rounded-md border border-border bg-card px-2.5 py-1 text-xs font-semibold shadow-sm hover:bg-muted/40 focus:outline-none focus:ring-2 focus:ring-ring max-w-[16rem] truncate"
        title="Wybierz kampanię, której narracja ma się wyświetlać w gancie"
      >
        <option value="none">— brak —</option>
        {options.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
            {c.inWindow ? '' : ' (poza oknem)'}
          </option>
        ))}
      </select>
    </div>
  );
}
