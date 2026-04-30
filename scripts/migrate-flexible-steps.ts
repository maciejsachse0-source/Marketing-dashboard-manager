/**
 * One-shot data migration: backfill `productions.steps[]` and
 * `productions.cancelledAt` from the legacy fields (status + stepDates +
 * customSteps + stepOrder).
 *
 * Behaviour:
 *  - Runs over every row in `productions`. Idempotent: skips rows that
 *    already have a non-null `steps` JSON.
 *  - Builds the merged canonical+custom sequence using the same rules as
 *    `resolveCategorySequence` so the on-screen order doesn't change.
 *  - For each canonical step: copies `stepDates[stage]` → `dateIso`,
 *    `doneAt` from the position of `status` in `PRODUCTION_PROGRESSION`.
 *  - For each custom step: keeps id/label/description/attachments and
 *    `doneAt`. Marks `dateMode: 'none'` (customs had no date support).
 *  - `cancelled_at` set to row.created_at when status was 'cancelled'.
 *  - LEAVES the legacy columns intact — drop happens in a later phase
 *    after UI is fully on the new model.
 *
 * Run: `npx tsx scripts/migrate-flexible-steps.ts`
 */
import Database from 'better-sqlite3';
import path from 'node:path';

type ProductionStage =
  | 'outreach'
  | 'ustalenia'
  | 'nagrywanie'
  | 'obrobka'
  | 'publikacja';

type ProductionStatus =
  | 'email-sent'
  | 'terms-accepted'
  | 'cam-meeting-set'
  | 'cam-date-shared'
  | 'script-discussed'
  | 'script-sent'
  | 'shooting'
  | 'editing'
  | 'publishing'
  | 'cancelled';

type StepDateMode = 'none' | 'record' | 'calendar' | 'derived-from-shooting';
type StepCalendarType = 'shoot' | 'edit' | 'meeting' | 'deadline';

type LegacyCustomStep = {
  id: string;
  label: string;
  positionAfter?: ProductionStatus;
  doneAt: string | null;
  description?: string;
  attachmentPath?: string;
  attachmentName?: string;
  attachmentSize?: number;
};

type ProductionStep = {
  id: string;
  category: ProductionStage;
  label: string;
  description?: string;
  doneAt: string | null;
  dateIso?: string;
  dateMode?: StepDateMode;
  durationMinutes?: number;
  calendarType?: StepCalendarType;
  isT0Anchor?: boolean;
  attachmentPath?: string;
  attachmentName?: string;
  attachmentSize?: number;
};

const PRODUCTION_PROGRESSION: ProductionStatus[] = [
  'email-sent',
  'terms-accepted',
  'cam-meeting-set',
  'cam-date-shared',
  'script-discussed',
  'script-sent',
  'shooting',
  'editing',
  'publishing',
];

const CATEGORY_OF_STAGE: Record<Exclude<ProductionStatus, 'cancelled'>, ProductionStage> = {
  'email-sent': 'outreach',
  'terms-accepted': 'outreach',
  'cam-meeting-set': 'outreach',
  'cam-date-shared': 'ustalenia',
  'script-discussed': 'ustalenia',
  'script-sent': 'ustalenia',
  shooting: 'nagrywanie',
  editing: 'obrobka',
  publishing: 'publikacja',
};

const CANONICAL_STAGES_BY_CATEGORY: Record<ProductionStage, Exclude<ProductionStatus, 'cancelled'>[]> = {
  outreach: ['email-sent', 'terms-accepted', 'cam-meeting-set'],
  ustalenia: ['cam-date-shared', 'script-discussed', 'script-sent'],
  nagrywanie: ['shooting'],
  obrobka: ['editing'],
  publikacja: ['publishing'],
};

const CATEGORY_ORDER: ProductionStage[] = [
  'outreach',
  'ustalenia',
  'nagrywanie',
  'obrobka',
  'publikacja',
];

const STAGE_LABEL: Record<Exclude<ProductionStatus, 'cancelled'>, string> = {
  'email-sent': 'wysłanie maila',
  'terms-accepted': 'akceptacja warunków współpracy',
  'cam-meeting-set': 'ustalenie daty spotkania z kamerzystą',
  'cam-date-shared': 'przekazanie daty spotkania',
  'script-discussed': 'omówienie scenariusza z kamerzystą',
  'script-sent': 'wysłanie scenariusza',
  shooting: 'nagrywki',
  editing: 'obróbka',
  publishing: 'publikacja',
};

const STAGE_HINT: Partial<Record<Exclude<ProductionStatus, 'cancelled'>, string>> = {
  'email-sent': 'Cold mail / DM z propozycją współpracy.',
  'terms-accepted': 'Artysta zgodził się na warunki — termin, lokację, zakres.',
  'cam-meeting-set': 'Ustalona konkretna data spotkania z kamerzystą.',
  'cam-date-shared': 'Data przekazana kamerzyście — gotowy w terminarzu.',
  'script-discussed': 'Omówienie scenariusza, ujęć, sprzętu.',
  'script-sent': 'Final scenariusz wysłany do kamerzysty + artysty.',
  shooting: 'W studio / w terenie. Nagranie głównego materiału + BTS.',
  editing: 'Selekcja ujęć, montaż, color grading, audio mix.',
  publishing: 'Manualny upload na platformy (IG, TT, YT).',
};

const CANONICAL_CONFIG: Record<
  Exclude<ProductionStatus, 'cancelled'>,
  Pick<ProductionStep, 'dateMode' | 'durationMinutes' | 'calendarType' | 'isT0Anchor'>
> = {
  'email-sent': { dateMode: 'record' },
  'terms-accepted': { dateMode: 'record' },
  'cam-meeting-set': { dateMode: 'record' },
  'cam-date-shared': { dateMode: 'calendar', durationMinutes: 30, calendarType: 'meeting' },
  'script-discussed': { dateMode: 'calendar', durationMinutes: 60, calendarType: 'meeting' },
  'script-sent': { dateMode: 'calendar', durationMinutes: 0, calendarType: 'deadline' },
  shooting: { dateMode: 'calendar', durationMinutes: 240, calendarType: 'shoot', isT0Anchor: true },
  editing: { dateMode: 'derived-from-shooting', durationMinutes: 240, calendarType: 'edit' },
  publishing: { dateMode: 'none' },
};

type SequenceItem =
  | { kind: 'canonical'; key: string; stage: Exclude<ProductionStatus, 'cancelled'> }
  | { kind: 'custom'; key: string; step: LegacyCustomStep };

/** Mirror of resolveCategorySequence — replicated here so the script doesn't
 *  depend on TS source from src/. */
function resolveCategorySequence(
  category: ProductionStage,
  customs: LegacyCustomStep[],
  storedOrder: string[] | undefined,
): SequenceItem[] {
  const canonicals = CANONICAL_STAGES_BY_CATEGORY[category];
  const canonicalSet = new Set<string>(canonicals);
  const customById = new Map(customs.map((c) => [c.id, c] as const));

  if (storedOrder && storedOrder.length > 0) {
    const seen = new Set<string>();
    const items: SequenceItem[] = [];
    for (const key of storedOrder) {
      if (seen.has(key)) continue;
      if (canonicalSet.has(key)) {
        items.push({
          kind: 'canonical',
          key,
          stage: key as Exclude<ProductionStatus, 'cancelled'>,
        });
        seen.add(key);
      } else {
        const c = customById.get(key);
        if (c) {
          items.push({ kind: 'custom', key, step: c });
          seen.add(key);
        }
      }
    }
    for (const stage of canonicals) {
      if (!seen.has(stage)) items.push({ kind: 'canonical', key: stage, stage });
    }
    for (const c of customs) {
      if (!seen.has(c.id)) items.push({ kind: 'custom', key: c.id, step: c });
    }
    return items;
  }

  const fallback = canonicals[canonicals.length - 1];
  const customsByAfter = new Map<string, LegacyCustomStep[]>();
  for (const c of customs) {
    const after =
      c.positionAfter && canonicalSet.has(c.positionAfter) ? c.positionAfter : fallback;
    const arr = customsByAfter.get(after) ?? [];
    arr.push(c);
    customsByAfter.set(after, arr);
  }
  const items: SequenceItem[] = [];
  for (const stage of canonicals) {
    items.push({ kind: 'canonical', key: stage, stage });
    for (const c of customsByAfter.get(stage) ?? []) {
      items.push({ kind: 'custom', key: c.id, step: c });
    }
  }
  return items;
}

function buildSteps(row: {
  status: ProductionStatus;
  stepDates: Partial<Record<Exclude<ProductionStatus, 'cancelled'>, string>>;
  customSteps: Partial<Record<ProductionStage, LegacyCustomStep[]>>;
  stepOrder: Partial<Record<ProductionStage, string[]>>;
}): ProductionStep[] {
  const isCancelled = row.status === 'cancelled';
  const statusIdx = isCancelled ? -1 : PRODUCTION_PROGRESSION.indexOf(row.status);

  const steps: ProductionStep[] = [];
  for (const cat of CATEGORY_ORDER) {
    const customs = row.customSteps[cat] ?? [];
    const order = row.stepOrder[cat];
    const seq = resolveCategorySequence(cat, customs, order);

    for (const item of seq) {
      if (item.kind === 'canonical') {
        const stage = item.stage;
        const cfg = CANONICAL_CONFIG[stage];
        const stageIdx = PRODUCTION_PROGRESSION.indexOf(stage);
        // Cancelled productions: nothing is "done"; otherwise everything BEFORE
        // the current status is done. The current status step is "active" — left
        // not-done so the user can finish it.
        const doneAt = !isCancelled && stageIdx < statusIdx
          ? new Date(0).toISOString().replace('1970-01-01', '2000-01-01')
          : null;

        const step: ProductionStep = {
          id: stage,
          category: cat,
          label: STAGE_LABEL[stage],
          doneAt,
          ...cfg,
        };
        const hint = STAGE_HINT[stage];
        if (hint) step.description = hint;
        const dateIso = row.stepDates?.[stage];
        if (dateIso) step.dateIso = dateIso;
        steps.push(step);
      } else {
        const c = item.step;
        // For custom steps, doneAt was tracked per-step independently of status.
        const step: ProductionStep = {
          id: c.id,
          category: cat,
          label: c.label,
          doneAt: c.doneAt ?? null,
          dateMode: 'none',
        };
        if (c.description) step.description = c.description;
        if (c.attachmentPath) step.attachmentPath = c.attachmentPath;
        if (c.attachmentName) step.attachmentName = c.attachmentName;
        if (c.attachmentSize !== undefined) step.attachmentSize = c.attachmentSize;
        steps.push(step);
      }
    }
  }
  return steps;
}

function main() {
  const dbPath = path.join(process.cwd(), 'data', 'marketing-crew.db');
  const db = new Database(dbPath);

  const rows = db
    .prepare(
      `SELECT id, slug, status, step_dates, custom_steps, step_order, steps, created_at
       FROM productions`,
    )
    .all() as Array<{
    id: number;
    slug: string;
    status: ProductionStatus;
    step_dates: string | null;
    custom_steps: string | null;
    step_order: string | null;
    steps: string | null;
    created_at: number;
  }>;

  let migrated = 0;
  let skipped = 0;

  const update = db.prepare(
    `UPDATE productions
     SET steps = ?, cancelled_at = ?
     WHERE id = ?`,
  );

  for (const r of rows) {
    if (r.steps) {
      console.log(`[migrate-prod] #${r.id} ${r.slug}: already has steps — skipping`);
      skipped++;
      continue;
    }
    const stepDates = r.step_dates ? (JSON.parse(r.step_dates) as Partial<Record<Exclude<ProductionStatus, 'cancelled'>, string>>) : {};
    const customSteps = r.custom_steps ? (JSON.parse(r.custom_steps) as Partial<Record<ProductionStage, LegacyCustomStep[]>>) : {};
    const stepOrder = r.step_order ? (JSON.parse(r.step_order) as Partial<Record<ProductionStage, string[]>>) : {};

    const steps = buildSteps({
      status: r.status,
      stepDates,
      customSteps,
      stepOrder,
    });

    const cancelledAt = r.status === 'cancelled' ? r.created_at : null;

    update.run(JSON.stringify(steps), cancelledAt, r.id);
    console.log(
      `[migrate-prod] #${r.id} ${r.slug} status=${r.status} → ${steps.length} steps, cancelledAt=${cancelledAt}`,
    );
    migrated++;
  }

  console.log(`[migrate-prod] done. migrated=${migrated} skipped=${skipped}`);
  db.close();
}

main();
