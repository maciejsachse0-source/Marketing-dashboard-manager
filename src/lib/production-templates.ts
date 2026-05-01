import 'server-only';
import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import {
  PRODUCTION_STAGES,
  PRODUCTION_TYPES,
  STEP_DATE_MODES,
} from '../../drizzle/schema';
import type { ProductionTemplate } from './production-templates-types';
import { periodsSchema } from './production-periods';

/**
 * Production template — a recipe that defines the complete step list for new
 * productions. After the flexible-steps refactor, templates own a flat
 * `steps[]` array (no more implicit canonical 9-step base + customSteps[]).
 *
 * Templates live as JSON files under data/templates/ and are read on every
 * request — same hot-reload pattern as agents, no cache busting.
 *
 * Public API:
 *   - `loadTemplates()` — read+validate every JSON in data/templates/
 *   - `getTemplate(slug)` — single template by slug, or undefined
 *   - `templateFilePath(slug)` — helper for CRUD actions
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
    // Step ids must be unique within a template — they're used as React keys
    // and as anchors in `productions.steps[]`, so collisions would cause
    // silent overwrite bugs.
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

const TEMPLATES_DIR = path.join(process.cwd(), 'data', 'templates');

export function templateFilePath(slug: string): string {
  return path.join(TEMPLATES_DIR, `${slug}.json`);
}

export function loadTemplates(): ProductionTemplate[] {
  if (!fs.existsSync(TEMPLATES_DIR)) return [];
  const files = fs
    .readdirSync(TEMPLATES_DIR)
    .filter((f) => f.endsWith('.json'))
    .sort();
  const templates: ProductionTemplate[] = [];
  for (const file of files) {
    const raw = fs.readFileSync(path.join(TEMPLATES_DIR, file), 'utf8');
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      throw new Error(`Template JSON ${file} jest niepoprawny: ${(e as Error).message}`);
    }
    const result = productionTemplateSchema.safeParse(parsed);
    if (!result.success) {
      throw new Error(
        `Template JSON ${file} nie przeszedł walidacji: ${result.error.issues
          .map((i) => `${i.path.join('.')}: ${i.message}`)
          .join('; ')}`,
      );
    }
    const expectedSlug = file.replace(/\.json$/, '');
    if (result.data.slug !== expectedSlug) {
      throw new Error(
        `Template JSON ${file} ma slug "${result.data.slug}", oczekiwano "${expectedSlug}".`,
      );
    }
    templates.push(result.data);
  }
  return templates;
}

export function getTemplate(slug: string): ProductionTemplate | undefined {
  return loadTemplates().find((t) => t.slug === slug);
}
