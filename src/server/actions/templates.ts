'use server';

import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { safeRevalidatePath as revalidatePath } from './revalidate';
import {
  getTemplate,
  loadTemplates,
  productionTemplateBaseSchema,
  productionTemplateSchema,
} from '@/lib/production-templates';
import type { ProductionTemplate } from '@/lib/production-templates-types';
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

const formInputSchema = productionTemplateBaseSchema.extend({
  slug: z
    .string()
    .max(60)
    .regex(/^[a-z0-9-]*$/, 'tylko małe litery, cyfry i myślnik')
    .optional()
    .or(z.literal('')),
});

export type TemplateFormInput = z.input<typeof formInputSchema>;

async function upsertTemplate(t: ProductionTemplate) {
  await db
    .insert(schema.productionTemplates)
    .values({
      slug: t.slug,
      name: t.name,
      type: t.type,
      summary: t.summary,
      description: t.description,
      steps: t.steps,
      periods: t.periods ?? null,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: schema.productionTemplates.slug,
      set: {
        name: t.name,
        type: t.type,
        summary: t.summary,
        description: t.description,
        steps: t.steps,
        periods: t.periods ?? null,
        updatedAt: new Date(),
      },
    });
}

function bumpRevalidations(slug?: string) {
  revalidatePath('/templates');
  revalidatePath('/calendar');
  revalidatePath('/productions');
  revalidatePath('/');
  if (slug) revalidatePath(`/templates/${slug}/edit`);
}

export async function createTemplate(input: TemplateFormInput): Promise<ProductionTemplate> {
  await requireSession();
  const parsed = formInputSchema.parse(input);
  const slug = (parsed.slug && parsed.slug.length > 0 ? parsed.slug : safeSlug(parsed.name)).trim();
  if (!slug) throw new Error('Nie udało się wygenerować slug — uzupełnij ręcznie.');
  if (await getTemplate(slug)) throw new Error(`Szablon o slugu "${slug}" już istnieje.`);
  const def = productionTemplateSchema.parse({ ...parsed, slug });
  await upsertTemplate(def);
  bumpRevalidations(slug);
  return def;
}

export async function updateTemplate(
  slug: string,
  input: TemplateFormInput,
): Promise<ProductionTemplate> {
  await requireSession();
  if (!(await getTemplate(slug))) throw new Error(`Szablon "${slug}" nie istnieje.`);
  const parsed = formInputSchema.parse(input);
  const def = productionTemplateSchema.parse({ ...parsed, slug });
  await upsertTemplate(def);
  bumpRevalidations(slug);
  return def;
}

export async function deleteTemplate(slug: string): Promise<void> {
  await requireSession();
  if (!(await getTemplate(slug))) throw new Error(`Szablon "${slug}" nie istnieje.`);
  if ((await loadTemplates()).length <= 1) {
    throw new Error('Nie można usunąć ostatniego szablonu.');
  }
  await db.delete(schema.productionTemplates).where(eq(schema.productionTemplates.slug, slug));
  bumpRevalidations();
}

export async function duplicateTemplate(
  sourceSlug: string,
  newSlug?: string,
  newName?: string,
): Promise<ProductionTemplate> {
  await requireSession();
  const source = await getTemplate(sourceSlug);
  if (!source) throw new Error(`Szablon źródłowy "${sourceSlug}" nie istnieje.`);
  const baseSlug = newSlug?.trim() || `${sourceSlug}-kopia`;
  let slug = baseSlug;
  let n = 2;
  while (await getTemplate(slug)) {
    slug = `${baseSlug}-${n++}`;
    if (n > 99) throw new Error('Nie udało się znaleźć wolnego slugu.');
  }
  const def = productionTemplateSchema.parse({
    ...source,
    slug,
    name: newName?.trim() || `${source.name} (kopia)`,
  });
  await upsertTemplate(def);
  bumpRevalidations(slug);
  return def;
}
