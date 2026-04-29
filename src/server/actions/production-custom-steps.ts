'use server';

import { eq } from 'drizzle-orm';
import { safeRevalidatePath as revalidatePath } from './revalidate';
import { db, schema } from '@/lib/db';
import { saveProductionAttachment } from '@/lib/production-files';
import {
  CANONICAL_STAGES_BY_CATEGORY,
  resolveCategorySequence,
  sequenceToOrder,
} from '@/lib/category-sequence';
import {
  PRODUCTION_PROGRESSION,
  PRODUCTION_STAGES,
  type CustomStep,
  type ProductionStage,
  type ProductionStatus,
} from '../../../drizzle/schema';

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

async function saveCustomSteps(
  productionId: number,
  customSteps: Partial<Record<ProductionStage, CustomStep[]>>,
) {
  await db
    .update(schema.productions)
    .set({ customSteps })
    .where(eq(schema.productions.id, productionId));
  bumpRevalidate(productionId);
}

async function saveBoth(
  productionId: number,
  customSteps: Partial<Record<ProductionStage, CustomStep[]>>,
  stepOrder: Partial<Record<ProductionStage, string[]>>,
) {
  await db
    .update(schema.productions)
    .set({ customSteps, stepOrder })
    .where(eq(schema.productions.id, productionId));
  bumpRevalidate(productionId);
}

async function saveStepOrder(
  productionId: number,
  stepOrder: Partial<Record<ProductionStage, string[]>>,
) {
  await db
    .update(schema.productions)
    .set({ stepOrder })
    .where(eq(schema.productions.id, productionId));
  bumpRevalidate(productionId);
}

function newStepId(): string {
  return Math.random().toString(36).slice(2, 14);
}

/**
 * Bulk-apply a template's custom steps to a freshly-created production.
 * Single DB write — builds the full customSteps map from the template list,
 * grouped by category, in the order they appear in the template definition.
 * Idempotent on first call (no existing customs to merge with); subsequent
 * calls would append, but templates are only meant to be applied at creation.
 */
export async function applyTemplateSteps(
  productionId: number,
  steps: Array<{
    category: ProductionStage;
    label: string;
    positionAfter: ProductionStatus;
    description?: string;
  }>,
): Promise<Result> {
  if (steps.length === 0) return { ok: true };
  const prod = await loadProduction(productionId);
  if (!prod) return { ok: false, error: 'Brak produkcji' };

  const allCustoms = (prod.customSteps ?? {}) as Partial<
    Record<ProductionStage, CustomStep[]>
  >;
  const next: Partial<Record<ProductionStage, CustomStep[]>> = { ...allCustoms };

  for (const s of steps) {
    const trimmed = s.label.trim();
    if (!trimmed || trimmed.length > 80) continue;
    const stepId = newStepId();
    const newStep: CustomStep = {
      id: stepId,
      label: trimmed,
      positionAfter: s.positionAfter,
      doneAt: null,
      ...(s.description ? { description: s.description.trim() } : {}),
    };
    const existing = next[s.category] ?? [];
    next[s.category] = [...existing, newStep];
  }

  await saveCustomSteps(productionId, next);
  return { ok: true };
}

export async function addCustomStep(
  productionId: number,
  category: ProductionStage,
  positionAfter: ProductionStatus,
  label: string,
  description?: string,
): Promise<{ ok: true; stepId: string } | { ok: false; error: string }> {
  const trimmed = label.trim();
  if (!trimmed) return { ok: false, error: 'Etykieta nie może być pusta' };
  if (trimmed.length > 80) return { ok: false, error: 'Maks. 80 znaków' };
  const desc = description?.trim() || undefined;

  const prod = await loadProduction(productionId);
  if (!prod) return { ok: false, error: 'Brak produkcji' };

  const allCustoms = (prod.customSteps ?? {}) as Partial<
    Record<ProductionStage, CustomStep[]>
  >;
  const existing = allCustoms[category] ?? [];
  const stepId = newStepId();
  const newStep: CustomStep = {
    id: stepId,
    label: trimmed,
    positionAfter,
    doneAt: null,
    ...(desc ? { description: desc } : {}),
  };
  const nextCustoms: CustomStep[] = [...existing, newStep];

  // If this category already has an explicit stepOrder, append the new step
  // to it so it lands at the end of the user's sequence (rather than reverting
  // to the legacy positionAfter slot).
  const allOrder = (prod.stepOrder ?? {}) as Partial<
    Record<ProductionStage, string[]>
  >;
  const existingOrder = allOrder[category];
  if (existingOrder && existingOrder.length > 0) {
    const nextOrder = { ...allOrder, [category]: [...existingOrder, stepId] };
    await saveBoth(
      productionId,
      { ...allCustoms, [category]: nextCustoms },
      nextOrder,
    );
  } else {
    await saveCustomSteps(productionId, { ...allCustoms, [category]: nextCustoms });
  }
  return { ok: true, stepId };
}

export async function toggleCustomStep(
  productionId: number,
  category: ProductionStage,
  stepId: string,
): Promise<Result> {
  const prod = await loadProduction(productionId);
  if (!prod) return { ok: false, error: 'Brak produkcji' };
  const all = (prod.customSteps ?? {}) as Partial<Record<ProductionStage, CustomStep[]>>;
  const list = all[category];
  if (!list) return { ok: false, error: 'Brak kategorii' };
  const idx = list.findIndex((s) => s.id === stepId);
  if (idx < 0) return { ok: false, error: 'Brak kroku' };
  const next = list.slice();
  next[idx] = { ...next[idx], doneAt: next[idx].doneAt ? null : new Date().toISOString() };
  await saveCustomSteps(productionId, { ...all, [category]: next });
  return { ok: true };
}

export async function removeCustomStep(
  productionId: number,
  category: ProductionStage,
  stepId: string,
): Promise<Result> {
  const prod = await loadProduction(productionId);
  if (!prod) return { ok: false, error: 'Brak produkcji' };
  const all = (prod.customSteps ?? {}) as Partial<Record<ProductionStage, CustomStep[]>>;
  const list = all[category];
  if (!list) return { ok: false, error: 'Brak kategorii' };
  const next = list.filter((s) => s.id !== stepId);

  // Drop the id from stepOrder if present.
  const allOrder = (prod.stepOrder ?? {}) as Partial<
    Record<ProductionStage, string[]>
  >;
  const existingOrder = allOrder[category];
  if (existingOrder && existingOrder.includes(stepId)) {
    const filtered = existingOrder.filter((k) => k !== stepId);
    await saveBoth(
      productionId,
      { ...all, [category]: next },
      { ...allOrder, [category]: filtered },
    );
  } else {
    await saveCustomSteps(productionId, { ...all, [category]: next });
  }
  return { ok: true };
}

export async function renameCustomStep(
  productionId: number,
  category: ProductionStage,
  stepId: string,
  label: string,
): Promise<Result> {
  const trimmed = label.trim();
  if (!trimmed) return { ok: false, error: 'Etykieta nie może być pusta' };
  if (trimmed.length > 80) return { ok: false, error: 'Maks. 80 znaków' };
  const prod = await loadProduction(productionId);
  if (!prod) return { ok: false, error: 'Brak produkcji' };
  const all = (prod.customSteps ?? {}) as Partial<Record<ProductionStage, CustomStep[]>>;
  const list = all[category];
  if (!list) return { ok: false, error: 'Brak kategorii' };
  const idx = list.findIndex((s) => s.id === stepId);
  if (idx < 0) return { ok: false, error: 'Brak kroku' };
  const next = list.slice();
  next[idx] = { ...next[idx], label: trimmed };
  await saveCustomSteps(productionId, { ...all, [category]: next });
  return { ok: true };
}

export async function updateCustomStepDescription(
  productionId: number,
  category: ProductionStage,
  stepId: string,
  description: string,
): Promise<Result> {
  const trimmed = description.trim();
  if (trimmed.length > 1000) return { ok: false, error: 'Maks. 1000 znaków' };
  const prod = await loadProduction(productionId);
  if (!prod) return { ok: false, error: 'Brak produkcji' };
  const all = (prod.customSteps ?? {}) as Partial<Record<ProductionStage, CustomStep[]>>;
  const list = all[category];
  if (!list) return { ok: false, error: 'Brak kategorii' };
  const idx = list.findIndex((s) => s.id === stepId);
  if (idx < 0) return { ok: false, error: 'Brak kroku' };
  const next = list.slice();
  next[idx] = { ...next[idx], description: trimmed || undefined };
  await saveCustomSteps(productionId, { ...all, [category]: next });
  return { ok: true };
}

/**
 * Move ANY step (canonical or custom) one slot ↑/↓ within its category's joint
 * sequence. The step is identified by `stepKey` — for canonicals that's the
 * `ProductionStatus` value, for customs the step's id.
 *
 * On first reorder of a category, the materialized order (built either from
 * legacy positionAfter or from the default canonical list) is persisted into
 * `productions.step_order[category]`. From then on, that explicit list is the
 * source of truth — moves only swap entries inside it.
 */
export async function moveStepInCategory(
  productionId: number,
  category: ProductionStage,
  stepKey: string,
  direction: 'up' | 'down',
): Promise<Result> {
  const prod = await loadProduction(productionId);
  if (!prod) return { ok: false, error: 'Brak produkcji' };
  if (!CANONICAL_STAGES_BY_CATEGORY[category]) {
    return { ok: false, error: 'Nieznana kategoria' };
  }

  const customsAll = (prod.customSteps ?? {}) as Partial<
    Record<ProductionStage, CustomStep[]>
  >;
  const customs = customsAll[category] ?? [];

  const orderAll = (prod.stepOrder ?? {}) as Partial<
    Record<ProductionStage, string[]>
  >;
  const sequence = resolveCategorySequence(category, customs, orderAll[category]);
  const order = sequenceToOrder(sequence);

  const idx = order.indexOf(stepKey);
  if (idx < 0) return { ok: false, error: 'Brak kroku' };
  const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
  if (targetIdx < 0 || targetIdx >= order.length) return { ok: true };

  [order[idx], order[targetIdx]] = [order[targetIdx], order[idx]];

  await saveStepOrder(productionId, { ...orderAll, [category]: order });
  return { ok: true };
}

/** Backwards-compatible wrapper — older callers still pass a custom step id. */
export async function moveCustomStep(
  productionId: number,
  category: ProductionStage,
  stepId: string,
  direction: 'up' | 'down',
): Promise<Result> {
  return moveStepInCategory(productionId, category, stepId, direction);
}

/**
 * Attach a file to a custom step. File goes under
 * `data/files/productions/<slug>/custom-step-<stepId>/<filename>`.
 * Stores `attachmentPath` + `attachmentName` + `attachmentSize` on the step.
 */
export async function attachFileToCustomStep(
  productionId: number,
  category: ProductionStage,
  stepId: string,
  formData: FormData,
): Promise<Result> {
  const file = formData.get('file');
  if (!(file instanceof File)) return { ok: false, error: 'Brak pliku' };
  if (file.size === 0) return { ok: false, error: 'Pusty plik' };
  if (file.size > 25 * 1024 * 1024) return { ok: false, error: 'Plik > 25 MB' };

  const prod = await loadProduction(productionId);
  if (!prod) return { ok: false, error: 'Brak produkcji' };

  const all = (prod.customSteps ?? {}) as Partial<Record<ProductionStage, CustomStep[]>>;
  const list = all[category];
  if (!list) return { ok: false, error: 'Brak kategorii' };
  const idx = list.findIndex((s) => s.id === stepId);
  if (idx < 0) return { ok: false, error: 'Brak kroku' };

  const buf = Buffer.from(await file.arrayBuffer());
  const att = await saveProductionAttachment(prod.slug, `custom-step-${stepId}`, file.name, buf);

  const next = list.slice();
  next[idx] = {
    ...next[idx],
    attachmentPath: att.relativePath,
    attachmentName: att.filename,
    attachmentSize: att.size,
  };
  await saveCustomSteps(productionId, { ...all, [category]: next });
  return { ok: true };
}

export async function removeCustomStepAttachment(
  productionId: number,
  category: ProductionStage,
  stepId: string,
): Promise<Result> {
  const prod = await loadProduction(productionId);
  if (!prod) return { ok: false, error: 'Brak produkcji' };
  const all = (prod.customSteps ?? {}) as Partial<Record<ProductionStage, CustomStep[]>>;
  const list = all[category];
  if (!list) return { ok: false, error: 'Brak kategorii' };
  const idx = list.findIndex((s) => s.id === stepId);
  if (idx < 0) return { ok: false, error: 'Brak kroku' };
  const next = list.slice();
  // Note: we leave the file on disk (low risk; if user wants hard-delete we can
  // add another action). Just clear the pointer.
  const { attachmentPath: _p, attachmentName: _n, attachmentSize: _s, ...rest } = next[idx];
  void _p;
  void _n;
  void _s;
  next[idx] = rest;
  await saveCustomSteps(productionId, { ...all, [category]: next });
  return { ok: true };
}

/**
 * Sequential cascade — pipeline steps must be completed in order. Click
 * semantics on the calendar/pipeline:
 *   • clicking a NOT-DONE step  → mark it + every step before it as DONE
 *   • clicking a DONE step      → unmark it + every step after it
 * "Steps" includes both canonicals (which map to ProductionStatus) and
 * user-added customs (which carry their own `doneAt`).
 *
 * `target` identifies the step the user clicked. `mode`:
 *   • 'mark'   → cascade forward: target + everything before it = DONE
 *   • 'unmark' → cascade backward: target + everything after it = NOT DONE
 *
 * The function rebuilds the global step sequence (categories in fixed order,
 * each category resolved via storedOrder/positionAfter), applies the cascade,
 * and writes status + customSteps in a single update.
 */
export type CascadeTarget =
  | { kind: 'canonical'; stage: ProductionStatus }
  | { kind: 'custom'; category: ProductionStage; stepId: string };

const STAGE_INDEX_LOOKUP: Record<ProductionStatus, number> = Object.fromEntries(
  PRODUCTION_PROGRESSION.map((s, i) => [s, i]),
) as Record<ProductionStatus, number>;

export async function cascadeStepsTo(
  productionId: number,
  target: CascadeTarget,
  mode: 'mark' | 'unmark',
): Promise<Result> {
  const prod = await loadProduction(productionId);
  if (!prod) return { ok: false, error: 'Brak produkcji' };
  if (prod.status === 'cancelled') return { ok: false, error: 'Produkcja anulowana' };

  const customsAll = (prod.customSteps ?? {}) as Partial<
    Record<ProductionStage, CustomStep[]>
  >;
  const orderAll = (prod.stepOrder ?? {}) as Partial<
    Record<ProductionStage, string[]>
  >;

  type FlatStep =
    | { kind: 'canonical'; stage: ProductionStatus }
    | { kind: 'custom'; category: ProductionStage; stepId: string };
  const flat: FlatStep[] = [];
  for (const cat of PRODUCTION_STAGES) {
    const customs = customsAll[cat] ?? [];
    const seq = resolveCategorySequence(cat, customs, orderAll[cat]);
    for (const it of seq) {
      if (it.kind === 'canonical') flat.push({ kind: 'canonical', stage: it.stage });
      else flat.push({ kind: 'custom', category: cat, stepId: it.step.id });
    }
  }

  const targetIdx = flat.findIndex((s) => {
    if (target.kind === 'canonical' && s.kind === 'canonical') return s.stage === target.stage;
    if (target.kind === 'custom' && s.kind === 'custom')
      return s.category === target.category && s.stepId === target.stepId;
    return false;
  });
  if (targetIdx < 0) return { ok: false, error: 'Brak kroku' };

  // Mark cascade: lastDoneIdx = targetIdx (everything ≤ target = done).
  // Unmark cascade: lastDoneIdx = targetIdx - 1 (everything ≥ target = not done).
  const lastDoneIdx = mode === 'mark' ? targetIdx : targetIdx - 1;

  // 1) Resolve canonical status from cascade. The new status is the
  //    canonical step at lastDoneIdx if it's canonical, else the highest
  //    canonical with index ≤ lastDoneIdx (so customs after a canonical
  //    don't advance the production beyond that canonical).
  let newStatus: ProductionStatus = 'email-sent';
  let highestCanonicalDoneIdx = -1;
  for (let i = 0; i <= lastDoneIdx; i++) {
    const step = flat[i];
    if (step.kind === 'canonical') {
      const sIdx = STAGE_INDEX_LOOKUP[step.stage];
      if (sIdx > highestCanonicalDoneIdx) highestCanonicalDoneIdx = sIdx;
    }
  }
  // If at least one canonical is "done", status should advance ONE past it
  // (i.e. the next canonical is the active "in progress" one). If the highest
  // done canonical is the last one (publishing), keep status at publishing.
  // If no canonical done, status is email-sent (the implicit starting "active" step).
  if (highestCanonicalDoneIdx >= 0) {
    const nextIdx = Math.min(highestCanonicalDoneIdx + 1, PRODUCTION_PROGRESSION.length - 1);
    newStatus = PRODUCTION_PROGRESSION[nextIdx];
  } else {
    newStatus = 'email-sent';
  }

  // 2) Build new customSteps with doneAt set/cleared per cascade.
  const stamp = new Date().toISOString();
  const nextCustomsAll: Partial<Record<ProductionStage, CustomStep[]>> = { ...customsAll };
  for (const cat of PRODUCTION_STAGES) {
    const list = customsAll[cat];
    if (!list || list.length === 0) continue;
    const updated = list.map((c) => {
      const idx = flat.findIndex(
        (s) => s.kind === 'custom' && s.category === cat && s.stepId === c.id,
      );
      if (idx < 0) return c;
      const shouldBeDone = idx <= lastDoneIdx;
      if (shouldBeDone && !c.doneAt) return { ...c, doneAt: stamp };
      if (!shouldBeDone && c.doneAt) return { ...c, doneAt: null };
      return c;
    });
    nextCustomsAll[cat] = updated;
  }

  await db
    .update(schema.productions)
    .set({ status: newStatus, customSteps: nextCustomsAll })
    .where(eq(schema.productions.id, productionId));
  bumpRevalidate(productionId);
  return { ok: true };
}

// Suppress unused-import lint when linting in isolation
void PRODUCTION_STAGES;
