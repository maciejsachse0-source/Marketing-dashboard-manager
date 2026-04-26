import { and, gte, lte, inArray } from 'drizzle-orm';
import { PageShell } from '@/components/page-shell';
import { CalendarShell } from '@/components/calendar/calendar-shell';
import { db, schema } from '@/lib/db';
import { addDays, endOfDay, startOfWeek } from '@/lib/dates';
import { listArtists } from '@/server/actions/artists';
import { listVideographers } from '@/server/actions/videographers';
import { listProductionTemplates } from '@/lib/templates';
import type { Production } from '../../../drizzle/schema';
import type { ProductionMeta } from '@/components/calendar/production-meta';

export const dynamic = 'force-dynamic';

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const sp = await searchParams;
  const baseDate = sp.week ? new Date(sp.week) : new Date();
  const weekStart = startOfWeek(baseDate);
  const weekEnd = endOfDay(addDays(weekStart, 6));

  const entries = await db.query.calendarEntries.findMany({
    where: and(
      gte(schema.calendarEntries.startsAt, weekStart),
      lte(schema.calendarEntries.startsAt, weekEnd),
    ),
    orderBy: schema.calendarEntries.startsAt,
  });

  const productionIds = Array.from(
    new Set(entries.map((e) => e.productionId).filter((x): x is number => x != null)),
  );

  const productionsList: Production[] = productionIds.length
    ? await db.query.productions.findMany({
        where: inArray(schema.productions.id, productionIds),
      })
    : [];

  // Pull artists/videographers (full list — used by wizard) plus build per-production
  // meta map so the week tile can show "↳ Świt z Anią · T-7 · @ania_test" inline.
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

  return (
    <PageShell
      title="Kalendarz"
      description="Tygodniowy widok produkcji. Przeciągnij wpis, aby zmienić termin."
    >
      <CalendarShell
        weekStart={weekStart}
        entries={entries}
        productions={productions}
        templates={templates}
        artists={artistOptions}
        videographers={videographerOptions}
      />
    </PageShell>
  );
}
