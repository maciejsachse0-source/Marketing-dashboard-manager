import 'server-only';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { periodsSchema } from './production-periods';
import type { MarketingTemplate } from './campaign-templates-types';
import { db, schema } from './db';

/**
 * Marketing-campaign templates — siblings of production templates but with a
 * different shape. Lives in the `marketing_templates` Postgres table (was
 * `data/campaign-templates/*.json` before the Vercel migration).
 *
 * Public API (preserved):
 *   - `loadMarketingTemplates()` — read+validate every row
 *   - `getMarketingTemplate(slug)` — single by slug
 *   - `marketingTemplateSchema` — Zod schema for validation
 */

const submilestoneSchema = z.object({
  id: z.string().min(1).max(80),
  label: z.string().min(1).max(120),
  description: z.string().max(1000).optional(),
});

const milestoneSchema = z.object({
  id: z.string().min(1).max(80),
  period: z.string().regex(/^T[1-9]\d?$/, 'Kod okresu musi być w formacie T1, T2, …'),
  label: z.string().min(1).max(120),
  description: z.string().max(1000).optional(),
  submilestones: z.array(submilestoneSchema).max(40),
});

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
    const ids = new Set<string>();
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

function rowToTemplate(row: typeof schema.marketingTemplates.$inferSelect): MarketingTemplate {
  const candidate = {
    slug: row.slug,
    name: row.name,
    summary: row.summary,
    description: row.description,
    periods: row.periods ?? undefined,
    milestones: row.milestones,
  };
  const result = marketingTemplateSchema.safeParse(candidate);
  if (!result.success) {
    throw new Error(
      `Campaign template "${row.slug}" w bazie nie przeszedł walidacji: ${result.error.issues
        .map((i) => `${i.path.join('.')}: ${i.message}`)
        .join('; ')}`,
    );
  }
  return result.data;
}

export async function loadMarketingTemplates(): Promise<MarketingTemplate[]> {
  const rows = await db.query.marketingTemplates.findMany({
    orderBy: schema.marketingTemplates.slug,
  });
  return rows.map(rowToTemplate);
}

export async function getMarketingTemplate(slug: string): Promise<MarketingTemplate | undefined> {
  const row = await db.query.marketingTemplates.findFirst({
    where: eq(schema.marketingTemplates.slug, slug),
  });
  return row ? rowToTemplate(row) : undefined;
}
