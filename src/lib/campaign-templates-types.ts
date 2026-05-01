import type { TemplatePeriod } from './production-periods';

/**
 * Submilestone — atomic check inside a main milestone. Has only a label and an
 * optional description. Submilestones are checked off independently; their
 * parent milestone is "done" when all submilestones are done (or when the user
 * explicitly marks it done if there are no submilestones).
 */
export type MarketingSubmilestone = {
  id: string;
  label: string;
  description?: string;
};

/**
 * Main milestone — bucketed under one of the campaign's T-periods (T1..Tn,
 * variable count). The number of periods is owned by the template/campaign,
 * so milestones reference period codes by string. UI renders a milestone
 * inside the period whose code matches.
 */
export type MarketingMilestone = {
  id: string;
  period: string;
  label: string;
  description?: string;
  submilestones: MarketingSubmilestone[];
};

/**
 * Marketing campaign template — recipe for spinning up a new campaign. Same
 * "clone-on-create" semantics as production templates: editing a template
 * later does NOT retroactively update existing campaigns.
 *
 * Periods describe the campaign's narrative arc (e.g. T1 build-up → T2
 * tension → T3 reveal → T4 climax → T5 afterglow), each anchored at a
 * non-negative day offset from the kickoff. Default is 3 contiguous 7-day
 * periods, but campaigns commonly run longer arcs with more phases.
 */
export type MarketingTemplate = {
  slug: string;
  name: string;
  summary: string;
  description: string;
  /** Optional T-period overrides (1..6 periods). Defaults to DEFAULT_PERIODS. */
  periods?: TemplatePeriod[];
  milestones: MarketingMilestone[];
};

/**
 * Persisted campaign milestone state — milestone definition cloned from the
 * template + per-submilestone done timestamps. Stored as JSON on
 * `campaigns.milestones`.
 */
export type CampaignMilestone = {
  id: string;
  period: string;
  label: string;
  description?: string;
  doneAt: string | null;
  submilestones: CampaignSubmilestone[];
};

export type CampaignSubmilestone = {
  id: string;
  label: string;
  description?: string;
  doneAt: string | null;
};
