'use server';

import { eq } from 'drizzle-orm';
import { safeRevalidatePath as revalidatePath } from './revalidate';
import { db, schema } from '@/lib/db';
import { saveProductionAttachment } from '@/lib/production-files';
import {
  cloneTemplateSteps,
  defaultDurationMinutes,
  deriveFromShootingIso,
  getActiveStepIndex,
  getStepWeekRange,
  isProductionDone,
  newStepId,
} from '@/lib/production-steps';
import { getTemplate } from '@/lib/production-templates';
import { generateOutputFolder } from '@/lib/output-folder';
import type {
  CalendarType,
  ProductionStage,
  ProductionStep,
  StepDateMode,
} from '../../../drizzle/schema';

/**
 * Server actions for the flexible-steps model. Replaces the legacy
 * `production-custom-steps.ts` + `production-step-dates.ts` actions one-for-one
 * but operates on `productions.steps[]` instead of (status + customSteps +
 * stepOrder + stepDates).
 *
 * Co-existence: the legacy actions are still exported and wired to the old UI.
 * As phases progress, callers migrate over to these. Cleanup phase deletes the
 * legacy module.
 */
type Result = { ok: true } | { ok: false; error: string };

async function loadProduction(productionId: number) {
  return db.query.productions.findFirst({
    where: eq(schema.productions.id, productionId),
  });
}

function bumpRevalidate(productionId: number) {
  revalidatePath('/calendar');
  revalidatePath(`/productions/${productionId}`);
  revalidatePath('/productions');
  revalidatePath('/');
}

async function saveSteps(productionId: number, steps: ProductionStep[]) {
  await db
    .update(schema.productions)
    .set({ steps })
    .where(eq(schema.productions.id, productionId));
  bumpRevalidate(productionId);
}

/**
 * Copy a template's `steps[]` onto a production at creation time. Resets
 * `doneAt`, `dateIso`, and attachments. Idempotent only when called once at
 * creation — calling on a production that already has steps replaces them.
 */
export async function applyTemplateToProduction(
  productionId: number,
  templateSlug: string,
): Promise<Result> {
  const tpl = getTemplate(templateSlug);
  if (!tpl) return { ok: false, error: `Szablon "${templateSlug}" nie istnieje` };
  const steps = cloneTemplateSteps(tpl.steps);
  await saveSteps(productionId, steps);
  return { ok: true };
}

/** Add a new step to a category. Inserts at the end of the category — same
 *  rule as the template editor's "Dodaj krok do {kategoria}" button. */
export async function addStepToProduction(
  productionId: number,
  category: ProductionStage,
  label: string,
  description?: string,
): Promise<{ ok: true; stepId: string } | { ok: false; error: string }> {
  const trimmed = label.trim();
  if (!trimmed) return { ok: false, error: 'Etykieta nie może być pusta' };
  if (trimmed.length > 80) return { ok: false, error: 'Maks. 80 znaków' };

  const prod = await loadProduction(productionId);
  if (!prod) return { ok: false, error: 'Brak produkcji' };
  const steps = prod.steps ?? [];

  const stepId = newStepId();
  const step: ProductionStep = {
    id: stepId,
    category,
    label: trimmed,
    doneAt: null,
    dateMode: 'none',
  };
  if (description?.trim()) step.description = description.trim();

  // Insertion index = end of category in the current ordered list.
  const CATEGORY_ORDER: ProductionStage[] = [
    'outreach',
    'ustalenia',
    'nagrywanie',
    'obrobka',
    'publikacja',
  ];
  const myCatOrder = CATEGORY_ORDER.indexOf(category);
  let boundaryIdx = steps.length;
  for (let i = 0; i < steps.length; i++) {
    const otherCat = CATEGORY_ORDER.indexOf(steps[i].category);
    if (otherCat > myCatOrder) {
      boundaryIdx = i;
      break;
    }
  }
  const next = [...steps.slice(0, boundaryIdx), step, ...steps.slice(boundaryIdx)];
  await saveSteps(productionId, next);
  return { ok: true, stepId };
}

export async function removeStepFromProduction(
  productionId: number,
  stepId: string,
): Promise<Result> {
  const prod = await loadProduction(productionId);
  if (!prod) return { ok: false, error: 'Brak produkcji' };
  const steps = prod.steps ?? [];
  const next = steps.filter((s) => s.id !== stepId);
  if (next.length === steps.length) return { ok: false, error: 'Brak kroku' };
  await saveSteps(productionId, next);
  return { ok: true };
}

export async function renameStep(
  productionId: number,
  stepId: string,
  label: string,
): Promise<Result> {
  const trimmed = label.trim();
  if (!trimmed) return { ok: false, error: 'Etykieta nie może być pusta' };
  if (trimmed.length > 80) return { ok: false, error: 'Maks. 80 znaków' };
  const prod = await loadProduction(productionId);
  if (!prod) return { ok: false, error: 'Brak produkcji' };
  const steps = prod.steps ?? [];
  const idx = steps.findIndex((s) => s.id === stepId);
  if (idx < 0) return { ok: false, error: 'Brak kroku' };
  const next = steps.slice();
  next[idx] = { ...next[idx], label: trimmed };
  await saveSteps(productionId, next);
  return { ok: true };
}

export async function updateStepDescription(
  productionId: number,
  stepId: string,
  description: string,
): Promise<Result> {
  const trimmed = description.trim();
  if (trimmed.length > 1000) return { ok: false, error: 'Maks. 1000 znaków' };
  const prod = await loadProduction(productionId);
  if (!prod) return { ok: false, error: 'Brak produkcji' };
  const steps = prod.steps ?? [];
  const idx = steps.findIndex((s) => s.id === stepId);
  if (idx < 0) return { ok: false, error: 'Brak kroku' };
  const next = steps.slice();
  next[idx] = { ...next[idx], description: trimmed || undefined };
  await saveSteps(productionId, next);
  return { ok: true };
}

/** Move a step up or down within its OWN category — never crosses category
 *  boundaries. Returns ok-noop if the step is already at the edge. */
export async function moveStepInProduction(
  productionId: number,
  stepId: string,
  direction: 'up' | 'down',
): Promise<Result> {
  const prod = await loadProduction(productionId);
  if (!prod) return { ok: false, error: 'Brak produkcji' };
  const steps = prod.steps ?? [];
  const idx = steps.findIndex((s) => s.id === stepId);
  if (idx < 0) return { ok: false, error: 'Brak kroku' };
  const target = steps[idx];

  // Find the previous/next step in the SAME category.
  let neighborIdx = -1;
  if (direction === 'up') {
    for (let i = idx - 1; i >= 0; i--) {
      if (steps[i].category === target.category) {
        neighborIdx = i;
        break;
      }
    }
  } else {
    for (let i = idx + 1; i < steps.length; i++) {
      if (steps[i].category === target.category) {
        neighborIdx = i;
        break;
      }
    }
  }
  if (neighborIdx === -1) return { ok: true };
  const next = steps.slice();
  [next[idx], next[neighborIdx]] = [next[neighborIdx], next[idx]];
  await saveSteps(productionId, next);
  return { ok: true };
}

/**
 * Sequential cascade — clicking a step marks it + every previous step as done
 * (or unmarks it + every later step). Mirrors the legacy `cascadeStepsTo`
 * behavior but operates on the flat `steps[]` list. Side effect: when the
 * last step transitions to done for the first time, generates the output
 * folder (legacy `setProductionStatus(id, 'publishing')` trigger).
 */
export async function cascadeStepsTo(
  productionId: number,
  stepId: string,
  mode: 'mark' | 'unmark',
): Promise<Result> {
  const prod = await loadProduction(productionId);
  if (!prod) return { ok: false, error: 'Brak produkcji' };
  if (prod.cancelledAt) return { ok: false, error: 'Produkcja anulowana' };
  const steps = prod.steps ?? [];
  const targetIdx = steps.findIndex((s) => s.id === stepId);
  if (targetIdx < 0) return { ok: false, error: 'Brak kroku' };

  const wasDone = isProductionDone(steps);

  const stamp = new Date().toISOString();
  const lastDoneIdx = mode === 'mark' ? targetIdx : targetIdx - 1;
  const next = steps.map((s, i) => {
    const shouldBeDone = i <= lastDoneIdx;
    if (shouldBeDone && !s.doneAt) return { ...s, doneAt: stamp };
    if (!shouldBeDone && s.doneAt) return { ...s, doneAt: null };
    return s;
  });
  await saveSteps(productionId, next);

  // Output-folder side effect: trigger when production transitions from
  // not-done → done (last cascade marked everything). Folder generation is
  // best-effort — failure doesn't roll back the cascade.
  const isNowDone = isProductionDone(next);
  if (!wasDone && isNowDone && !prod.folderPath) {
    try {
      await generateOutputFolder(productionId);
      revalidatePath('/output');
    } catch (e) {
      console.error('[output-folder] generation failed for production', productionId, e);
    }
  }

  return { ok: true };
}

/** Toggle a single step's done flag (no cascade). Used for custom-step style
 *  ad-hoc completion outside the linear pipeline. */
export async function toggleStepDone(
  productionId: number,
  stepId: string,
): Promise<Result> {
  const prod = await loadProduction(productionId);
  if (!prod) return { ok: false, error: 'Brak produkcji' };
  if (prod.cancelledAt) return { ok: false, error: 'Produkcja anulowana' };
  const steps = prod.steps ?? [];
  const idx = steps.findIndex((s) => s.id === stepId);
  if (idx < 0) return { ok: false, error: 'Brak kroku' };
  const next = steps.slice();
  next[idx] = {
    ...next[idx],
    doneAt: next[idx].doneAt ? null : new Date().toISOString(),
  };
  await saveSteps(productionId, next);
  return { ok: true };
}

/**
 * Calendar-entry config per step type. Replaces the legacy CALENDAR_STAGES
 * map keyed by ProductionStatus — now driven by the step's own dateMode +
 * calendarType + durationMinutes (copied from template at creation).
 */
function calendarTypeFor(step: ProductionStep): CalendarType | null {
  if (step.dateMode !== 'calendar' && step.dateMode !== 'derived-from-shooting') {
    return null;
  }
  return step.calendarType ?? 'meeting';
}

async function findCalendarEntryForStep(productionId: number, stepId: string) {
  const tag = `[step:${stepId}]`;
  const entries = await db.query.calendarEntries.findMany({
    where: eq(schema.calendarEntries.productionId, productionId),
  });
  return entries.find((e) => (e.description ?? '').startsWith(tag)) ?? null;
}

async function upsertCalendarEntryForStep(
  productionId: number,
  step: ProductionStep,
  productionTitle: string,
  productionArtistId: number | null,
  productionCampaignId: number | null,
): Promise<void> {
  const calType = calendarTypeFor(step);
  const existing = await findCalendarEntryForStep(productionId, step.id);

  if (!step.dateIso || !calType) {
    if (existing) {
      await db
        .delete(schema.calendarEntries)
        .where(eq(schema.calendarEntries.id, existing.id));
    }
    return;
  }

  const startsAt = new Date(step.dateIso);
  const duration = step.durationMinutes ?? defaultDurationMinutes(step.dateMode);
  const endsAt = new Date(startsAt.getTime() + duration * 60_000);
  const title = `${step.label} — ${productionTitle}`;
  const description = `[step:${step.id}] ${step.description ?? ''}`.trim();

  if (existing) {
    await db
      .update(schema.calendarEntries)
      .set({ startsAt, endsAt, title, description })
      .where(eq(schema.calendarEntries.id, existing.id));
  } else {
    await db.insert(schema.calendarEntries).values({
      type: calType,
      title,
      description,
      startsAt,
      endsAt,
      platforms: null,
      artistId: productionArtistId,
      campaignId: productionCampaignId,
      productionId,
      briefPath: null,
      status: 'planned',
    });
  }
}

/**
 * Set a step's date. Side effects:
 *  - dateMode: 'calendar' → upsert/delete linked calendar entry tagged
 *    `[step:<id>]`.
 *  - dateMode: 'derived-from-shooting' → not user-settable directly. Setting
 *    a T0-anchor (typically shooting) cascades to every derived step.
 *  - dateMode: 'record' → just save dateIso, no calendar.
 *  - dateMode: 'none' → reject.
 */
export async function setStepDate(
  productionId: number,
  stepId: string,
  dateIso: string | null,
): Promise<Result> {
  const prod = await loadProduction(productionId);
  if (!prod) return { ok: false, error: 'Brak produkcji' };
  const steps = prod.steps ?? [];
  const idx = steps.findIndex((s) => s.id === stepId);
  if (idx < 0) return { ok: false, error: 'Brak kroku' };
  const step = steps[idx];
  if (step.dateMode === 'none' || !step.dateMode) {
    return { ok: false, error: 'Ten krok nie ma daty' };
  }

  // Range guard — every step is locked to the calendar week of its T-frame
  // (outreach/ustalenia → T-2, nagrywanie/obrobka → T-1, publikacja → T-0).
  // 'derived-from-shooting' is system-set from the T-0 anchor and skipped.
  if (dateIso && step.dateMode !== 'derived-from-shooting') {
    const { start, end } = getStepWeekRange(prod.t0At, step.category);
    const candidate = new Date(dateIso);
    if (candidate < start || candidate > end) {
      const fmt = (d: Date) =>
        d.toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit' });
      return {
        ok: false,
        error: `Data musi mieścić się w tygodniu ${fmt(start)}–${fmt(end)}`,
      };
    }
  }

  const next = steps.slice();
  next[idx] = { ...step, dateIso: dateIso ?? undefined };

  // T-0 anchor change cascades to every step with dateMode: 'derived-from-shooting'.
  if (step.isT0Anchor) {
    for (let i = 0; i < next.length; i++) {
      if (next[i].dateMode === 'derived-from-shooting') {
        const derived = dateIso ? deriveFromShootingIso(dateIso) : undefined;
        next[i] = { ...next[i], dateIso: derived };
      }
    }
  }

  await saveSteps(productionId, next);

  // Upsert/remove calendar entries for the changed step + any derived ones.
  await upsertCalendarEntryForStep(
    productionId,
    next[idx],
    prod.title,
    prod.artistId,
    prod.campaignId,
  );
  if (step.isT0Anchor) {
    for (const s of next) {
      if (s.dateMode === 'derived-from-shooting') {
        await upsertCalendarEntryForStep(
          productionId,
          s,
          prod.title,
          prod.artistId,
          prod.campaignId,
        );
      }
    }
  }

  return { ok: true };
}

/** Attach a file to a step. Storage path mirrors the legacy custom-step
 *  folder layout so existing attachments survive the migration. */
export async function attachFileToStep(
  productionId: number,
  stepId: string,
  formData: FormData,
): Promise<Result> {
  const file = formData.get('file');
  if (!(file instanceof File)) return { ok: false, error: 'Brak pliku' };
  if (file.size === 0) return { ok: false, error: 'Pusty plik' };
  if (file.size > 25 * 1024 * 1024) return { ok: false, error: 'Plik > 25 MB' };

  const prod = await loadProduction(productionId);
  if (!prod) return { ok: false, error: 'Brak produkcji' };
  const steps = prod.steps ?? [];
  const idx = steps.findIndex((s) => s.id === stepId);
  if (idx < 0) return { ok: false, error: 'Brak kroku' };

  const buf = Buffer.from(await file.arrayBuffer());
  const att = await saveProductionAttachment(prod.slug, `step-${stepId}`, file.name, buf);
  const next = steps.slice();
  next[idx] = {
    ...next[idx],
    attachmentPath: att.relativePath,
    attachmentName: att.filename,
    attachmentSize: att.size,
  };
  await saveSteps(productionId, next);
  return { ok: true };
}

export async function removeStepAttachment(
  productionId: number,
  stepId: string,
): Promise<Result> {
  const prod = await loadProduction(productionId);
  if (!prod) return { ok: false, error: 'Brak produkcji' };
  const steps = prod.steps ?? [];
  const idx = steps.findIndex((s) => s.id === stepId);
  if (idx < 0) return { ok: false, error: 'Brak kroku' };
  const next = steps.slice();
  const { attachmentPath: _p, attachmentName: _n, attachmentSize: _s, ...rest } = next[idx];
  void _p;
  void _n;
  void _s;
  next[idx] = rest;
  await saveSteps(productionId, next);
  return { ok: true };
}

/** Toggle production cancellation. Cancelled productions can't have their
 *  steps cascaded but can still be uncancelled to resume work. */
export async function setProductionCancelled(
  productionId: number,
  cancelled: boolean,
): Promise<Result> {
  await db
    .update(schema.productions)
    .set({ cancelledAt: cancelled ? new Date() : null })
    .where(eq(schema.productions.id, productionId));
  bumpRevalidate(productionId);
  return { ok: true };
}

// Type-only re-exports for callers that need to avoid a separate lib import.
export type { ProductionStep, StepDateMode };

void getActiveStepIndex;
