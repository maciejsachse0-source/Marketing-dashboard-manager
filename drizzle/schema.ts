import { pgTable, serial, integer, text, real, timestamp, jsonb } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const PLATFORMS = ['instagram', 'tiktok', 'youtube', 'facebook', 'x', 'linkedin'] as const;
export type Platform = (typeof PLATFORMS)[number];

export const CALENDAR_TYPES = ['shoot', 'edit', 'publish', 'meeting', 'deadline'] as const;
export type CalendarType = (typeof CALENDAR_TYPES)[number];

export const CALENDAR_STATUSES = ['planned', 'done', 'cancelled'] as const;
export type CalendarStatus = (typeof CALENDAR_STATUSES)[number];

export const CAMPAIGN_PHASES = ['build-up', 'teaser', 'reveal', 'release', 'afterglow', 'done'] as const;
export type CampaignPhase = (typeof CAMPAIGN_PHASES)[number];

export const CSV_SOURCES = ['meta', 'tiktok', 'youtube'] as const;
export type CsvSource = (typeof CSV_SOURCES)[number];

export const PRODUCTION_TYPES = ['with-artist', 'solo'] as const;
export type ProductionType = (typeof PRODUCTION_TYPES)[number];

/** Pipeline category — used to bucket calendar entries on the production detail page. */
export const PRODUCTION_STAGES = [
  'outreach',
  'ustalenia',
  'nagrywanie',
  'obrobka',
  'publikacja',
] as const;
export type ProductionStage = (typeof PRODUCTION_STAGES)[number];

/** Legacy: user-added extra step inside a category. Slotted INTO the canonical
 *  sub-stage flow at a specific position via {@link CustomStep.positionAfter}.
 *  Being phased out — see {@link ProductionStep}. Kept for migration window. */
export type CustomStep = {
  id: string;
  label: string;
  /** Canonical sub-stage AFTER which this custom step sits in display order.
   *  Optional: undefined or unrecognised value falls back to "end of category". */
  positionAfter?: ProductionStatus;
  /** ISO timestamp when the step was checked off, or null if pending. */
  doneAt: string | null;
  /** Optional free-text description / notes for the step. */
  description?: string;
  /** Optional uploaded attachment — path relative to repo root, original
   *  filename and size for display. */
  attachmentPath?: string;
  attachmentName?: string;
  attachmentSize?: number;
};

/** Step's date semantics — copied from template at creation, controls how the
 *  step interacts with calendar entries and date-derivation rules. */
export const STEP_DATE_MODES = [
  /** No date attached to this step (e.g. publication final). */
  'none',
  /** User-recorded date — saved on the step but does NOT create a calendar entry. */
  'record',
  /** User-set date — creates/updates a linked calendar entry. */
  'calendar',
  /** Auto-derived from the step that has `isT0Anchor: true` (typically shooting). */
  'derived-from-shooting',
] as const;
export type StepDateMode = (typeof STEP_DATE_MODES)[number];

/** Calendar entry type used when a step has `dateMode: 'calendar'`. Mirrors
 *  the existing `CALENDAR_TYPES` enum (no new values). */
export type StepCalendarType = 'shoot' | 'edit' | 'meeting' | 'deadline';

/**
 * Flexible production step — replaces the old (canonical-status + customSteps
 * + stepOrder) trio. Each production now owns a flat ordered list of these,
 * cloned from a template at creation time. After cloning, the production is
 * fully independent — editing the template doesn't retroactively touch
 * existing productions.
 *
 * `id` is unique within the production. Templates use stable string ids; new
 * steps added via UI use a random id.
 */
export type ProductionStep = {
  id: string;
  category: ProductionStage;
  label: string;
  description?: string;
  /** ISO timestamp when the step was checked off; null if pending. */
  doneAt: string | null;
  /** ISO date — user-set when dateMode is record/calendar, auto-derived when
   *  dateMode is derived-from-shooting. */
  dateIso?: string;
  /** Static config copied from the template at creation. Drives calendar
   *  upserts, date pickers, and gantt anchoring. */
  dateMode?: StepDateMode;
  durationMinutes?: number;
  calendarType?: StepCalendarType;
  /** Exactly 0 or 1 step per production has this set — gantt uses it as the
   *  pipeline T-0 anchor (typically the shooting day). */
  isT0Anchor?: boolean;
  /** Optional uploaded attachment — same shape as legacy CustomStep. */
  attachmentPath?: string;
  attachmentName?: string;
  attachmentSize?: number;
};

/** Persisted period overrides — same shape as `TemplatePeriod` from the lib
 *  layer, redeclared here so the schema file stays dependency-free. Period
 *  count is variable; codes follow the T<idx+1> pattern enforced by
 *  `periodsSchema`. `name` is the human-readable phase title cloned from the
 *  template (e.g. "Build-up", "Reveal") — optional for backward compatibility
 *  with legacy rows persisted before names existed. */
export type ProductionPeriods = Array<{
  code: string;
  name?: string;
  startOffsetDays: number;
  endOffsetDays: number;
}>;

/** Persisted marketing-campaign milestones — cloned from a marketing template
 *  on creation. Each main milestone has a T-period bucket (T1..Tn, variable
 *  count to match the production model) + optional submilestones. doneAt is
 *  null until checked off (parent or child). */
export type CampaignMilestones = Array<{
  id: string;
  period: string;
  label: string;
  description?: string;
  doneAt: string | null;
  submilestones: Array<{
    id: string;
    label: string;
    description?: string;
    doneAt: string | null;
  }>;
}>;

export const PRODUCTION_STATUSES = [
  // Outreach
  'email-sent',
  'terms-accepted',
  'cam-meeting-set',
  // Ustalenia z kamerzystą
  'cam-date-shared',
  'script-discussed',
  'script-sent',
  // Produkcja
  'shooting',
  'editing',
  'publishing',
  'cancelled',
] as const;
export type ProductionStatus = (typeof PRODUCTION_STATUSES)[number];

/** Workflow order — used for next/prev step UI. `cancelled` is terminal off-track. */
export const PRODUCTION_PROGRESSION: ProductionStatus[] = [
  'email-sent',
  'terms-accepted',
  'cam-meeting-set',
  'cam-date-shared',
  'script-discussed',
  'script-sent',
  'shooting',
  'editing',
  'publishing',
];

export const artists = pgTable('artists', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  handle: text('handle'),
  email: text('email'),
  phone: text('phone'),
  avatarUrl: text('avatar_url'),
  notes: text('notes'),
  lastContactAt: timestamp('last_contact_at', { withTimezone: true, mode: 'date' }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
});

export const campaigns = pgTable('campaigns', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  goal: text('goal').notNull(),
  releaseAt: timestamp('release_at', { withTimezone: true, mode: 'date' }).notNull(),
  phase: text('phase').$type<CampaignPhase>().notNull().default('build-up'),
  kpis: jsonb('kpis').$type<Record<string, string | number>>(),
  notes: text('notes'),
  /** Slug of the marketing template the campaign was instantiated from.
   *  Recorded for audit only — milestones below are the source of truth. */
  templateSlug: text('template_slug'),
  /** T1/T2/T3 time-band offsets relative to T-0 — cloned from the marketing
   *  template at creation. NULL = legacy campaign created before milestones
   *  existed; consumers fall back to DEFAULT_PERIODS in that case. */
  periods: jsonb('periods').$type<ProductionPeriods>(),
  /** Cloned milestones + submilestones with done state. NULL = legacy
   *  campaign with no template — UI hides the milestone tracker. */
  milestones: jsonb('milestones').$type<CampaignMilestones>(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
});

export const videographers = pgTable('videographers', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  contact: text('contact'),
  hourlyRate: real('hourly_rate'),
  equipment: text('equipment'),
  availabilityNotes: text('availability_notes'),
  avatarUrl: text('avatar_url'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
});

export const productions = pgTable('productions', {
  id: serial('id').primaryKey(),
  type: text('type').$type<ProductionType>().notNull(),
  title: text('title').notNull(),
  slug: text('slug').notNull(),
  t0At: timestamp('t0_at', { withTimezone: true, mode: 'date' }).notNull(),
  /** Flexible-steps model — one ordered list per production, cloned from a
   *  template at creation. Replaces the legacy (status + stepDates +
   *  customSteps + stepOrder) quartet that was dropped in migration 0011. */
  steps: jsonb('steps').$type<ProductionStep[]>().notNull().default(sql`'[]'::jsonb`),
  /** T1/T2/T3 time-band offsets relative to T-0 Monday — cloned from the
   *  template at creation. NULL = legacy production created before flexible
   *  periods existed; consumers fall back to DEFAULT_PERIODS in that case. */
  periods: jsonb('periods').$type<ProductionPeriods>(),
  /** Production cancellation timestamp — replaces `status: 'cancelled'`. */
  cancelledAt: timestamp('cancelled_at', { withTimezone: true, mode: 'date' }),
  artistId: integer('artist_id').references(() => artists.id, { onDelete: 'set null' }),
  videographerId: integer('videographer_id').references(() => videographers.id, { onDelete: 'set null' }),
  platforms: jsonb('platforms').$type<Platform[]>(),
  campaignId: integer('campaign_id').references(() => campaigns.id, { onDelete: 'set null' }),
  folderPath: text('folder_path'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
});

export const calendarEntries = pgTable('calendar_entries', {
  id: serial('id').primaryKey(),
  type: text('type').$type<CalendarType>().notNull(),
  title: text('title').notNull(),
  description: text('description'),
  startsAt: timestamp('starts_at', { withTimezone: true, mode: 'date' }).notNull(),
  endsAt: timestamp('ends_at', { withTimezone: true, mode: 'date' }).notNull(),
  platforms: jsonb('platforms').$type<Platform[]>(),
  artistId: integer('artist_id').references(() => artists.id, { onDelete: 'set null' }),
  campaignId: integer('campaign_id').references(() => campaigns.id, { onDelete: 'set null' }),
  productionId: integer('production_id').references(() => productions.id, { onDelete: 'set null' }),
  stage: text('stage').$type<ProductionStage>(),
  briefPath: text('brief_path'),
  status: text('status').$type<CalendarStatus>().notNull().default('planned'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
});

export const csvUploads = pgTable('csv_uploads', {
  id: serial('id').primaryKey(),
  filename: text('filename').notNull(),
  source: text('source').$type<CsvSource>().notNull(),
  uploadedAt: timestamp('uploaded_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  rowCount: integer('row_count').notNull().default(0),
});

export const csvRows = pgTable('csv_rows', {
  id: serial('id').primaryKey(),
  uploadId: integer('upload_id').notNull().references(() => csvUploads.id, { onDelete: 'cascade' }),
  data: jsonb('data').$type<Record<string, unknown>>().notNull(),
});

export const posts = pgTable('posts', {
  id: serial('id').primaryKey(),
  publishedAt: timestamp('published_at', { withTimezone: true, mode: 'date' }).notNull(),
  platform: text('platform').$type<Platform>().notNull(),
  title: text('title').notNull(),
  caption: text('caption').notNull().default(''),
  hashtags: jsonb('hashtags').$type<string[]>(),
  assetPath: text('asset_path'),
  campaignId: integer('campaign_id').references(() => campaigns.id, { onDelete: 'set null' }),
  productionId: integer('production_id').references(() => productions.id, { onDelete: 'set null' }),
  reach: integer('reach'),
  impressions: integer('impressions'),
  engagementRate: real('engagement_rate'),
  completionRate: real('completion_rate'),
  saves: integer('saves'),
  shares: integer('shares'),
  comments: integer('comments'),
  followersGained: integer('followers_gained'),
  rawCsvRowId: integer('raw_csv_row_id').references(() => csvRows.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
});

/**
 * Agent definitions — replaces the per-file `data/agents/<slug>.json` store
 * so the catalog can be edited at runtime on Vercel (read-only filesystem).
 * `slug` is the natural primary key — it shows up in URLs and is referenced
 * by the production templates that an agent might use.
 *
 * `dashboardWidget` mirrors the legacy JSON shape: `{ query, template }` or
 * `null` when the agent has no widget. Keep as JSONB so the loader's Zod
 * schema stays the source of truth.
 */
export const agents = pgTable('agents', {
  slug: text('slug').primaryKey(),
  name: text('name').notNull(),
  description: text('description').notNull(),
  systemPrompt: text('system_prompt').notNull(),
  sidePanel: text('side_panel').notNull(),
  dashboardWidget: jsonb('dashboard_widget').$type<{ query: string; template: string } | null>(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
});

/**
 * Production template — recipe for new productions. Was `data/templates/*.json`.
 * `steps` and `periods` are large JSON blobs whose shape is enforced upstream
 * by the Zod schema in lib/production-templates.ts.
 */
export const productionTemplates = pgTable('production_templates', {
  slug: text('slug').primaryKey(),
  name: text('name').notNull(),
  type: text('type').$type<ProductionType>().notNull(),
  summary: text('summary').notNull(),
  description: text('description').notNull(),
  steps: jsonb('steps').notNull(),
  periods: jsonb('periods'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
});

/**
 * Marketing-campaign template — recipe for new campaigns.
 * Was `data/campaign-templates/*.json`. Shape enforced upstream by Zod.
 */
export const marketingTemplates = pgTable('marketing_templates', {
  slug: text('slug').primaryKey(),
  name: text('name').notNull(),
  summary: text('summary').notNull(),
  description: text('description').notNull(),
  periods: jsonb('periods'),
  milestones: jsonb('milestones').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
});

export const agentRuns = pgTable('agent_runs', {
  id: serial('id').primaryKey(),
  agentSlug: text('agent_slug').notNull(),
  inputJson: jsonb('input_json').$type<unknown>().notNull(),
  outputText: text('output_text').notNull().default(''),
  tokensIn: integer('tokens_in').notNull().default(0),
  tokensOut: integer('tokens_out').notNull().default(0),
  costEstimateUsd: real('cost_estimate_usd').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
});

export type Artist = typeof artists.$inferSelect;
export type NewArtist = typeof artists.$inferInsert;
export type Campaign = typeof campaigns.$inferSelect;
export type NewCampaign = typeof campaigns.$inferInsert;
export type CalendarEntry = typeof calendarEntries.$inferSelect;
export type NewCalendarEntry = typeof calendarEntries.$inferInsert;
export type Post = typeof posts.$inferSelect;
export type NewPost = typeof posts.$inferInsert;
export type CsvUpload = typeof csvUploads.$inferSelect;
export type CsvRow = typeof csvRows.$inferSelect;
export type AgentRun = typeof agentRuns.$inferSelect;
export type Production = typeof productions.$inferSelect;
export type NewProduction = typeof productions.$inferInsert;
export type Videographer = typeof videographers.$inferSelect;
export type NewVideographer = typeof videographers.$inferInsert;
