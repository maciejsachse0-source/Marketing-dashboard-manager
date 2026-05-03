import { and, gte, lte } from 'drizzle-orm';
import { PageShell } from '@/components/page-shell';
import { GanttView } from '@/components/calendar/gantt-view';
import { GanttTableView } from '@/components/calendar/gantt-table-view';
import { GanttToolbar } from '@/components/calendar/gantt-toolbar';
import type { GanttNarrativeCampaign } from '@/components/campaigns/gantt-narrative-row';
import { resolvePeriods } from '@/lib/production-periods';
import { db, schema } from '@/lib/db';
import { addDays, endOfDay, startOfWeek } from '@/lib/dates';
import { listArtists } from '@/server/actions/artists';
import { listVideographers } from '@/server/actions/videographers';
import { loadTemplates } from '@/lib/production-templates';
import { isProductionDone } from '@/lib/production-steps';
import type {
  CustomStep,
  Production,
  ProductionStage,
  ProductionStatus,
  ProductionStep,
  ProductionType,
} from '../../../drizzle/schema';
import { PRODUCTION_PROGRESSION } from '../../../drizzle/schema';
import type { GanttRow } from '@/components/calendar/gantt-view';

const CANONICAL_STAGE_SET = new Set<string>(PRODUCTION_PROGRESSION);

/** Synthesize the legacy GanttRow shape from a production's `steps[]` so the
 *  gantt — which still renders against that shape internally — keeps working
 *  during the cleanup window. After Phase 6 the gantt switches to consuming
 *  steps directly and this adapter goes away. */
function buildLegacyShape(steps: ProductionStep[]): {
  status: ProductionStatus;
  stepDates: Partial<Record<ProductionStatus, string>>;
  customSteps: Partial<Record<ProductionStage, CustomStep[]>>;
  stepOrder: Partial<Record<ProductionStage, string[]>>;
} {
  // Status = id of the first canonical step that's not done. If every canonical
  // is already done (regardless of customs), the pipeline has reached the
  // terminal 'publishing' stage — falling back to 'email-sent' here would make
  // a near-complete production look as if it were starting over and would
  // break the visual cascade (later canonicals would render pending while
  // their custom doneAts mark them as done).
  const canonicalSteps = steps.filter((s) => CANONICAL_STAGE_SET.has(s.id));
  const firstUndoneCanonical = canonicalSteps.find((s) => !s.doneAt);
  let status: ProductionStatus;
  if (firstUndoneCanonical) {
    status = firstUndoneCanonical.id as ProductionStatus;
  } else if (canonicalSteps.length > 0) {
    status = 'publishing';
  } else {
    status = 'email-sent';
  }

  const stepDates: Partial<Record<ProductionStatus, string>> = {};
  const customSteps: Partial<Record<ProductionStage, CustomStep[]>> = {};
  const stepOrder: Partial<Record<ProductionStage, string[]>> = {};

  for (const s of steps) {
    const cat = s.category;
    if (!stepOrder[cat]) stepOrder[cat] = [];
    stepOrder[cat]!.push(s.id);

    if (CANONICAL_STAGE_SET.has(s.id)) {
      if (s.dateIso) stepDates[s.id as ProductionStatus] = s.dateIso;
    } else {
      if (!customSteps[cat]) customSteps[cat] = [];
      const cs: CustomStep = {
        id: s.id,
        label: s.label,
        doneAt: s.doneAt,
      };
      // Anchor every custom to the first canonical of its category so the
      // legacy `positionAfter`-driven sequence falls back gracefully if the
      // gantt ignores stepOrder.
      const canonicalsInCat = steps.filter(
        (x) => x.category === cat && CANONICAL_STAGE_SET.has(x.id),
      );
      if (canonicalsInCat[0]) {
        cs.positionAfter = canonicalsInCat[0].id as ProductionStatus;
      }
      if (s.description) cs.description = s.description;
      if (s.attachmentPath) cs.attachmentPath = s.attachmentPath;
      if (s.attachmentName) cs.attachmentName = s.attachmentName;
      if (s.attachmentSize !== undefined) cs.attachmentSize = s.attachmentSize;
      customSteps[cat]!.push(cs);
    }
  }

  return { status, stepDates, customSteps, stepOrder };
}

export const dynamic = 'force-dynamic';

// View mode determines how wide a window we render and what the header
// granularity looks like. `week` keeps the day-level grid (current behavior);
// `month` and `quarter` zoom out further and progressively collapse the
// per-day strip into week/month-only headers so the gantt stays readable
// at long horizons. Step placement still uses day-level percentages — only
// the header chrome changes.
const VIEW_MODES = ['week', 'month', 'quarter'] as const;
type ViewMode = (typeof VIEW_MODES)[number];

const ZOOM_OPTIONS_BY_VIEW: Record<ViewMode, readonly number[]> = {
  week: [5, 8, 12],
  month: [12, 16, 20],
  quarter: [26, 39, 52],
};
const DEFAULT_ZOOM_BY_VIEW: Record<ViewMode, number> = {
  week: 5,
  month: 16,
  quarter: 26,
};
type HeaderDensity = 'days' | 'weeks' | 'months';
const DENSITY_BY_VIEW: Record<ViewMode, HeaderDensity> = {
  week: 'days',
  month: 'weeks',
  quarter: 'months',
};

const STATUS_FILTERS = ['all', 'in-progress', 'done', 'cancelled'] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];

const TYPE_FILTERS = ['all', 'with-artist', 'solo'] as const;
type TypeFilter = (typeof TYPE_FILTERS)[number];

const SORT_OPTIONS = ['t0', 'status', 'name'] as const;
type SortKey = (typeof SORT_OPTIONS)[number];

const DISPLAY_MODES = ['gantt', 'table'] as const;
type DisplayMode = (typeof DISPLAY_MODES)[number];

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{
    week?: string;
    weeks?: string;
    view?: string;
    mode?: string;
    status?: string;
    type?: string;
    sort?: string;
    campaign?: string;
  }>;
}) {
  const sp = await searchParams;
  const view: ViewMode = (VIEW_MODES as readonly string[]).includes(sp.view ?? '')
    ? (sp.view as ViewMode)
    : 'week';
  const zoomOptions = ZOOM_OPTIONS_BY_VIEW[view];
  const weeksRaw = Number(sp.weeks);
  const zoom: number = (zoomOptions as readonly number[]).includes(weeksRaw)
    ? weeksRaw
    : DEFAULT_ZOOM_BY_VIEW[view];
  const headerDensity = DENSITY_BY_VIEW[view];
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

  // Campaigns whose narrative arc overlaps the wider lookbehind/lookahead
  // window. We intentionally use the wider window (not the strict visible
  // [rangeStart, rangeEnd]) so a campaign whose kickoff is just past the
  // visible edge still surfaces — the gantt-narrative-row renders an
  // off-window preview chip strip in that case so the user always sees
  // Build-up / Reveal / Premiera / Afterglow plus the start date.
  //
  // Only ONE campaign is rendered in the gantt at a time — the narrative
  // strip would otherwise stack into a wall of bands and crowd out the
  // production rows. The user picks which one through the toolbar selector;
  // selection is persisted in the `campaign` search param.
  const campaignsAll = await db.query.campaigns.findMany({
    orderBy: schema.campaigns.releaseAt,
  });
  const overlappingCampaigns = campaignsAll
    .map((c) => {
      const resolved = resolvePeriods(c.periods);
      const lastEnd = Math.max(0, ...resolved.map((p) => p.endOffsetDays));
      const arcEnd = new Date(c.releaseAt);
      arcEnd.setDate(arcEnd.getDate() + lastEnd);
      return { c, arcEnd };
    })
    .filter(({ c, arcEnd }) => arcEnd >= lookbehindStart && c.releaseAt <= lookaheadEnd)
    .map(({ c }) => c);

  const campaignOptions = campaignsAll.map((c) => ({
    id: c.id,
    name: c.name,
    inWindow: overlappingCampaigns.some((o) => o.id === c.id),
  }));

  // Selection: explicit `none` hides the strip entirely; an explicit id picks
  // that campaign even if it's outside the window (so the user can pin a
  // campaign and scroll to it). Default = first overlapping campaign so the
  // strip stays useful out-of-the-box.
  const rawCampaignParam = sp.campaign ?? '';
  let selectedCampaignId: number | null;
  if (rawCampaignParam === 'none') {
    selectedCampaignId = null;
  } else if (rawCampaignParam && Number.isFinite(Number(rawCampaignParam))) {
    selectedCampaignId = Number(rawCampaignParam);
  } else {
    selectedCampaignId = overlappingCampaigns[0]?.id ?? null;
  }

  const selectedCampaign =
    selectedCampaignId != null
      ? campaignsAll.find((c) => c.id === selectedCampaignId) ?? null
      : null;

  const narrativeCampaigns: GanttNarrativeCampaign[] = selectedCampaign
    ? [
        {
          id: selectedCampaign.id,
          name: selectedCampaign.name,
          kickoffAt: selectedCampaign.releaseAt,
          periods: selectedCampaign.periods,
          goal: selectedCampaign.goal,
          phase: selectedCampaign.phase,
          notes: selectedCampaign.notes,
        },
      ]
    : [];

  const statusFilter: StatusFilter = (STATUS_FILTERS as readonly string[]).includes(sp.status ?? '')
    ? (sp.status as StatusFilter)
    : 'all';
  const typeFilter: TypeFilter = (TYPE_FILTERS as readonly string[]).includes(sp.type ?? '')
    ? (sp.type as TypeFilter)
    : 'all';
  const sortKey: SortKey = (SORT_OPTIONS as readonly string[]).includes(sp.sort ?? '')
    ? (sp.sort as SortKey)
    : 't0';
  const displayMode: DisplayMode = (DISPLAY_MODES as readonly string[]).includes(sp.mode ?? '')
    ? (sp.mode as DisplayMode)
    : 'gantt';

  const [artists, videographers, templates] = await Promise.all([
    listArtists(),
    listVideographers(),
    loadTemplates(),
  ]);
  const artistById = new Map(artists.map((a) => [a.id, a]));
  const videographerById = new Map(videographers.map((v) => [v.id, v]));

  const productionsList: Production[] = productionsRaw.filter((p) => {
    if (typeFilter !== 'all' && p.type !== typeFilter) return false;
    const isCancelled = !!p.cancelledAt;
    const isDone = isProductionDone(p.steps ?? []);
    if (statusFilter === 'cancelled') return isCancelled;
    if (statusFilter === 'done') return !isCancelled && isDone;
    if (statusFilter === 'in-progress') return !isCancelled && !isDone;
    return true;
  });

  const rows: GanttRow[] = productionsList.map((p) => {
    const artist = p.artistId ? artistById.get(p.artistId) ?? null : null;
    const videographer = p.videographerId
      ? videographerById.get(p.videographerId) ?? null
      : null;
    const steps = p.steps ?? [];
    const isCancelled = !!p.cancelledAt;
    const legacy = buildLegacyShape(steps);
    return {
      id: p.id,
      title: p.title,
      slug: p.slug,
      type: p.type as ProductionType,
      // Cancellation overrides synthesized status — gantt uses 'cancelled' as
      // its terminal off-track state.
      status: (isCancelled ? 'cancelled' : legacy.status) as ProductionStatus,
      t0At: p.t0At,
      stepDates: legacy.stepDates,
      customSteps: legacy.customSteps,
      stepOrder: legacy.stepOrder,
      steps,
      periods: p.periods ?? null,
      cancelled: isCancelled,
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

  // Canvas stretch — placement model (gantt-view.tsx) packs every step in a
  // category into its T-frame's 7-day band (T1 = outreach + ustalenia,
  // T2 = nagrywanie + obróbka, T3 = publikacja). Items in a frame are spread
  // uniformly across the band's inner 6 days, so adjacent items are
  //   6 / max(1, N - 1)   days apart (N = item count in that frame).
  //
  // Canvas must be wide enough that this gap renders at MIN_PX_PER_STEP.
  // Without that the densest frame collapses circles onto each other.
  //
  //   pixelsPerDay   = (canvasWidth - LEFT_COL_PX) / totalDays
  //   pixelsPerDay × gapDays ≥ MIN_PX_PER_STEP
  //   ⇒ canvasWidth ≥ MIN_PX_PER_STEP × totalDays / gapDays + LEFT_COL_PX
  //
  // We take the worst-case gap across all visible rows and frames. Capped so
  // we don't push the strip into perf cliffs (~6000px+ widths).
  const FRAME_OF_CATEGORY: Record<string, 'T1' | 'T2' | 'T3'> = {
    outreach: 'T1',
    ustalenia: 'T1',
    nagrywanie: 'T2',
    obrobka: 'T2',
    publikacja: 'T3',
  };
  const FRAME_INNER_DAYS = 5; // 5-day inner window (frame ends - frame starts in gantt-view)
  const LEFT_COL_PX = 352; // 22rem column for production meta on the left
  const MIN_PX_PER_STEP = 40; // step circle (28px active) + 12px breathing
  const totalDays = zoom * 7;

  let worstGapDays = 1; // default — single-item frames need ≥1 day per step
  for (const r of rows) {
    const counts: Record<'T1' | 'T2' | 'T3', number> = { T1: 0, T2: 0, T3: 0 };
    for (const s of r.steps ?? []) {
      const f = FRAME_OF_CATEGORY[s.category];
      if (f) counts[f] += 1;
    }
    for (const code of ['T1', 'T2', 'T3'] as const) {
      const N = counts[code];
      if (N <= 1) continue;
      const gap = FRAME_INNER_DAYS / (N - 1);
      if (gap < worstGapDays) worstGapDays = gap;
    }
  }

  // Min-width scales with zoom. Floor sized so milestone labels (Outreach,
  // Ustalenia z kamerzystą, Nagrywanie, Obróbka, Publikacja) get ≥6.5rem of
  // breathing room at the chosen zoom.
  // For wider views (month/quarter) the canvas can stretch — but capped so
  // we don't push the strip into perf cliffs. Scales roughly linearly with
  // visible weeks, with diminishing returns past ~26 weeks.
  const baseMinWidth =
    zoom <= 5 ? 1700
      : zoom <= 8 ? 2600
      : zoom <= 12 ? 3700
      : zoom <= 16 ? 4500
      : zoom <= 20 ? 5200
      : zoom <= 26 ? 6000
      : zoom <= 39 ? 7500
      : 9500;
  const MAX_CANVAS =
    zoom <= 5 ? 4400
      : zoom <= 8 ? 5400
      : zoom <= 12 ? 7000
      : zoom <= 16 ? 8000
      : zoom <= 20 ? 9000
      : zoom <= 26 ? 10000
      : zoom <= 39 ? 12000
      : 14000;
  const requiredForGap =
    (MIN_PX_PER_STEP * totalDays) / worstGapDays + LEFT_COL_PX;
  const canvasMinWidth = Math.min(
    MAX_CANVAS,
    Math.max(baseMinWidth, Math.ceil(requiredForGap)),
  );

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
        zoomOptions={zoomOptions as unknown as number[]}
        view={view}
        viewOptions={VIEW_MODES as unknown as string[]}
        displayMode={displayMode}
        statusFilter={statusFilter}
        typeFilter={typeFilter}
        sortKey={sortKey}
        visibleCount={rows.length}
        totalCount={totalCount}
        artists={artistOptions}
        videographers={videographerOptions}
        templates={templates}
        campaignOptions={campaignOptions}
        selectedCampaignId={selectedCampaignId}
      />
      {displayMode === 'table' ? (
        <GanttTableView rows={rows} />
      ) : (
        <GanttView
          weeks={weeks}
          rows={rows}
          campaigns={narrativeCampaigns}
          minWidthPx={canvasMinWidth}
          headerDensity={headerDensity}
        />
      )}
    </PageShell>
  );
}
