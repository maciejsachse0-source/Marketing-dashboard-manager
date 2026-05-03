'use server';

import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { safeRevalidatePath as revalidatePath } from './revalidate';
import {
  getMarketingTemplate,
  marketingTemplateBaseSchema,
  marketingTemplateSchema,
} from '@/lib/campaign-templates';
import type { MarketingTemplate } from '@/lib/campaign-templates-types';
import { db, schema } from '@/lib/db';
import { requireSession } from '@/lib/auth';

function safeSlug(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

const formInputSchema = marketingTemplateBaseSchema.extend({
  slug: z
    .string()
    .max(60)
    .regex(/^[a-z0-9-]*$/, 'tylko małe litery, cyfry i myślnik')
    .optional()
    .or(z.literal('')),
});

export type MarketingTemplateFormInput = z.input<typeof formInputSchema>;

async function upsertTemplate(t: MarketingTemplate) {
  await db
    .insert(schema.marketingTemplates)
    .values({
      slug: t.slug,
      name: t.name,
      summary: t.summary,
      description: t.description,
      periods: t.periods ?? null,
      milestones: t.milestones,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: schema.marketingTemplates.slug,
      set: {
        name: t.name,
        summary: t.summary,
        description: t.description,
        periods: t.periods ?? null,
        milestones: t.milestones,
        updatedAt: new Date(),
      },
    });
}

function bumpRevalidations(slug?: string) {
  revalidatePath('/campaigns');
  revalidatePath('/campaigns/templates');
  if (slug) revalidatePath(`/campaigns/templates/${slug}/edit`);
}

export async function createMarketingTemplate(
  input: MarketingTemplateFormInput,
): Promise<MarketingTemplate> {
  await requireSession();
  const parsed = formInputSchema.parse(input);
  const slug = (parsed.slug && parsed.slug.length > 0 ? parsed.slug : safeSlug(parsed.name)).trim();
  if (!slug) throw new Error('Nie udało się wygenerować slug — uzupełnij ręcznie.');
  if (await getMarketingTemplate(slug)) throw new Error(`Szablon o slugu "${slug}" już istnieje.`);
  const def = marketingTemplateSchema.parse({ ...parsed, slug });
  await upsertTemplate(def);
  bumpRevalidations(slug);
  return def;
}

export async function updateMarketingTemplate(
  slug: string,
  input: MarketingTemplateFormInput,
): Promise<MarketingTemplate> {
  await requireSession();
  if (!(await getMarketingTemplate(slug))) throw new Error(`Szablon "${slug}" nie istnieje.`);
  const parsed = formInputSchema.parse(input);
  const def = marketingTemplateSchema.parse({ ...parsed, slug });
  await upsertTemplate(def);
  bumpRevalidations(slug);
  return def;
}

export async function deleteMarketingTemplate(slug: string): Promise<void> {
  await requireSession();
  if (!(await getMarketingTemplate(slug))) throw new Error(`Szablon "${slug}" nie istnieje.`);
  await db.delete(schema.marketingTemplates).where(eq(schema.marketingTemplates.slug, slug));
  bumpRevalidations();
}

export async function duplicateMarketingTemplate(
  sourceSlug: string,
  newSlug?: string,
  newName?: string,
): Promise<MarketingTemplate> {
  await requireSession();
  const source = await getMarketingTemplate(sourceSlug);
  if (!source) throw new Error(`Szablon źródłowy "${sourceSlug}" nie istnieje.`);
  const baseSlug = newSlug?.trim() || `${sourceSlug}-kopia`;
  let slug = baseSlug;
  let n = 2;
  while (await getMarketingTemplate(slug)) {
    slug = `${baseSlug}-${n++}`;
    if (n > 99) throw new Error('Nie udało się znaleźć wolnego slugu.');
  }
  const def = marketingTemplateSchema.parse({
    ...source,
    slug,
    name: newName?.trim() || `${source.name} (kopia)`,
  });
  await upsertTemplate(def);
  bumpRevalidations(slug);
  return def;
}
