'use server';

/**
 * Wpisy kalendarza: kanał agentowy, nie interfejs (F7-09, decyzja 2026-09-03).
 *
 * Żaden komponent nie woła tych czterech akcji i nie ma go wołać. Interfejs
 * zapisuje wpisy kalendarza inną drogą: `upsertCalendarEntryForStep`
 * w `src/server/actions/production-steps.ts` robi to jako skutek uboczny
 * ustawienia daty kroku produkcji (wołane wyłącznie z `setStepDate`). Planowanie ręczne
 * należy do agenta.
 *
 * UWAGA, zmierzone 2026-09-03: tych akcji NIE da się zaimportować do skryptu
 * `tsx`. `requireSession()` ciągnie `src/lib/auth.ts`, a ten `server-only`,
 * który rzuca wyjątkiem poza kontekstem żądania. Agent zapisuje wpis przez
 * `db.insert(schema.calendarEntries)` — sekcja „Kiedy potrzebujesz ad-hoc query"
 * w `CLAUDE.md`. Rozbieżność między tym a przepisami w `agents/schedule-manager.md`
 * i `agents/campaign-strategist.md` jest zapisana jako **F7-30**.
 *
 * Akcje zostają, bo są jedyną w repozytorium ścieżką zapisu wpisu kalendarza
 * z walidacją Zod i sesją, i bo `CLAUDE.md` opisuje ręczne planowanie jako część
 * przepływu. Nie kasuj ich jako „martwego kodu" bez decyzji usera.
 */

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
