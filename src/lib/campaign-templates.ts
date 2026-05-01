import 'server-only';
import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { periodsSchema } from './production-periods';
import type { MarketingTemplate } from './campaign-templates-types';

/**
 * Marketing-campaign templates — siblings of production templates but with a
 * different shape: instead of a flat step list bucketed by category, each
 * template owns a list of MAIN milestones bucketed by T-period (T1/T2/T3),
 * each with any number of submilestones.
 *
 * Same hot-reload pattern as agents and production templates — JSON files in
 * data/campaign-templates/, read on every request.
 *
 * Public API:
 *   - `loadMarketingTemplates()` — read+validate every JSON
 *   - `getMarketingTemplate(slug)` — single by slug
 *   - `marketingTemplateFilePath(slug)` — helper for CRUD actions
 *   - `marketingTemplateSchema` — Zod schema for validation
 */

const submilestoneSchema = z.object({
  id: z.string().min(1).max(80),
  label: z.string().min(1).max(120),
  description: z.string().max(1000).optional(),
});

const milestoneSchema = z.object({
  id: z.string().min(1).max(80),
  /** Period code — must match one of the template's periods (T1..Tn). The
   *  superRefine on the parent template cross-validates the reference. */
  period: z.string().regex(/^T[1-9]\d?$/, 'Kod okresu musi być w formacie T1, T2, …'),
  label: z.string().min(1).max(120),
  description: z.string().max(1000).optional(),
  submilestones: z.array(submilestoneSchema).max(40),
});

/** Plain object shape — kept un-refined so callers (e.g. CRUD form input)
 *  can `.extend()` it without hitting the Zod `safeExtend`-on-effects error. */
export const marketingTemplateBaseSchema = z.object({
  slug: z
    .string()
    .min(1)
    .max(60)
    .regex(/^[a-z0-9-]+$/, 'slug: tylko małe litery, cyfry i myślnik'),
  name: z.string().min(1).max(80),
  summary: z.string().min(1).max(200),
  description: z.string().min(1).max(2000),
  periods: periodsSchema.optional(),
  milestones: z.array(milestoneSchema).min(1).max(40),
});

export const marketingTemplateSchema = marketingTemplateBaseSchema
  .superRefine((tpl, ctx) => {
    // Milestone IDs must be globally unique within the template — they're used
    // as React keys and as anchors in the campaign's cloned milestones array.
    const ids = new Set<string>();
    // Build the legal period-code set from the template's `periods`. Falls
    // back to the default 3-period codes if periods aren't defined, so legacy
    // templates with a hardcoded T1/T2/T3 milestone bucket still validate.
    const validCodes = new Set<string>(
      tpl.periods && tpl.periods.length > 0
        ? tpl.periods.map((p) => p.code)
        : ['T1', 'T2', 'T3'],
    );
    for (const [i, m] of tpl.milestones.entries()) {
      if (ids.has(m.id)) {
        ctx.addIssue({
          code: 'custom',
          message: `Duplikujący się id kamienia milowego: ${m.id}`,
          path: ['milestones', i, 'id'],
        });
      }
      ids.add(m.id);
      if (!validCodes.has(m.period)) {
        ctx.addIssue({
          code: 'custom',
          message: `Milestone "${m.label || m.id}" wskazuje na okres ${m.period}, którego nie ma w szablonie (dostępne: ${[...validCodes].join(', ')}).`,
          path: ['milestones', i, 'period'],
        });
      }
      // Submilestone IDs must be unique within their parent milestone (allowed
      // to repeat across siblings — they're scoped under the parent).
      const subIds = new Set<string>();
      for (const [j, s] of m.submilestones.entries()) {
        if (subIds.has(s.id)) {
          ctx.addIssue({
            code: 'custom',
            message: `Duplikujący się id submilestone: ${s.id}`,
            path: ['milestones', i, 'submilestones', j, 'id'],
          });
        }
        subIds.add(s.id);
      }
    }
  });

export type { MarketingTemplate, MarketingMilestone, MarketingSubmilestone } from './campaign-templates-types';

const TEMPLATES_DIR = path.join(process.cwd(), 'data', 'campaign-templates');

export function marketingTemplateFilePath(slug: string): string {
  return path.join(TEMPLATES_DIR, `${slug}.json`);
}

export function loadMarketingTemplates(): MarketingTemplate[] {
  if (!fs.existsSync(TEMPLATES_DIR)) return [];
  const files = fs
    .readdirSync(TEMPLATES_DIR)
    .filter((f) => f.endsWith('.json'))
    .sort();
  const out: MarketingTemplate[] = [];
  for (const file of files) {
    const raw = fs.readFileSync(path.join(TEMPLATES_DIR, file), 'utf8');
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      throw new Error(`Campaign template JSON ${file} jest niepoprawny: ${(e as Error).message}`);
    }
    const result = marketingTemplateSchema.safeParse(parsed);
    if (!result.success) {
      throw new Error(
        `Campaign template ${file} nie przeszedł walidacji: ${result.error.issues
          .map((i) => `${i.path.join('.')}: ${i.message}`)
          .join('; ')}`,
      );
    }
    const expected = file.replace(/\.json$/, '');
    if (result.data.slug !== expected) {
      throw new Error(
        `Campaign template ${file} ma slug "${result.data.slug}", oczekiwano "${expected}".`,
      );
    }
    out.push(result.data);
  }
  return out;
}

export function getMarketingTemplate(slug: string): MarketingTemplate | undefined {
  return loadMarketingTemplates().find((t) => t.slug === slug);
}
