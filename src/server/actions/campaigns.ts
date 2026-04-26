'use server';

import { safeRevalidatePath as revalidatePath } from './revalidate';
import { eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { campaignInputSchema, type CampaignInput } from './schemas';

export async function createCampaign(input: CampaignInput) {
  const parsed = campaignInputSchema.parse(input);
  const [row] = await db
    .insert(schema.campaigns)
    .values({
      name: parsed.name,
      goal: parsed.goal,
      releaseAt: new Date(parsed.releaseAt),
      phase: parsed.phase ?? 'build-up',
      kpis: parsed.kpis ?? null,
      notes: parsed.notes ?? null,
    })
    .returning();
  revalidatePath('/campaigns');
  return row;
}

export async function updateCampaign(id: number, input: Partial<CampaignInput>) {
  const parsed = campaignInputSchema.partial().parse(input);
  const { releaseAt, ...rest } = parsed;
  const [row] = await db
    .update(schema.campaigns)
    .set({ ...rest, ...(releaseAt ? { releaseAt: new Date(releaseAt) } : {}) })
    .where(eq(schema.campaigns.id, id))
    .returning();
  revalidatePath('/campaigns');
  revalidatePath(`/campaigns/${id}`);
  return row;
}

export async function deleteCampaign(id: number) {
  await db.delete(schema.campaigns).where(eq(schema.campaigns.id, id));
  revalidatePath('/campaigns');
}

export async function listCampaigns() {
  return db.query.campaigns.findMany({ orderBy: schema.campaigns.releaseAt });
}
