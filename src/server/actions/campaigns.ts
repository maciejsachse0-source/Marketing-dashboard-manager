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
import {
  periodsSchema,
  resolvePeriods,
  type TemplatePeriod,
} from '@/lib/production-periods';

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
    | {
        code: string;
        name?: string;
        startOffsetDays: number;
        endOffsetDays: number;
      }[]
    | null = null;
  let recordedSlug: string | null = null;
  if (templateSlug) {
    const tpl = await getMarketingTemplate(templateSlug);
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
 * Retroactively apply a marketing template to an EXISTING campaign that was
 * created without one (legacy data, or wizard run before templates existed).
 * Clones the template's periods + milestones onto the campaign, identical to
 * what `createCampaign` does at creation time.
 *
 * Refuses to overwrite a campaign that already has a template — the caller
 * must explicitly clear it first if they want to switch. This guard exists
 * because applying a new template would orphan existing milestone progress
 * silently (the milestone IDs differ between templates) — we'd rather force
 * a deliberate "switch" gesture than mask data loss.
 */
export async function applyTemplateToCampaign(
  campaignId: number,
  templateSlug: string,
) {
  const campaign = await db.query.campaigns.findFirst({
    where: eq(schema.campaigns.id, campaignId),
  });
  if (!campaign) throw new Error(`Kampania #${campaignId} nie istnieje.`);
  if (campaign.templateSlug) {
    throw new Error(
      `Kampania ma już szablon "${campaign.templateSlug}". Najpierw usuń szablon, potem zastosuj nowy.`,
    );
  }
  const tpl = await getMarketingTemplate(templateSlug);
  if (!tpl) throw new Error(`Szablon "${templateSlug}" nie istnieje.`);

  const clonedMilestones: CampaignMilestone[] = tpl.milestones.map((m) => ({
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

  await db
    .update(schema.campaigns)
    .set({
      templateSlug: tpl.slug,
      periods: tpl.periods ?? null,
      milestones: clonedMilestones,
    })
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

/**
 * Cross-milestone cascade — mirrors `cascadeStepsTo` from production steps.
 * Marking a milestone "done" implies all milestones BEFORE it (in global
 * narrative order: period order × within-period array order) are also done;
 * unmarking the target implies the target AND every milestone after it are
 * not done. Submilestones follow their parent: cascade-mark sets all subs
 * done; cascade-unmark clears them. This is what makes the campaign
 * milestone pins behave like production-step circles — clicking step N
 * brings every earlier step along with it, so the user can never end up
 * in an "out-of-order done" state.
 */
export async function cascadeCampaignMilestonesTo(
  campaignId: number,
  milestoneId: string,
  mode: 'mark' | 'unmark',
) {
  const campaign = await db.query.campaigns.findFirst({
    where: eq(schema.campaigns.id, campaignId),
  });
  if (!campaign) throw new Error(`Kampania #${campaignId} nie istnieje.`);
  const milestones = campaign.milestones ?? [];
  if (milestones.length === 0) return;

  // Global ordering: same logic the UI uses to render the strip — period
  // order × the milestone's index in the source array. Orphan periods
  // (codes referenced by a milestone but not present in periods[]) sort
  // after canonical periods, in first-seen order.
  const resolved = resolvePeriods(campaign.periods);
  const periodIdx = new Map<string, number>(
    resolved.map((p, i) => [p.code, i]),
  );
  let orphanCounter = resolved.length;
  for (const m of milestones) {
    if (!periodIdx.has(m.period)) {
      periodIdx.set(m.period, orphanCounter++);
    }
  }
  const indexed = milestones.map((m, i) => ({ m, i }));
  indexed.sort((a, b) => {
    const pa = periodIdx.get(a.m.period) ?? Number.MAX_SAFE_INTEGER;
    const pb = periodIdx.get(b.m.period) ?? Number.MAX_SAFE_INTEGER;
    if (pa !== pb) return pa - pb;
    return a.i - b.i;
  });

  const targetPos = indexed.findIndex((x) => x.m.id === milestoneId);
  if (targetPos < 0) {
    throw new Error(`Milestone ${milestoneId} nie istnieje w kampanii.`);
  }
  const positionById = new Map<string, number>(
    indexed.map((x, pos) => [x.m.id, pos]),
  );

  const nowIso = new Date().toISOString();
  const next = milestones.map((m) => {
    const pos = positionById.get(m.id);
    if (pos === undefined) return m;
    // mark: target + everything before becomes done.
    // unmark: target + everything after becomes not done.
    const shouldBeDone =
      mode === 'mark' ? pos <= targetPos : pos < targetPos;
    const stamp = shouldBeDone ? nowIso : null;
    return {
      ...m,
      doneAt: shouldBeDone ? m.doneAt ?? nowIso : null,
      submilestones: m.submilestones.map((s) => ({
        ...s,
        doneAt: shouldBeDone ? s.doneAt ?? nowIso : null,
      })),
    } satisfies typeof m;
  });

  await db
    .update(schema.campaigns)
    .set({ milestones: next })
    .where(eq(schema.campaigns.id, campaignId));
  revalidatePath('/campaigns');
  revalidatePath(`/campaigns/${campaignId}`);
  revalidatePath('/calendar');
}

/**
 * Cascade-toggle a parent milestone — marks/unmarks ALL its submilestones
 * (and the parent itself) in one go. UI uses this so clicking the parent
 * checkbox advances the whole bucket forward or back, instead of forcing
 * the user to flip each submilestone one by one.
 */
export async function cascadeCampaignMilestone(
  campaignId: number,
  milestoneId: string,
  mode: 'mark' | 'unmark',
) {
  const campaign = await db.query.campaigns.findFirst({
    where: eq(schema.campaigns.id, campaignId),
  });
  if (!campaign) throw new Error(`Kampania #${campaignId} nie istnieje.`);
  const milestones = campaign.milestones ?? [];
  const nowIso = new Date().toISOString();
  const stamp = mode === 'mark' ? nowIso : null;
  const next = milestones.map((m) => {
    if (m.id !== milestoneId) return m;
    return {
      ...m,
      doneAt: stamp,
      submilestones: m.submilestones.map((s) => ({ ...s, doneAt: stamp })),
    };
  });
  await db
    .update(schema.campaigns)
    .set({ milestones: next })
    .where(eq(schema.campaigns.id, campaignId));
  revalidatePath('/campaigns');
  revalidatePath(`/campaigns/${campaignId}`);
}

/**
 * Patch a milestone's user-facing fields (label / description). Identifier
 * (`id`) and structural fields (`period`, `submilestones`, `doneAt`) are
 * intentionally NOT editable here — keeping the patch surface narrow means
 * the toggle/cascade actions and template-clone semantics stay consistent
 * with what the user sees in the editor.
 */
export async function updateCampaignMilestone(
  campaignId: number,
  milestoneId: string,
  patch: { label?: string; description?: string | null },
) {
  const campaign = await db.query.campaigns.findFirst({
    where: eq(schema.campaigns.id, campaignId),
  });
  if (!campaign) throw new Error(`Kampania #${campaignId} nie istnieje.`);
  const milestones = campaign.milestones ?? [];
  const next = milestones.map((m) => {
    if (m.id !== milestoneId) return m;
    return {
      ...m,
      ...(patch.label !== undefined ? { label: patch.label.trim() } : {}),
      ...(patch.description !== undefined
        ? {
            description:
              patch.description === null || patch.description.trim() === ''
                ? undefined
                : patch.description.trim(),
          }
        : {}),
    };
  });
  await db
    .update(schema.campaigns)
    .set({ milestones: next })
    .where(eq(schema.campaigns.id, campaignId));
  revalidatePath('/campaigns');
  revalidatePath(`/campaigns/${campaignId}`);
}

/** Same shape as updateCampaignMilestone but targets a submilestone within
 *  a parent milestone. Submilestone IDs are scoped under their parent so we
 *  need both ids to disambiguate. */
export async function updateCampaignSubmilestone(
  campaignId: number,
  milestoneId: string,
  submilestoneId: string,
  patch: { label?: string; description?: string | null },
) {
  const campaign = await db.query.campaigns.findFirst({
    where: eq(schema.campaigns.id, campaignId),
  });
  if (!campaign) throw new Error(`Kampania #${campaignId} nie istnieje.`);
  const milestones = campaign.milestones ?? [];
  const next = milestones.map((m) => {
    if (m.id !== milestoneId) return m;
    return {
      ...m,
      submilestones: m.submilestones.map((s) => {
        if (s.id !== submilestoneId) return s;
        return {
          ...s,
          ...(patch.label !== undefined ? { label: patch.label.trim() } : {}),
          ...(patch.description !== undefined
            ? {
                description:
                  patch.description === null || patch.description.trim() === ''
                    ? undefined
                    : patch.description.trim(),
              }
            : {}),
        };
      }),
    };
  });
  await db
    .update(schema.campaigns)
    .set({ milestones: next })
    .where(eq(schema.campaigns.id, campaignId));
  revalidatePath('/campaigns');
  revalidatePath(`/campaigns/${campaignId}`);
}

function randomId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Append a fresh milestone to the period bucket. Caller passes the period
 *  code (one of the campaign's existing periods) so we don't have to mass-
 *  rewrite milestones to push something into a new bucket. */
export async function addCampaignMilestone(
  campaignId: number,
  period: string,
  label: string,
) {
  if (!label.trim()) throw new Error('Nazwa milestone\'u nie może być pusta.');
  const campaign = await db.query.campaigns.findFirst({
    where: eq(schema.campaigns.id, campaignId),
  });
  if (!campaign) throw new Error(`Kampania #${campaignId} nie istnieje.`);
  const milestones = campaign.milestones ?? [];
  const next = [
    ...milestones,
    {
      id: randomId('m'),
      period,
      label: label.trim(),
      doneAt: null,
      submilestones: [],
    },
  ];
  await db
    .update(schema.campaigns)
    .set({ milestones: next })
    .where(eq(schema.campaigns.id, campaignId));
  revalidatePath('/campaigns');
  revalidatePath(`/campaigns/${campaignId}`);
}

/** Append a submilestone under the given parent. */
export async function addCampaignSubmilestone(
  campaignId: number,
  milestoneId: string,
  label: string,
) {
  if (!label.trim()) throw new Error('Nazwa kroku nie może być pusta.');
  const campaign = await db.query.campaigns.findFirst({
    where: eq(schema.campaigns.id, campaignId),
  });
  if (!campaign) throw new Error(`Kampania #${campaignId} nie istnieje.`);
  const milestones = campaign.milestones ?? [];
  const next = milestones.map((m) => {
    if (m.id !== milestoneId) return m;
    return {
      ...m,
      submilestones: [
        ...m.submilestones,
        { id: randomId('s'), label: label.trim(), doneAt: null },
      ],
    };
  });
  await db
    .update(schema.campaigns)
    .set({ milestones: next })
    .where(eq(schema.campaigns.id, campaignId));
  revalidatePath('/campaigns');
  revalidatePath(`/campaigns/${campaignId}`);
}

/** Remove a milestone from the campaign. Submilestones go with it — by
 *  design: there is no archive notion, the user is asking for a clean
 *  delete. Toggling-back a deleted item requires re-adding. */
export async function deleteCampaignMilestone(
  campaignId: number,
  milestoneId: string,
) {
  const campaign = await db.query.campaigns.findFirst({
    where: eq(schema.campaigns.id, campaignId),
  });
  if (!campaign) throw new Error(`Kampania #${campaignId} nie istnieje.`);
  const milestones = campaign.milestones ?? [];
  const next = milestones.filter((m) => m.id !== milestoneId);
  await db
    .update(schema.campaigns)
    .set({ milestones: next })
    .where(eq(schema.campaigns.id, campaignId));
  revalidatePath('/campaigns');
  revalidatePath(`/campaigns/${campaignId}`);
}

/** Remove a single submilestone from its parent. */
export async function deleteCampaignSubmilestone(
  campaignId: number,
  milestoneId: string,
  submilestoneId: string,
) {
  const campaign = await db.query.campaigns.findFirst({
    where: eq(schema.campaigns.id, campaignId),
  });
  if (!campaign) throw new Error(`Kampania #${campaignId} nie istnieje.`);
  const milestones = campaign.milestones ?? [];
  const next = milestones.map((m) => {
    if (m.id !== milestoneId) return m;
    return {
      ...m,
      submilestones: m.submilestones.filter((s) => s.id !== submilestoneId),
    };
  });
  await db
    .update(schema.campaigns)
    .set({ milestones: next })
    .where(eq(schema.campaigns.id, campaignId));
  revalidatePath('/campaigns');
  revalidatePath(`/campaigns/${campaignId}`);
}
