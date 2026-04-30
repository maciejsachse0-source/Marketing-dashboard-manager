'use server';

import { safeRevalidatePath as revalidatePath } from './revalidate';
import { eq, desc } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import {
  productionInputSchema,
  type ProductionInput,
} from './schemas';
import type { Production, ProductionType } from '../../../drizzle/schema';
import { generateOutputFolder } from '@/lib/output-folder';

function safeSlug(input: string, fallback: string): string {
  const s = input
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
    .slice(0, 60);
  return s || fallback;
}

export async function createProduction(input: ProductionInput): Promise<Production> {
  const parsed = productionInputSchema.parse(input);
  const t0 = new Date(parsed.t0At);
  const yyyymmdd = `${t0.getFullYear()}${String(t0.getMonth() + 1).padStart(2, '0')}${String(t0.getDate()).padStart(2, '0')}`;
  const slug = parsed.slug ?? `${safeSlug(parsed.title, 'production')}-${yyyymmdd}`;

  const [row] = await db
    .insert(schema.productions)
    .values({
      type: parsed.type,
      title: parsed.title,
      slug,
      t0At: t0,
      // `steps[]` is populated separately by applyTemplateToProduction after
      // creation — wizard handles that. Default empty so the row is valid.
      steps: [],
      cancelledAt: null,
      artistId: parsed.artistId ?? null,
      videographerId: parsed.videographerId ?? null,
      platforms: parsed.platforms ?? null,
      campaignId: parsed.campaignId ?? null,
      notes: parsed.notes ?? null,
    })
    .returning();
  revalidatePath('/productions');
  revalidatePath('/calendar');
  revalidatePath('/');
  return row;
}

export async function updateProduction(id: number, input: Partial<ProductionInput>): Promise<Production> {
  const parsed = productionInputSchema.partial().parse(input);
  const { t0At, ...rest } = parsed;
  const [row] = await db
    .update(schema.productions)
    .set({
      ...rest,
      ...(t0At ? { t0At: new Date(t0At) } : {}),
    })
    .where(eq(schema.productions.id, id))
    .returning();
  revalidatePath('/productions');
  revalidatePath(`/productions/${id}`);
  revalidatePath('/calendar');
  return row;
}

export async function regenerateOutputFolder(id: number) {
  const result = await generateOutputFolder(id);
  revalidatePath(`/productions/${id}`);
  revalidatePath('/output');
  return result;
}

export async function deleteProduction(id: number): Promise<void> {
  // Migration 0001 added the back-references (calendar_entries.production_id,
  // packages.production_id, posts.production_id) without ON DELETE SET NULL,
  // so SQLite blocks the production delete with a FK constraint. Manually
  // null those references first — same end state as the cascade rule we
  // wanted, just done in the app layer.
  await db
    .update(schema.calendarEntries)
    .set({ productionId: null })
    .where(eq(schema.calendarEntries.productionId, id));
  await db
    .update(schema.packages)
    .set({ productionId: null })
    .where(eq(schema.packages.productionId, id));
  await db
    .update(schema.posts)
    .set({ productionId: null })
    .where(eq(schema.posts.productionId, id));

  await db.delete(schema.productions).where(eq(schema.productions.id, id));
  revalidatePath('/productions');
  revalidatePath(`/productions/${id}`);
  revalidatePath('/calendar');
  revalidatePath('/');
  revalidatePath('/output');
  revalidatePath('/analytics');
}

export async function listProductions(filter?: {
  type?: ProductionType;
}): Promise<Production[]> {
  if (filter?.type) {
    return db.query.productions.findMany({
      where: eq(schema.productions.type, filter.type),
      orderBy: desc(schema.productions.t0At),
    });
  }
  return db.query.productions.findMany({ orderBy: desc(schema.productions.t0At) });
}

export async function getProduction(id: number) {
  const production = await db.query.productions.findFirst({
    where: eq(schema.productions.id, id),
  });
  if (!production) return null;
  const [entries, packages, posts, artist, videographer, campaign] = await Promise.all([
    db.query.calendarEntries.findMany({
      where: eq(schema.calendarEntries.productionId, id),
      orderBy: schema.calendarEntries.startsAt,
    }),
    db.query.packages.findMany({
      where: eq(schema.packages.productionId, id),
      orderBy: desc(schema.packages.createdAt),
    }),
    db.query.posts.findMany({
      where: eq(schema.posts.productionId, id),
      orderBy: desc(schema.posts.publishedAt),
    }),
    production.artistId
      ? db.query.artists.findFirst({ where: eq(schema.artists.id, production.artistId) })
      : Promise.resolve(null),
    production.videographerId
      ? db.query.videographers.findFirst({
          where: eq(schema.videographers.id, production.videographerId),
        })
      : Promise.resolve(null),
    production.campaignId
      ? db.query.campaigns.findFirst({ where: eq(schema.campaigns.id, production.campaignId) })
      : Promise.resolve(null),
  ]);
  return { production, entries, packages, posts, artist, videographer, campaign };
}

export async function getProductionByEntryId(entryId: number) {
  const entry = await db.query.calendarEntries.findFirst({
    where: eq(schema.calendarEntries.id, entryId),
  });
  if (!entry?.productionId) return null;
  return getProduction(entry.productionId);
}
