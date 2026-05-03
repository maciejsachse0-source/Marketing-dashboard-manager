'use server';

import { safeRevalidatePath as revalidatePath } from './revalidate';
import { eq, desc } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { requireSession } from '@/lib/auth';
import {
  productionInputSchema,
  type ProductionInput,
} from './schemas';
import type { Production, ProductionType } from '../../../drizzle/schema';
import {
  ensureWorkFolderStructure,
  markProductionFolderObsolete,
} from '@/lib/production-work-folder';

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
  await requireSession();
  const parsed = productionInputSchema.parse(input);
  const t0 = new Date(parsed.t0At);
  const yyyymmdd = `${t0.getFullYear()}${String(t0.getMonth() + 1).padStart(2, '0')}${String(t0.getDate()).padStart(2, '0')}`;
  const slug = parsed.slug ?? `${safeSlug(parsed.title, 'production')}-${yyyymmdd}`;

  const artist = await db.query.artists.findFirst({
    where: eq(schema.artists.id, parsed.artistId),
    columns: { id: true, name: true },
  });
  if (!artist) throw new Error('Artysta nie istnieje');

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
      artistId: artist.id,
      videographerId: parsed.videographerId ?? null,
      platforms: parsed.platforms ?? null,
      campaignId: parsed.campaignId ?? null,
      notes: parsed.notes ?? null,
    })
    .returning();
  // Auto-create the per-artist work folder layout in OneDrive (local-dev
  // only). DB row is already persisted, so a transient mkdir failure
  // shouldn't block the production. Skipped on Vercel where the FS is
  // read-only and the path doesn't exist.
  if (!process.env.VERCEL) {
    try {
      const codes = (row.periods ?? []).map((p) => p.code);
      ensureWorkFolderStructure(
        artist.name,
        row.title,
        codes.length > 0 ? codes : ['T1', 'T2', 'T3'],
      );
    } catch (err) {
      console.warn(`[createProduction] ensureWorkFolderStructure failed for "${row.title}":`, err);
    }
  }
  revalidatePath('/productions');
  revalidatePath('/calendar');
  revalidatePath('/');
  return row;
}

export async function updateProduction(id: number, input: Partial<ProductionInput>): Promise<Production> {
  await requireSession();
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

export async function deleteProduction(id: number): Promise<void> {
  await requireSession();
  let title: string | null = null;
  let artistName: string | null = null;
  try {
    await db.transaction(async (tx) => {
      const prod = await tx.query.productions.findFirst({
        where: eq(schema.productions.id, id),
        columns: { id: true, title: true, artistId: true },
      });
      if (!prod) throw new Error(`Produkcja #${id} nie istnieje`);
      title = prod.title;

      if (prod.artistId) {
        const artist = await tx.query.artists.findFirst({
          where: eq(schema.artists.id, prod.artistId),
          columns: { name: true },
        });
        artistName = artist?.name ?? null;
      }

      // FKs from calendar_entries.production_id / posts.production_id are
      // ON DELETE SET NULL in Postgres — DELETE alone handles the cascade.
      await tx.delete(schema.productions).where(eq(schema.productions.id, id));
    });

    // OneDrive folder rename — local-dev only. Outside the transaction
    // because mkdir failure shouldn't roll back the DB delete.
    if (!process.env.VERCEL && artistName && title) {
      try {
        const result = markProductionFolderObsolete(artistName, title);
        if (!result.renamed) {
          console.info(`[deleteProduction] folder rename skipped: ${result.reason}`);
        }
      } catch (err) {
        console.warn(`[deleteProduction] folder rename failed for "${title}":`, err);
      }
    }
  } catch (err) {
    console.error('[deleteProduction] DB phase failed:', err);
    throw err;
  }

  // Revalidate the LIST/overview routes only. Do NOT revalidate the deleted
  // production's detail route (`/productions/${id}`) — Next would try to
  // rerender it as part of the action response, the page would call
  // notFound() because the row is gone, and the resulting error bubbles up
  // to the client as "An error occurred in the Server Components render"
  // even though the delete itself succeeded.
  try {
    revalidatePath('/productions');
    revalidatePath('/productions/list');
    revalidatePath('/calendar');
    revalidatePath('/');
    revalidatePath('/analytics');
  } catch (err) {
    console.warn('[deleteProduction] revalidatePath failed (delete itself succeeded):', err);
  }

  // Client (delete-production-button) navigates away with router.push after
  // the action resolves; we deliberately skip server-side redirect() because
  // its NEXT_REDIRECT exception bubbles up through Next 16's client RSC
  // pipeline as "An error occurred in the Server Components render".
}

export async function listProductions(filter?: {
  type?: ProductionType;
}): Promise<Production[]> {
  await requireSession();
  if (filter?.type) {
    return db.query.productions.findMany({
      where: eq(schema.productions.type, filter.type),
      orderBy: desc(schema.productions.t0At),
    });
  }
  return db.query.productions.findMany({ orderBy: desc(schema.productions.t0At) });
}

export async function getProduction(id: number) {
  await requireSession();
  const production = await db.query.productions.findFirst({
    where: eq(schema.productions.id, id),
  });
  if (!production) return null;
  const [entries, posts, artist, videographer, campaign] = await Promise.all([
    db.query.calendarEntries.findMany({
      where: eq(schema.calendarEntries.productionId, id),
      orderBy: schema.calendarEntries.startsAt,
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
  return { production, entries, posts, artist, videographer, campaign };
}

export async function getProductionByEntryId(entryId: number) {
  await requireSession();
  const entry = await db.query.calendarEntries.findFirst({
    where: eq(schema.calendarEntries.id, entryId),
  });
  if (!entry?.productionId) return null;
  return getProduction(entry.productionId);
}
