'use server';

import { safeRevalidatePath as revalidatePath } from './revalidate';
import { eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { requireSession } from '@/lib/auth';
import {
  calendarEntryInputSchema,
  calendarEntryUpdateSchema,
  idSchema,
  type CalendarEntryInput,
} from './schemas';

function toDate(s: string): Date {
  return new Date(s);
}

export async function createCalendarEntry(input: CalendarEntryInput) {
  await requireSession();
  const parsed = calendarEntryInputSchema.parse(input);
  const [row] = await db
    .insert(schema.calendarEntries)
    .values({
      type: parsed.type,
      title: parsed.title,
      description: parsed.description ?? null,
      startsAt: toDate(parsed.startsAt),
      endsAt: toDate(parsed.endsAt),
      platforms: parsed.platforms ?? null,
      artistId: parsed.artistId ?? null,
      campaignId: parsed.campaignId ?? null,
      briefPath: parsed.briefPath ?? null,
      status: parsed.status ?? 'planned',
    })
    .returning();
  revalidatePath('/calendar');
  // Pulpit pokazuje najblizsze wpisy kalendarza i strumien ostatnich zmian,
  // wiec wchodzi w zakres. Typ `page` jawnie: unieważniamy sam pulpit,
  // a nie uklad z cala aplikacja pod spodem.
  revalidatePath('/', 'page');
  return row;
}

export async function updateCalendarEntry(input: unknown) {
  await requireSession();
  const parsed = calendarEntryUpdateSchema.parse(input);
  const { id, startsAt, endsAt, ...rest } = parsed;
  const [row] = await db
    .update(schema.calendarEntries)
    .set({
      ...rest,
      ...(startsAt ? { startsAt: toDate(startsAt) } : {}),
      ...(endsAt ? { endsAt: toDate(endsAt) } : {}),
    })
    .where(eq(schema.calendarEntries.id, id))
    .returning();
  revalidatePath('/calendar');
  // Pulpit pokazuje najblizsze wpisy kalendarza i strumien ostatnich zmian,
  // wiec wchodzi w zakres. Typ `page` jawnie: unieważniamy sam pulpit,
  // a nie uklad z cala aplikacja pod spodem.
  revalidatePath('/', 'page');
  return row;
}

export async function deleteCalendarEntry(id: number) {
  await requireSession();
  idSchema.parse(id);
  await db.delete(schema.calendarEntries).where(eq(schema.calendarEntries.id, id));
  revalidatePath('/calendar');
  // Pulpit pokazuje najblizsze wpisy kalendarza i strumien ostatnich zmian,
  // wiec wchodzi w zakres. Typ `page` jawnie: unieważniamy sam pulpit,
  // a nie uklad z cala aplikacja pod spodem.
  revalidatePath('/', 'page');
}

export async function listCalendarEntries() {
  await requireSession();
  return db.query.calendarEntries.findMany({
    orderBy: schema.calendarEntries.startsAt,
  });
}
