'use server';

import { safeRevalidatePath as revalidatePath } from './revalidate';
import { eq, and, desc } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import {
  productionInputSchema,
  productionStatusSchema,
  type ProductionInput,
} from './schemas';
import type { Production, ProductionStatus, ProductionType } from '../../../drizzle/schema';
import { getProductionTemplate, stepStartsAt, stepEndsAt } from '@/lib/templates';
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
      templateSlug: parsed.templateSlug ?? 'manual',
      status: parsed.status ?? 'email-sent',
      title: parsed.title,
      slug,
      t0At: t0,
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

export async function setProductionStatus(id: number, status: ProductionStatus): Promise<Production> {
  const validStatus = productionStatusSchema.parse(status);
  const [row] = await db
    .update(schema.productions)
    .set({ status: validStatus })
    .where(eq(schema.productions.id, id))
    .returning();
  revalidatePath('/productions');
  revalidatePath(`/productions/${id}`);
  revalidatePath('/calendar');
  revalidatePath('/');

  // Side-effect: when production reaches 'publishing' for the first time, generate output folder
  if (validStatus === 'publishing' && !row.folderPath) {
    try {
      await generateOutputFolder(id);
      revalidatePath('/output');
    } catch (e) {
      console.error('[output-folder] generation failed for production', id, e);
      // Status change still succeeds — folder generation is best-effort
    }
  }

  return row;
}

export async function regenerateOutputFolder(id: number) {
  const result = await generateOutputFolder(id);
  revalidatePath(`/productions/${id}`);
  revalidatePath('/output');
  return result;
}

export async function deleteProduction(id: number): Promise<void> {
  await db.delete(schema.productions).where(eq(schema.productions.id, id));
  revalidatePath('/productions');
  revalidatePath('/calendar');
}

export async function listProductions(filter?: {
  type?: ProductionType;
  status?: ProductionStatus;
}): Promise<Production[]> {
  if (filter?.type && filter?.status) {
    return db.query.productions.findMany({
      where: and(eq(schema.productions.type, filter.type), eq(schema.productions.status, filter.status)),
      orderBy: desc(schema.productions.t0At),
    });
  }
  if (filter?.type) {
    return db.query.productions.findMany({
      where: eq(schema.productions.type, filter.type),
      orderBy: desc(schema.productions.t0At),
    });
  }
  if (filter?.status) {
    return db.query.productions.findMany({
      where: eq(schema.productions.status, filter.status),
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

export type CreateFromTemplateInput = {
  templateSlug: string;
  title: string;
  t0At: string;
  artistId?: number | null;
  videographerId?: number | null;
  campaignId?: number | null;
  platformsOverride?: ('instagram' | 'tiktok' | 'youtube' | 'facebook' | 'x' | 'linkedin')[] | null;
  notes?: string | null;
};

export async function createProductionFromTemplate(input: CreateFromTemplateInput): Promise<{
  production: Production;
  entriesCreated: number;
}> {
  const template = getProductionTemplate(input.templateSlug);
  if (!template) {
    throw new Error(`Unknown template: ${input.templateSlug}`);
  }
  if (!input.title.trim()) {
    throw new Error('Tytuł nie może być pusty');
  }

  const t0 = new Date(input.t0At);
  if (!Number.isFinite(t0.getTime())) {
    throw new Error('Nieprawidłowa data T-0');
  }

  // Default platforms — union of all steps that publish
  const defaultPlatforms = Array.from(
    new Set(
      template.steps
        .filter((s) => s.calendarType === 'publish' && s.platforms?.length)
        .flatMap((s) => s.platforms ?? []),
    ),
  );
  const platforms = input.platformsOverride && input.platformsOverride.length > 0
    ? input.platformsOverride
    : defaultPlatforms.length > 0
      ? defaultPlatforms
      : null;

  const yyyymmdd = `${t0.getFullYear()}${String(t0.getMonth() + 1).padStart(2, '0')}${String(t0.getDate()).padStart(2, '0')}`;
  const slug = `${safeSlug(input.title, 'production')}-${yyyymmdd}`;

  const [production] = await db
    .insert(schema.productions)
    .values({
      type: template.type,
      templateSlug: template.slug,
      status: 'email-sent',
      title: input.title.trim(),
      slug,
      t0At: t0,
      artistId: input.artistId ?? null,
      videographerId: input.videographerId ?? null,
      platforms: platforms ?? null,
      campaignId: input.campaignId ?? null,
      notes: input.notes ?? null,
    })
    .returning();

  let entriesCreated = 0;
  for (const step of template.steps) {
    await db.insert(schema.calendarEntries).values({
      type: step.calendarType,
      title: step.title,
      description: step.description ?? null,
      startsAt: stepStartsAt(t0, step),
      endsAt: stepEndsAt(t0, step),
      platforms: step.platforms ?? null,
      artistId: input.artistId ?? null,
      campaignId: input.campaignId ?? null,
      productionId: production.id,
      stage: step.stage,
      status: 'planned',
    });
    entriesCreated++;
  }

  revalidatePath('/productions');
  revalidatePath(`/productions/${production.id}`);
  revalidatePath('/calendar');
  revalidatePath('/');

  return { production, entriesCreated };
}

export async function getProductionByEntryId(entryId: number) {
  const entry = await db.query.calendarEntries.findFirst({
    where: eq(schema.calendarEntries.id, entryId),
  });
  if (!entry?.productionId) return null;
  return getProduction(entry.productionId);
}
