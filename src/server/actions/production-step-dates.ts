'use server';

import { eq } from 'drizzle-orm';
import { safeRevalidatePath as revalidatePath } from './revalidate';
import { db, schema } from '@/lib/db';
import type { ProductionStatus, CalendarType } from '../../../drizzle/schema';

/**
 * Stages that should also be inserted/updated in the calendar when a date is set.
 * Outreach steps are recorded only — no calendar entry.
 */
const CALENDAR_STAGES: Partial<
  Record<ProductionStatus, { type: CalendarType; titleTemplate: string; durationMinutes: number }>
> = {
  'cam-date-shared': {
    type: 'meeting',
    titleTemplate: 'Spotkanie z kamerzystą — przekazanie daty / {title}',
    durationMinutes: 30,
  },
  'script-discussed': {
    type: 'meeting',
    titleTemplate: 'Omówienie scenariusza z kamerzystą — {title}',
    durationMinutes: 60,
  },
  'script-sent': {
    type: 'deadline',
    titleTemplate: 'Wysyłka scenariusza do kamerzysty — {title}',
    durationMinutes: 0,
  },
  shooting: {
    type: 'shoot',
    titleTemplate: 'Nagrywki — {title}',
    durationMinutes: 240,
  },
  editing: {
    type: 'edit',
    titleTemplate: 'Obróbka — {title}',
    durationMinutes: 240,
  },
};

async function getProductionWithDates(productionId: number) {
  return db.query.productions.findFirst({
    where: eq(schema.productions.id, productionId),
  });
}

async function findCalendarEntryForStage(
  productionId: number,
  stage: ProductionStatus,
): Promise<typeof schema.calendarEntries.$inferSelect | null> {
  const cfg = CALENDAR_STAGES[stage];
  if (!cfg) return null;
  const entries = await db.query.calendarEntries.findMany({
    where: eq(schema.calendarEntries.productionId, productionId),
  });
  // Match by stage marker stored in description prefix `[stage:<key>]` so we can find our auto-created entry reliably.
  const tag = `[stage:${stage}]`;
  return entries.find((e) => (e.description ?? '').startsWith(tag)) ?? null;
}

/**
 * Save a "completed/scheduled at" date for a production stage.
 * For Outreach stages: record-only on production.stepDates.
 * For Ustalenia/Nagrywanie/Obróbka: also upsert a calendar entry.
 * For shooting: additionally derive editing date as +1 day.
 */
export async function setStageDate(
  productionId: number,
  stage: ProductionStatus,
  dateIso: string | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const production = await getProductionWithDates(productionId);
  if (!production) return { ok: false, error: 'Brak produkcji' };

  // 1. Update stepDates JSON
  const stepDates = { ...(production.stepDates ?? {}) };
  if (dateIso) {
    stepDates[stage] = dateIso;
  } else {
    delete stepDates[stage];
  }
  await db
    .update(schema.productions)
    .set({ stepDates })
    .where(eq(schema.productions.id, productionId));

  // 2. Upsert linked calendar entry (if applicable)
  const cfg = CALENDAR_STAGES[stage];
  if (cfg) {
    const existing = await findCalendarEntryForStage(productionId, stage);
    if (dateIso) {
      const startsAt = new Date(dateIso);
      const endsAt = new Date(startsAt.getTime() + cfg.durationMinutes * 60_000);
      const title = cfg.titleTemplate.replace('{title}', production.title);
      const description = `[stage:${stage}]`;
      if (existing) {
        await db
          .update(schema.calendarEntries)
          .set({ startsAt, endsAt, title, description })
          .where(eq(schema.calendarEntries.id, existing.id));
      } else {
        await db.insert(schema.calendarEntries).values({
          type: cfg.type,
          title,
          description,
          startsAt,
          endsAt,
          platforms: null,
          artistId: production.artistId,
          campaignId: production.campaignId,
          productionId: production.id,
          briefPath: null,
          status: 'planned',
        });
      }
    } else if (existing) {
      // Date cleared — remove the linked entry
      await db.delete(schema.calendarEntries).where(eq(schema.calendarEntries.id, existing.id));
    }
  }

  // 3. Side-effect: when shooting date is set, auto-derive editing as next day at 10:00
  if (stage === 'shooting' && dateIso) {
    const editingDate = new Date(dateIso);
    editingDate.setDate(editingDate.getDate() + 1);
    editingDate.setHours(10, 0, 0, 0);
    const editIso = editingDate.toISOString();
    const editStepDates = { ...stepDates, editing: editIso };
    await db
      .update(schema.productions)
      .set({ stepDates: editStepDates })
      .where(eq(schema.productions.id, productionId));

    const editCfg = CALENDAR_STAGES.editing!;
    const existingEdit = await findCalendarEntryForStage(productionId, 'editing');
    const editEnd = new Date(editingDate.getTime() + editCfg.durationMinutes * 60_000);
    const editTitle = editCfg.titleTemplate.replace('{title}', production.title);
    const editDesc = `[stage:editing]`;
    if (existingEdit) {
      await db
        .update(schema.calendarEntries)
        .set({ startsAt: editingDate, endsAt: editEnd, title: editTitle, description: editDesc })
        .where(eq(schema.calendarEntries.id, existingEdit.id));
    } else {
      await db.insert(schema.calendarEntries).values({
        type: editCfg.type,
        title: editTitle,
        description: editDesc,
        startsAt: editingDate,
        endsAt: editEnd,
        platforms: null,
        artistId: production.artistId,
        campaignId: production.campaignId,
        productionId: production.id,
        briefPath: null,
        status: 'planned',
      });
    }
  }

  revalidatePath('/calendar');
  revalidatePath(`/productions/${productionId}`);
  revalidatePath('/productions');
  revalidatePath('/');
  return { ok: true };
}
