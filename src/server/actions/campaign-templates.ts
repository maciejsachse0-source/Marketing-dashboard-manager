'use server';

import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { safeRevalidatePath as revalidatePath } from './revalidate';
import {
  getMarketingTemplate,
  loadMarketingTemplates,
  marketingTemplateBaseSchema,
  marketingTemplateFilePath,
  marketingTemplateSchema,
} from '@/lib/campaign-templates';
import type { MarketingTemplate } from '@/lib/campaign-templates-types';

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
  // On create slug may be empty (server derives from name) — on update it must match.
  slug: z
    .string()
    .max(60)
    .regex(/^[a-z0-9-]*$/, 'tylko małe litery, cyfry i myślnik')
    .optional()
    .or(z.literal('')),
});

export type MarketingTemplateFormInput = z.input<typeof formInputSchema>;

function writeTemplate(t: MarketingTemplate) {
  const file = marketingTemplateFilePath(t.slug);
  const dir = path.dirname(file);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(file, JSON.stringify(t, null, 2) + '\n', 'utf8');
}

function bumpRevalidations(slug?: string) {
  revalidatePath('/campaigns');
  revalidatePath('/campaigns/templates');
  if (slug) revalidatePath(`/campaigns/templates/${slug}/edit`);
}

export async function createMarketingTemplate(
  input: MarketingTemplateFormInput,
): Promise<MarketingTemplate> {
  const parsed = formInputSchema.parse(input);
  const slug = (parsed.slug && parsed.slug.length > 0 ? parsed.slug : safeSlug(parsed.name)).trim();
  if (!slug) throw new Error('Nie udało się wygenerować slug — uzupełnij ręcznie.');
  if (getMarketingTemplate(slug)) throw new Error(`Szablon o slugu "${slug}" już istnieje.`);
  const def = marketingTemplateSchema.parse({ ...parsed, slug });
  writeTemplate(def);
  bumpRevalidations(slug);
  return def;
}

export async function updateMarketingTemplate(
  slug: string,
  input: MarketingTemplateFormInput,
): Promise<MarketingTemplate> {
  if (!getMarketingTemplate(slug)) throw new Error(`Szablon "${slug}" nie istnieje.`);
  const parsed = formInputSchema.parse(input);
  const def = marketingTemplateSchema.parse({ ...parsed, slug });
  writeTemplate(def);
  bumpRevalidations(slug);
  return def;
}

export async function deleteMarketingTemplate(slug: string): Promise<void> {
  const file = marketingTemplateFilePath(slug);
  if (!fs.existsSync(file)) throw new Error(`Szablon "${slug}" nie istnieje.`);
  fs.unlinkSync(file);
  bumpRevalidations();
}

export async function duplicateMarketingTemplate(
  sourceSlug: string,
  newSlug?: string,
  newName?: string,
): Promise<MarketingTemplate> {
  const source = getMarketingTemplate(sourceSlug);
  if (!source) throw new Error(`Szablon źródłowy "${sourceSlug}" nie istnieje.`);
  const baseSlug = newSlug?.trim() || `${sourceSlug}-kopia`;
  let slug = baseSlug;
  let n = 2;
  while (getMarketingTemplate(slug)) {
    slug = `${baseSlug}-${n++}`;
    if (n > 99) throw new Error('Nie udało się znaleźć wolnego slugu.');
  }
  const def = marketingTemplateSchema.parse({
    ...source,
    slug,
    name: newName?.trim() || `${source.name} (kopia)`,
  });
  writeTemplate(def);
  bumpRevalidations(slug);
  return def;
}
