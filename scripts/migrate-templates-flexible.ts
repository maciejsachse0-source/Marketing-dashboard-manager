/**
 * One-shot migration: convert old-format templates (canonical 9 steps implied
 * + customSteps[] with positionAfter anchors) into the new flexible-steps
 * model where each template owns a flat `steps[]` list.
 *
 * Behaviour:
 *  - Reads every JSON in data/templates/ in the LEGACY format.
 *  - Writes the same files in the NEW format. Old files backed up to
 *    data/templates/_backup-pre-flexible/.
 *  - Idempotent: if a template already has `steps[]`, it's skipped.
 *
 * Run: `npx tsx scripts/migrate-templates-flexible.ts`
 */
import fs from 'node:fs';
import path from 'node:path';

const TEMPLATES_DIR = path.join(process.cwd(), 'data', 'templates');
const BACKUP_DIR = path.join(TEMPLATES_DIR, '_backup-pre-flexible');

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
  | 'publishing';

type StepDateMode = 'none' | 'record' | 'calendar' | 'derived-from-shooting';
type StepCalendarType = 'shoot' | 'edit' | 'meeting' | 'deadline';

type LegacyCustomStep = {
  category: ProductionStage;
  label: string;
  positionAfter: ProductionStatus;
  description?: string;
};

type LegacyTemplate = {
  slug: string;
  name: string;
  type: 'with-artist' | 'solo';
  summary: string;
  description: string;
  customSteps: LegacyCustomStep[];
};

type NewTemplateStep = {
  id: string;
  category: ProductionStage;
  label: string;
  description?: string;
  dateMode?: StepDateMode;
  durationMinutes?: number;
  calendarType?: StepCalendarType;
  isT0Anchor?: boolean;
};

type NewTemplate = {
  slug: string;
  name: string;
  type: 'with-artist' | 'solo';
  summary: string;
  description: string;
  steps: NewTemplateStep[];
};

const CANONICAL_STAGES_BY_CATEGORY: Record<ProductionStage, ProductionStatus[]> = {
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

/** Default user-facing labels for the 9 canonical sub-stages. */
const STAGE_LABEL: Record<ProductionStatus, string> = {
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

const STAGE_HINT: Partial<Record<ProductionStatus, string>> = {
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

/** Date-mode + calendar config per canonical step — derived from the existing
 *  CALENDAR_STAGES table in `production-step-dates.ts` and the dateMode rules
 *  in `productions/[id]/page.tsx` so behavior survives the migration. */
const CANONICAL_CONFIG: Record<
  ProductionStatus,
  Pick<
    NewTemplateStep,
    'dateMode' | 'durationMinutes' | 'calendarType' | 'isT0Anchor'
  >
> = {
  'email-sent': { dateMode: 'record' },
  'terms-accepted': { dateMode: 'record' },
  'cam-meeting-set': { dateMode: 'record' },
  'cam-date-shared': { dateMode: 'calendar', durationMinutes: 30, calendarType: 'meeting' },
  'script-discussed': { dateMode: 'calendar', durationMinutes: 60, calendarType: 'meeting' },
  'script-sent': { dateMode: 'calendar', durationMinutes: 0, calendarType: 'deadline' },
  shooting: {
    dateMode: 'calendar',
    durationMinutes: 240,
    calendarType: 'shoot',
    isT0Anchor: true,
  },
  editing: {
    dateMode: 'derived-from-shooting',
    durationMinutes: 240,
    calendarType: 'edit',
  },
  publishing: { dateMode: 'none' },
};

function buildCanonicalStep(stage: ProductionStatus, category: ProductionStage): NewTemplateStep {
  const config = CANONICAL_CONFIG[stage];
  const step: NewTemplateStep = {
    id: stage, // stable id matching the legacy enum value — preserved across migrations
    category,
    label: STAGE_LABEL[stage],
    ...config,
  };
  const hint = STAGE_HINT[stage];
  if (hint) step.description = hint;
  return step;
}

function migrateTemplate(legacy: LegacyTemplate): NewTemplate {
  const customsByCategory = new Map<ProductionStage, LegacyCustomStep[]>();
  for (const cat of CATEGORY_ORDER) customsByCategory.set(cat, []);
  for (const c of legacy.customSteps) {
    customsByCategory.get(c.category)!.push(c);
  }

  const steps: NewTemplateStep[] = [];
  for (const cat of CATEGORY_ORDER) {
    const canonicals = CANONICAL_STAGES_BY_CATEGORY[cat];
    const customs = customsByCategory.get(cat) ?? [];
    const canonicalSet = new Set<string>(canonicals);
    const fallback = canonicals[canonicals.length - 1];
    const customsByAnchor = new Map<ProductionStatus, LegacyCustomStep[]>();
    for (const c of customs) {
      const anchor = canonicalSet.has(c.positionAfter) ? c.positionAfter : fallback;
      const arr = customsByAnchor.get(anchor) ?? [];
      arr.push(c);
      customsByAnchor.set(anchor, arr);
    }

    for (const stage of canonicals) {
      steps.push(buildCanonicalStep(stage, cat));
      for (const c of customsByAnchor.get(stage) ?? []) {
        const customStep: NewTemplateStep = {
          id: `custom-${legacy.slug}-${steps.length}`,
          category: cat,
          label: c.label,
          dateMode: 'none',
        };
        if (c.description) customStep.description = c.description;
        steps.push(customStep);
      }
    }
  }

  return {
    slug: legacy.slug,
    name: legacy.name,
    type: legacy.type,
    summary: legacy.summary,
    description: legacy.description,
    steps,
  };
}

function isAlreadyNewFormat(parsed: unknown): boolean {
  return (
    typeof parsed === 'object' &&
    parsed !== null &&
    Array.isArray((parsed as { steps?: unknown }).steps)
  );
}

function main() {
  if (!fs.existsSync(TEMPLATES_DIR)) {
    console.log('[migrate-templates] no templates dir, nothing to do');
    return;
  }
  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });

  const files = fs
    .readdirSync(TEMPLATES_DIR)
    .filter((f) => f.endsWith('.json'));

  let migrated = 0;
  let skipped = 0;

  for (const file of files) {
    const filePath = path.join(TEMPLATES_DIR, file);
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw) as unknown;

    if (isAlreadyNewFormat(parsed)) {
      console.log(`[migrate-templates] ${file} already new format — skipping`);
      skipped++;
      continue;
    }

    const legacy = parsed as LegacyTemplate;
    fs.writeFileSync(path.join(BACKUP_DIR, file), raw, 'utf8');

    const next = migrateTemplate(legacy);
    fs.writeFileSync(filePath, JSON.stringify(next, null, 2) + '\n', 'utf8');

    console.log(
      `[migrate-templates] ${file}: ${legacy.customSteps.length} customs + 9 canonicals → ${next.steps.length} steps`,
    );
    migrated++;
  }

  console.log(
    `[migrate-templates] done. migrated=${migrated} skipped=${skipped} backup=${BACKUP_DIR}`,
  );
}

main();
