import { and, gte, lte, inArray } from 'drizzle-orm';
import { PageShell } from '@/components/page-shell';
import { CalendarShell } from '@/components/calendar/calendar-shell';
import { db, schema } from '@/lib/db';
import { addDays, endOfDay, startOfWeek } from '@/lib/dates';
import { listArtists } from '@/server/actions/artists';
import { listVideographers } from '@/server/actions/videographers';
import { listProductionTemplates } from '@/lib/templates';
import type { Production } from '../../../drizzle/schema';

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
  const productions: Record<number, Production> = Object.fromEntries(
    productionsList.map((p) => [p.id, p]),
  );

  const [artists, videographers] = await Promise.all([listArtists(), listVideographers()]);
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
