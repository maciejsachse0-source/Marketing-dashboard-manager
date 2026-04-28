import { and, gte, lte, inArray } from 'drizzle-orm';
import { PageShell } from '@/components/page-shell';
import { CalendarShell } from '@/components/calendar/calendar-shell';
import { GanttView } from '@/components/calendar/gantt-view';
import { ViewToggle } from '@/components/calendar/view-toggle';
import { db, schema } from '@/lib/db';
import { addDays, endOfDay, startOfWeek } from '@/lib/dates';
import { listArtists } from '@/server/actions/artists';
import { listVideographers } from '@/server/actions/videographers';
import { listProductionTemplates } from '@/lib/templates';
import type { Production } from '../../../drizzle/schema';
import type { ProductionMeta } from '@/components/calendar/production-meta';

export const dynamic = 'force-dynamic';

const GANTT_WEEKS = 5;
// Productions whose T-0 falls up to 2 weeks past the visible window still have
// outreach/shoot phases inside the window (T-2/T-1) and must be fetched.
const GANTT_T0_LOOKAHEAD_WEEKS = GANTT_WEEKS + 2;

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string; view?: string }>;
}) {
  const sp = await searchParams;
  const view: 'week' | 'gantt' = sp.view === 'gantt' ? 'gantt' : 'week';
  const baseDate = sp.week ? new Date(sp.week) : new Date();
  const weekStart = startOfWeek(baseDate);

  // Time range: week view = 1 week, gantt view = 5 weeks
  const rangeStart = weekStart;
  const rangeEnd =
    view === 'gantt'
      ? endOfDay(addDays(weekStart, GANTT_WEEKS * 7 - 1))
      : endOfDay(addDays(weekStart, 6));

  const entries = await db.query.calendarEntries.findMany({
    where: and(
      gte(schema.calendarEntries.startsAt, rangeStart),
      lte(schema.calendarEntries.startsAt, rangeEnd),
    ),
    orderBy: schema.calendarEntries.startsAt,
  });

  // For gantt: pull productions whose T-0 sits anywhere from this week up to
  // 2 weeks after the visible window — those still have outreach/shoot phases
  // landing in the visible 5-week strip.
  const productionsInRange =
    view === 'gantt'
      ? await db.query.productions.findMany({
          where: and(
            gte(schema.productions.t0At, rangeStart),
            lte(
              schema.productions.t0At,
              endOfDay(addDays(weekStart, GANTT_T0_LOOKAHEAD_WEEKS * 7 - 1)),
            ),
          ),
        })
      : [];

  const productionIdSet = new Set<number>();
  for (const e of entries) if (e.productionId) productionIdSet.add(e.productionId);
  for (const p of productionsInRange) productionIdSet.add(p.id);
  const productionIds = [...productionIdSet];

  const productionsList: Production[] = productionIds.length
    ? await db.query.productions.findMany({
        where: inArray(schema.productions.id, productionIds),
      })
    : [];

  const [artists, videographers] = await Promise.all([listArtists(), listVideographers()]);
  const artistById = new Map(artists.map((a) => [a.id, a]));
  const videographerById = new Map(videographers.map((v) => [v.id, v]));

  const productions: Record<number, ProductionMeta> = Object.fromEntries(
    productionsList.map((p) => {
      const artist = p.artistId ? artistById.get(p.artistId) ?? null : null;
      const videographer = p.videographerId
        ? videographerById.get(p.videographerId) ?? null
        : null;
      return [
        p.id,
        {
          id: p.id,
          title: p.title,
          slug: p.slug,
          status: p.status,
          type: p.type,
          t0At: p.t0At,
          platforms: p.platforms ?? null,
          folderPath: p.folderPath,
          artistName: artist?.name ?? null,
          artistHandle: artist?.handle ?? null,
          videographerName: videographer?.name ?? null,
        } satisfies ProductionMeta,
      ];
    }),
  );

  const templates = listProductionTemplates();

  const artistOptions = artists.map((a) => ({ id: a.id, name: a.name, handle: a.handle }));
  const videographerOptions = videographers.map((v) => ({
    id: v.id,
    name: v.name,
    hourlyRate: v.hourlyRate,
  }));

  const weeks = Array.from({ length: GANTT_WEEKS }, (_, i) => addDays(weekStart, i * 7));

  return (
    <PageShell
      title="Kalendarz"
      description={
        view === 'gantt'
          ? 'Pipeline 5 tygodni — T1 outreach + ustalenia → T2 nagrywka + obróbka → T3 publikacja.'
          : 'Tygodniowy widok produkcji. Przeciągnij wpis, aby zmienić termin.'
      }
      actions={<ViewToggle view={view} />}
    >
      {view === 'gantt' ? (
        <GanttView weeks={weeks} productions={productions} />
      ) : (
        <CalendarShell
          weekStart={weekStart}
          entries={entries}
          productions={productions}
          templates={templates}
          artists={artistOptions}
          videographers={videographerOptions}
        />
      )}
    </PageShell>
  );
}
