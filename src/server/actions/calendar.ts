'use server';

import { safeRevalidatePath as revalidatePath } from './revalidate';
import { eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import {
  calendarEntryInputSchema,
  calendarEntryUpdateSchema,
  type CalendarEntryInput,
} from './schemas';

function toDate(s: string): Date {
  return new Date(s);
}

export async function createCalendarEntry(input: CalendarEntryInput) {
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
  revalidatePath('/');
  return row;
}

export async function updateCalendarEntry(input: unknown) {
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
  revalidatePath('/');
  return row;
}

export async function deleteCalendarEntry(id: number) {
  await db.delete(schema.calendarEntries).where(eq(schema.calendarEntries.id, id));
  revalidatePath('/calendar');
  revalidatePath('/');
}

export async function listCalendarEntries() {
  return db.query.calendarEntries.findMany({
    orderBy: schema.calendarEntries.startsAt,
  });
}
