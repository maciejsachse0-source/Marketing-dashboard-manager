import { and, gte, lte } from 'drizzle-orm';
import { PageShell } from '@/components/page-shell';
import { GanttView } from '@/components/calendar/gantt-view';
import { GanttToolbar } from '@/components/calendar/gantt-toolbar';
import { db, schema } from '@/lib/db';
import { addDays, endOfDay, startOfWeek } from '@/lib/dates';
import { listArtists } from '@/server/actions/artists';
import { listVideographers } from '@/server/actions/videographers';
import { loadTemplates } from '@/lib/production-templates';
import type { Production, ProductionStatus, ProductionType } from '../../../drizzle/schema';
import type { GanttRow } from '@/components/calendar/gantt-view';

export const dynamic = 'force-dynamic';

const ZOOM_OPTIONS = [5, 8, 12] as const;
type ZoomWeeks = (typeof ZOOM_OPTIONS)[number];

const STATUS_FILTERS = ['all', 'in-progress', 'done', 'cancelled'] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];

const TYPE_FILTERS = ['all', 'with-artist', 'solo'] as const;
type TypeFilter = (typeof TYPE_FILTERS)[number];

const SORT_OPTIONS = ['t0', 'status', 'name'] as const;
type SortKey = (typeof SORT_OPTIONS)[number];

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{
    week?: string;
    weeks?: string;
    status?: string;
    type?: string;
    sort?: string;
  }>;
}) {
  const sp = await searchParams;
  const weeksRaw = Number(sp.weeks);
  const zoom: ZoomWeeks = (ZOOM_OPTIONS as readonly number[]).includes(weeksRaw)
    ? (weeksRaw as ZoomWeeks)
    : 5;
  // Default window: shift back 1 week so all 3 bands (T1+T2+T3) of productions
  // with T-0 in the next ~7 days are visible. With T-0 = today + 7d, T1 sits at
  // today - 7..-1d, T2 at today..+6d, T3 at today+7..+13d. Starting 1 week back
  // (last Monday) puts T1 at strip-week-1, T2 at strip-week-2, T3 at strip-week-3.
  const baseDate = sp.week ? new Date(sp.week) : addDays(new Date(), -7);
  const weekStart = startOfWeek(baseDate);
  const rangeStart = weekStart;
  const rangeEnd = endOfDay(addDays(weekStart, zoom * 7 - 1));

  // Productions whose T-0 sits up to 3 weeks past the visible window — earlier
  // sub-stages (email-sent at T-21) still land inside the strip.
  const lookaheadEnd = endOfDay(addDays(weekStart, (zoom + 3) * 7 - 1));
  // Symmetrically: include productions whose T-0 was up to 3 weeks BEFORE the
  // visible window — later sub-stages (post-publish wraps) may still be active.
  const lookbehindStart = addDays(weekStart, -3 * 7);

  const productionsRaw = await db.query.productions.findMany({
    where: and(
      gte(schema.productions.t0At, lookbehindStart),
      lte(schema.productions.t0At, lookaheadEnd),
    ),
  });

  const statusFilter: StatusFilter = (STATUS_FILTERS as readonly string[]).includes(sp.status ?? '')
    ? (sp.status as StatusFilter)
    : 'all';
  const typeFilter: TypeFilter = (TYPE_FILTERS as readonly string[]).includes(sp.type ?? '')
    ? (sp.type as TypeFilter)
    : 'all';
  const sortKey: SortKey = (SORT_OPTIONS as readonly string[]).includes(sp.sort ?? '')
    ? (sp.sort as SortKey)
    : 't0';

  const [artists, videographers] = await Promise.all([listArtists(), listVideographers()]);
  const templates = loadTemplates();
  const artistById = new Map(artists.map((a) => [a.id, a]));
  const videographerById = new Map(videographers.map((v) => [v.id, v]));

  const productionsList: Production[] = productionsRaw.filter((p) => {
    if (typeFilter !== 'all' && p.type !== typeFilter) return false;
    if (statusFilter === 'cancelled') return p.status === 'cancelled';
    if (statusFilter === 'done') return p.status === 'publishing';
    if (statusFilter === 'in-progress') return p.status !== 'cancelled' && p.status !== 'publishing';
    return true;
  });

  const rows: GanttRow[] = productionsList.map((p) => {
    const artist = p.artistId ? artistById.get(p.artistId) ?? null : null;
    const videographer = p.videographerId
      ? videographerById.get(p.videographerId) ?? null
      : null;
    return {
      id: p.id,
      title: p.title,
      slug: p.slug,
      type: p.type as ProductionType,
      status: p.status as ProductionStatus,
      t0At: p.t0At,
      stepDates: p.stepDates ?? null,
      customSteps: p.customSteps ?? null,
      stepOrder: p.stepOrder ?? null,
      artistName: artist?.name ?? null,
      artistHandle: artist?.handle ?? null,
      videographerName: videographer?.name ?? null,
      platforms: p.platforms ?? null,
    };
  });

  const STATUS_RANK: Record<ProductionStatus, number> = {
    'email-sent': 0,
    'terms-accepted': 1,
    'cam-meeting-set': 2,
    'cam-date-shared': 3,
    'script-discussed': 4,
    'script-sent': 5,
    shooting: 6,
    editing: 7,
    publishing: 8,
    cancelled: 99,
  };

  rows.sort((a, b) => {
    if (sortKey === 'status') return STATUS_RANK[a.status] - STATUS_RANK[b.status] || a.t0At.getTime() - b.t0At.getTime();
    if (sortKey === 'name') {
      const an = a.artistName ?? a.title;
      const bn = b.artistName ?? b.title;
      return an.localeCompare(bn, 'pl');
    }
    return a.t0At.getTime() - b.t0At.getTime() || a.id - b.id;
  });

  const weeks = Array.from({ length: zoom }, (_, i) => addDays(weekStart, i * 7));
  const totalCount = productionsRaw.length;

  // Canvas stretch — every extra custom step adds horizontal pixels so circles
  // don't overlap when many steps are inserted in a tight calendar window.
  const maxCustomCount = rows.reduce((max, r) => {
    const cs = (r as { customSteps?: Record<string, unknown[]> | null }).customSteps;
    if (!cs) return max;
    let count = 0;
    for (const arr of Object.values(cs)) if (Array.isArray(arr)) count += arr.length;
    return Math.max(max, count);
  }, 0);
  // Min-width scales with zoom — 5 weeks fits in ~1400px (most of it on common
  // laptop viewports); 8 and 12 grow proportionally so each day column stays
  // legible. The 1400 floor is set so milestone labels (Outreach, Ustalenia z
  // kamerzystą, Nagrywanie, Obróbka, Publikacja) don't collide horizontally —
  // adjacent ticks (e.g. NAGRYWANIE Wed and OBROBKA Fri of T2) need ≥6.5rem of
  // breathing room each. Custom steps add extra pixels so sub-step circles
  // don't overlap when many are inserted in a tight calendar window.
  const baseMinWidth = zoom <= 5 ? 1400 : zoom <= 8 ? 1900 : 2500;
  const canvasMinWidth = baseMinWidth + maxCustomCount * 80;

  const artistOptions = artists.map((a) => ({ id: a.id, name: a.name, handle: a.handle }));
  const videographerOptions = videographers.map((v) => ({
    id: v.id,
    name: v.name,
    hourlyRate: v.hourlyRate,
  }));

  return (
    <PageShell
      title="Pipeline"
      eyebrow="Oś czasu"
      description="Każda produkcja jako wiersz na osi czasu. Pasy T1 (outreach + ustalenia), T2 (nagrywka + obróbka) i T3 (publikacja) ułożone wokół T-0. Klikaj kropki aby odhaczać kroki — wszystko synchronizuje się z kartą produkcji."
    >
      <GanttToolbar
        weekStart={weekStart}
        zoom={zoom}
        zoomOptions={ZOOM_OPTIONS as unknown as number[]}
        statusFilter={statusFilter}
        typeFilter={typeFilter}
        sortKey={sortKey}
        visibleCount={rows.length}
        totalCount={totalCount}
        artists={artistOptions}
        videographers={videographerOptions}
        templates={templates}
      />
      <GanttView weeks={weeks} rows={rows} minWidthPx={canvasMinWidth} />
    </PageShell>
  );
}
