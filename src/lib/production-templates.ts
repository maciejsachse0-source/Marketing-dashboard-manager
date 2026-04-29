import 'server-only';
import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import {
  PRODUCTION_STAGES,
  PRODUCTION_STATUSES,
  PRODUCTION_TYPES,
} from '../../drizzle/schema';
import type { ProductionTemplate } from './production-templates-types';

/**
 * Production template — a recipe that pre-populates a new production with
 * extra custom steps inside the canonical 9-step pipeline. Every template
 * keeps the canonical steps (email-sent → publishing). Differences live in
 * the `customSteps` array: each entry is inserted into a category at a
 * chosen anchor (`positionAfter`).
 *
 * Templates live as JSON files under data/templates/ and are read on every
 * request — same hot-reload pattern as agents, no cache busting.
 *
 * Public API:
 *   - `loadTemplates()` — read+validate every JSON in data/templates/
 *   - `getTemplate(slug)` — single template by slug, or undefined
 *   - `templateFilePath(slug)` — helper for CRUD actions
 *   - `productionTemplateSchema` — Zod schema for validation in CRUD actions
 *
 * Helpers like `templatesForType` / `defaultTemplateFor` live as locals in
 * client components — this file is `server-only` and clients can't import it.
 */
const productionStageSchema = z.enum(PRODUCTION_STAGES);
// Status enum sans `cancelled` — templates never anchor on the cancellation
// terminal state (no canonical pipeline category contains it).
const productionStatusSchema = z.enum(
  PRODUCTION_STATUSES.filter((s) => s !== 'cancelled') as readonly [string, ...string[]],
);
const productionTypeSchema = z.enum(PRODUCTION_TYPES);

const templateCustomStepSchema = z.object({
  category: productionStageSchema,
  label: z.string().min(1).max(80),
  positionAfter: productionStatusSchema,
  description: z.string().max(500).optional(),
});

export const productionTemplateSchema = z.object({
  slug: z
    .string()
    .min(1)
    .max(60)
    .regex(/^[a-z0-9-]+$/, 'slug: tylko małe litery, cyfry i myślnik'),
  name: z.string().min(1).max(80),
  type: productionTypeSchema,
  summary: z.string().min(1).max(160),
  description: z.string().min(1).max(1000),
  customSteps: z.array(templateCustomStepSchema).max(20),
});

export type { TemplateCustomStep, ProductionTemplate } from './production-templates-types';

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
