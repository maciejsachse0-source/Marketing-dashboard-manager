'use server';

import { safeRevalidatePath as revalidatePath } from './revalidate';
import { eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { campaignInputSchema, type CampaignInput } from './schemas';
import { getMarketingTemplate } from '@/lib/campaign-templates';
import type {
  CampaignMilestone,
  CampaignSubmilestone,
} from '@/lib/campaign-templates-types';
import { periodsSchema, type TemplatePeriod } from '@/lib/production-periods';

export async function createCampaign(
  input: CampaignInput & { templateSlug?: string | null },
) {
  const { templateSlug, ...rest } = input;
  const parsed = campaignInputSchema.parse(rest);

  // If a template is selected, clone its milestones + periods onto the
  // campaign. Same one-shot clone semantics as production templates: editing
  // the template later does NOT retroactively change existing campaigns.
  let clonedMilestones: CampaignMilestone[] | null = null;
  let clonedPeriods:
    | { code: string; startOffsetDays: number; endOffsetDays: number }[]
    | null = null;
  let recordedSlug: string | null = null;
  if (templateSlug) {
    const tpl = getMarketingTemplate(templateSlug);
    if (!tpl) throw new Error(`Szablon "${templateSlug}" nie istnieje.`);
    recordedSlug = tpl.slug;
    clonedPeriods = tpl.periods ?? null;
    clonedMilestones = tpl.milestones.map((m) => ({
      id: m.id,
      period: m.period,
      label: m.label,
      description: m.description,
      doneAt: null,
      submilestones: m.submilestones.map(
        (s): CampaignSubmilestone => ({
          id: s.id,
          label: s.label,
          description: s.description,
          doneAt: null,
        }),
      ),
    }));
  }

  const [row] = await db
    .insert(schema.campaigns)
    .values({
      name: parsed.name,
      goal: parsed.goal,
      releaseAt: new Date(parsed.releaseAt),
      phase: parsed.phase ?? 'build-up',
      kpis: parsed.kpis ?? null,
      notes: parsed.notes ?? null,
      templateSlug: recordedSlug,
      periods: clonedPeriods,
      milestones: clonedMilestones,
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

/**
 * Replace the campaign's T-period bands. The user drives this from the live
 * slider on the campaign detail page. Milestones whose `period` references a
 * code that no longer exists get remapped to the closest surviving code (or
 * dropped if periods went empty — never happens, periodsSchema enforces ≥1).
 */
export async function updateCampaignPeriods(
  campaignId: number,
  periods: TemplatePeriod[],
) {
  const parsed = periodsSchema.parse(periods);
  const campaign = await db.query.campaigns.findFirst({
    where: eq(schema.campaigns.id, campaignId),
  });
  if (!campaign) throw new Error(`Kampania #${campaignId} nie istnieje.`);

  const validCodes = new Set(parsed.map((p) => p.code));
  const fallback = parsed[0]?.code ?? 'T1';
  const remappedMilestones =
    campaign.milestones?.map((m) => ({
      ...m,
      period: validCodes.has(m.period) ? m.period : fallback,
    })) ?? null;

  await db
    .update(schema.campaigns)
    .set({ periods: parsed, milestones: remappedMilestones })
    .where(eq(schema.campaigns.id, campaignId));
  revalidatePath('/campaigns');
  revalidatePath(`/campaigns/${campaignId}`);
}

/**
 * Toggle a milestone or submilestone done state. When `submilestoneId` is
 * provided the toggle applies to the child; otherwise to the parent. Parent
 * milestones with submilestones derive their done state from the children
 * (UI-side), so the parent-level doneAt only matters for milestones that have
 * no submilestones.
 */
export async function toggleCampaignMilestone(
  campaignId: number,
  milestoneId: string,
  submilestoneId?: string,
) {
  const campaign = await db.query.campaigns.findFirst({
    where: eq(schema.campaigns.id, campaignId),
  });
  if (!campaign) throw new Error(`Kampania #${campaignId} nie istnieje.`);
  const milestones = campaign.milestones ?? [];
  const nowIso = new Date().toISOString();
  const next = milestones.map((m) => {
    if (m.id !== milestoneId) return m;
    if (submilestoneId) {
      return {
        ...m,
        submilestones: m.submilestones.map((s) =>
          s.id === submilestoneId ? { ...s, doneAt: s.doneAt ? null : nowIso } : s,
        ),
      };
    }
    return { ...m, doneAt: m.doneAt ? null : nowIso };
  });
  await db
    .update(schema.campaigns)
    .set({ milestones: next })
    .where(eq(schema.campaigns.id, campaignId));
  revalidatePath('/campaigns');
  revalidatePath(`/campaigns/${campaignId}`);
}
