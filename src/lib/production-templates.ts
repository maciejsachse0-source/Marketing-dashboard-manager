import 'server-only';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import {
  PRODUCTION_STAGES,
  PRODUCTION_TYPES,
  STEP_DATE_MODES,
} from '../../drizzle/schema';
import type { ProductionTemplate } from './production-templates-types';
import { periodsSchema } from './production-periods';
import { db, schema } from './db';

/**
 * Production template — a recipe that defines the complete step list for new
 * productions. Lives in the `production_templates` Postgres table (was
 * `data/templates/*.json` before the Vercel migration).
 *
 * Public API (preserved):
 *   - `loadTemplates()` — read+validate every row
 *   - `getTemplate(slug)` — single template by slug, or undefined
 *   - `productionTemplateSchema` — Zod schema for validation in CRUD actions
 */
const productionStageSchema = z.enum(PRODUCTION_STAGES);
const productionTypeSchema = z.enum(PRODUCTION_TYPES);
const stepDateModeSchema = z.enum(STEP_DATE_MODES);
const stepCalendarTypeSchema = z.enum(['shoot', 'edit', 'meeting', 'deadline']);

const templateStepSchema = z.object({
  id: z.string().min(1).max(80),
  category: productionStageSchema,
  label: z.string().min(1).max(80),
  description: z.string().max(1000).optional(),
  dateMode: stepDateModeSchema.optional(),
  durationMinutes: z.number().int().min(0).max(60 * 24).optional(),
  calendarType: stepCalendarTypeSchema.optional(),
});

/** Plain object shape — kept un-refined so callers (e.g. CRUD form input)
 *  can `.extend()` it without hitting the Zod `safeExtend`-on-effects error. */
export const productionTemplateBaseSchema = z.object({
  slug: z
    .string()
    .min(1)
    .max(60)
    .regex(/^[a-z0-9-]+$/, 'slug: tylko małe litery, cyfry i myślnik'),
  name: z.string().min(1).max(80),
  type: productionTypeSchema,
  summary: z.string().min(1).max(160),
  description: z.string().min(1).max(1000),
  steps: z.array(templateStepSchema).min(1).max(40),
  periods: periodsSchema.optional(),
});

export const productionTemplateSchema = productionTemplateBaseSchema
  .superRefine((tpl, ctx) => {
    const ids = new Set<string>();
    for (const [i, s] of tpl.steps.entries()) {
      if (ids.has(s.id)) {
        ctx.addIssue({
          code: 'custom',
          message: `Duplikujący się id kroku: ${s.id}`,
          path: ['steps', i, 'id'],
        });
      }
      ids.add(s.id);
    }
  });

export type { TemplateStep, ProductionTemplate, TemplateCustomStep } from './production-templates-types';

function rowToTemplate(row: typeof schema.productionTemplates.$inferSelect): ProductionTemplate {
  const candidate = {
    slug: row.slug,
    name: row.name,
    type: row.type,
    summary: row.summary,
    description: row.description,
    steps: row.steps,
    periods: row.periods ?? undefined,
  };
  const result = productionTemplateSchema.safeParse(candidate);
  if (!result.success) {
    throw new Error(
      `Production template "${row.slug}" w bazie nie przeszedł walidacji: ${result.error.issues
        .map((i) => `${i.path.join('.')}: ${i.message}`)
        .join('; ')}`,
    );
  }
  return result.data;
}

export async function loadTemplates(): Promise<ProductionTemplate[]> {
  const rows = await db.query.productionTemplates.findMany({
    orderBy: schema.productionTemplates.slug,
  });
  return rows.map(rowToTemplate);
}

export async function getTemplate(slug: string): Promise<ProductionTemplate | undefined> {
  const row = await db.query.productionTemplates.findFirst({
    where: eq(schema.productionTemplates.slug, slug),
  });
  return row ? rowToTemplate(row) : undefined;
}
