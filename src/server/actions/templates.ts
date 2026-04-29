'use server';

import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { safeRevalidatePath as revalidatePath } from './revalidate';
import {
  getTemplate,
  loadTemplates,
  productionTemplateSchema,
  templateFilePath,
} from '@/lib/production-templates';
import type { ProductionTemplate } from '@/lib/production-templates-types';

/**
 * Slug rules: lowercase letters, digits, dashes only. Used as the filename.
 * Generated from `name` for new templates if not supplied.
 */
function safeSlug(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

const formInputSchema = productionTemplateSchema.extend({
  // On create slug may be empty (server derives from name) — on update it must match.
  slug: z
    .string()
    .max(60)
    .regex(/^[a-z0-9-]*$/, 'tylko małe litery, cyfry i myślnik')
    .optional()
    .or(z.literal('')),
});

export type TemplateFormInput = z.input<typeof formInputSchema>;

function writeTemplate(t: ProductionTemplate) {
  const file = templateFilePath(t.slug);
  const dir = path.dirname(file);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(file, JSON.stringify(t, null, 2) + '\n', 'utf8');
}

function bumpRevalidations(slug?: string) {
  revalidatePath('/templates');
  revalidatePath('/calendar');
  revalidatePath('/productions');
  revalidatePath('/');
  if (slug) revalidatePath(`/templates/${slug}/edit`);
}

export async function createTemplate(input: TemplateFormInput): Promise<ProductionTemplate> {
  const parsed = formInputSchema.parse(input);
  const slug = (parsed.slug && parsed.slug.length > 0 ? parsed.slug : safeSlug(parsed.name)).trim();
  if (!slug) throw new Error('Nie udało się wygenerować slug — uzupełnij ręcznie.');
  if (getTemplate(slug)) throw new Error(`Szablon o slugu "${slug}" już istnieje.`);
  const def = productionTemplateSchema.parse({ ...parsed, slug });
  writeTemplate(def);
  bumpRevalidations(slug);
  return def;
}

export async function updateTemplate(
  slug: string,
  input: TemplateFormInput,
): Promise<ProductionTemplate> {
  if (!getTemplate(slug)) throw new Error(`Szablon "${slug}" nie istnieje.`);
  const parsed = formInputSchema.parse(input);
  const def = productionTemplateSchema.parse({ ...parsed, slug });
  writeTemplate(def);
  bumpRevalidations(slug);
  return def;
}

export async function deleteTemplate(slug: string): Promise<void> {
  const file = templateFilePath(slug);
  if (!fs.existsSync(file)) throw new Error(`Szablon "${slug}" nie istnieje.`);
  if (loadTemplates().length <= 1) {
    throw new Error('Nie można usunąć ostatniego szablonu.');
  }
  fs.unlinkSync(file);
  bumpRevalidations();
}

export async function duplicateTemplate(
  sourceSlug: string,
  newSlug?: string,
  newName?: string,
): Promise<ProductionTemplate> {
  const source = getTemplate(sourceSlug);
  if (!source) throw new Error(`Szablon źródłowy "${sourceSlug}" nie istnieje.`);
  const baseSlug = newSlug?.trim() || `${sourceSlug}-kopia`;
  let slug = baseSlug;
  // Avoid collision — append -2, -3, ... if needed.
  let n = 2;
  while (getTemplate(slug)) {
    slug = `${baseSlug}-${n++}`;
    if (n > 99) throw new Error('Nie udało się znaleźć wolnego slugu.');
  }
  const def = productionTemplateSchema.parse({
    ...source,
    slug,
    name: newName?.trim() || `${source.name} (kopia)`,
  });
  writeTemplate(def);
  bumpRevalidations(slug);
  return def;
}
