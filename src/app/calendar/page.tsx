import { and, gte, lte } from 'drizzle-orm';
import { PageShell } from '@/components/page-shell';
import { CalendarShell } from '@/components/calendar/calendar-shell';
import { db, schema } from '@/lib/db';
import { addDays, endOfDay, startOfWeek } from '@/lib/dates';

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

  return (
    <PageShell title="Kalendarz" description="Tygodniowy widok produkcji.">
      <CalendarShell weekStart={weekStart} entries={entries} />
    </PageShell>
  );
}
