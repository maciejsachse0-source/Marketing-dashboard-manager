import { sqliteTable, integer, text, real } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const PLATFORMS = ['instagram', 'tiktok', 'youtube', 'facebook', 'x', 'linkedin'] as const;
export type Platform = (typeof PLATFORMS)[number];

export const CALENDAR_TYPES = ['shoot', 'edit', 'publish', 'meeting', 'deadline'] as const;
export type CalendarType = (typeof CALENDAR_TYPES)[number];

export const CALENDAR_STATUSES = ['planned', 'done', 'cancelled'] as const;
export type CalendarStatus = (typeof CALENDAR_STATUSES)[number];

export const CAMPAIGN_PHASES = ['build-up', 'teaser', 'reveal', 'release', 'afterglow', 'done'] as const;
export type CampaignPhase = (typeof CAMPAIGN_PHASES)[number];

export const PACKAGE_STATUSES = ['draft', 'ready', 'published'] as const;
export type PackageStatus = (typeof PACKAGE_STATUSES)[number];

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
 *  `periodsSchema`. */
export type ProductionPeriods = Array<{
  code: string;
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

const now = sql`(unixepoch() * 1000)`;

export const artists = sqliteTable('artists', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  handle: text('handle'),
  email: text('email'),
  phone: text('phone'),
  avatarUrl: text('avatar_url'),
  notes: text('notes'),
  lastContactAt: integer('last_contact_at', { mode: 'timestamp_ms' }),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull().default(now),
});

export const campaigns = sqliteTable('campaigns', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  goal: text('goal').notNull(),
  releaseAt: integer('release_at', { mode: 'timestamp_ms' }).notNull(),
  phase: text('phase').$type<CampaignPhase>().notNull().default('build-up'),
  kpis: text('kpis', { mode: 'json' }).$type<Record<string, string | number>>(),
  notes: text('notes'),
  /** Slug of the marketing template the campaign was instantiated from.
   *  Recorded for audit only — milestones below are the source of truth. */
  templateSlug: text('template_slug'),
  /** T1/T2/T3 time-band offsets relative to T-0 — cloned from the marketing
   *  template at creation. NULL = legacy campaign created before milestones
   *  existed; consumers fall back to DEFAULT_PERIODS in that case. */
  periods: text('periods', { mode: 'json' }).$type<ProductionPeriods>(),
  /** Cloned milestones + submilestones with done state. NULL = legacy
   *  campaign with no template — UI hides the milestone tracker. */
  milestones: text('milestones', { mode: 'json' }).$type<CampaignMilestones>(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull().default(now),
});

export const videographers = sqliteTable('videographers', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  contact: text('contact'),
  hourlyRate: real('hourly_rate'),
  equipment: text('equipment'),
  availabilityNotes: text('availability_notes'),
  avatarUrl: text('avatar_url'),
  notes: text('notes'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull().default(now),
});

export const productions = sqliteTable('productions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  type: text('type').$type<ProductionType>().notNull(),
  title: text('title').notNull(),
  slug: text('slug').notNull(),
  t0At: integer('t0_at', { mode: 'timestamp_ms' }).notNull(),
  /** Flexible-steps model — one ordered list per production, cloned from a
   *  template at creation. Replaces the legacy (status + stepDates +
   *  customSteps + stepOrder) quartet that was dropped in migration 0011. */
  steps: text('steps', { mode: 'json' }).$type<ProductionStep[]>().notNull().default(sql`'[]'`),
  /** T1/T2/T3 time-band offsets relative to T-0 Monday — cloned from the
   *  template at creation. NULL = legacy production created before flexible
   *  periods existed; consumers fall back to DEFAULT_PERIODS in that case. */
  periods: text('periods', { mode: 'json' }).$type<ProductionPeriods>(),
  /** Production cancellation timestamp — replaces `status: 'cancelled'`. */
  cancelledAt: integer('cancelled_at', { mode: 'timestamp_ms' }),
  artistId: integer('artist_id').references(() => artists.id, { onDelete: 'set null' }),
  videographerId: integer('videographer_id').references(() => videographers.id, { onDelete: 'set null' }),
  platforms: text('platforms', { mode: 'json' }).$type<Platform[]>(),
  campaignId: integer('campaign_id').references(() => campaigns.id, { onDelete: 'set null' }),
  folderPath: text('folder_path'),
  notes: text('notes'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull().default(now),
});

export const calendarEntries = sqliteTable('calendar_entries', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  type: text('type').$type<CalendarType>().notNull(),
  title: text('title').notNull(),
  description: text('description'),
  startsAt: integer('starts_at', { mode: 'timestamp_ms' }).notNull(),
  endsAt: integer('ends_at', { mode: 'timestamp_ms' }).notNull(),
  platforms: text('platforms', { mode: 'json' }).$type<Platform[]>(),
  artistId: integer('artist_id').references(() => artists.id, { onDelete: 'set null' }),
  campaignId: integer('campaign_id').references(() => campaigns.id, { onDelete: 'set null' }),
  productionId: integer('production_id').references(() => productions.id, { onDelete: 'set null' }),
  stage: text('stage').$type<ProductionStage>(),
  briefPath: text('brief_path'),
  status: text('status').$type<CalendarStatus>().notNull().default('planned'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull().default(now),
});

export const csvUploads = sqliteTable('csv_uploads', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  filename: text('filename').notNull(),
  source: text('source').$type<CsvSource>().notNull(),
  uploadedAt: integer('uploaded_at', { mode: 'timestamp_ms' }).notNull().default(now),
  rowCount: integer('row_count').notNull().default(0),
});

export const csvRows = sqliteTable('csv_rows', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  uploadId: integer('upload_id').notNull().references(() => csvUploads.id, { onDelete: 'cascade' }),
  data: text('data', { mode: 'json' }).$type<Record<string, unknown>>().notNull(),
});

export const posts = sqliteTable('posts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  publishedAt: integer('published_at', { mode: 'timestamp_ms' }).notNull(),
  platform: text('platform').$type<Platform>().notNull(),
  title: text('title').notNull(),
  caption: text('caption').notNull().default(''),
  hashtags: text('hashtags', { mode: 'json' }).$type<string[]>(),
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
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull().default(now),
});

export const packages = sqliteTable('packages', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  assetPath: text('asset_path'),
  platforms: text('platforms', { mode: 'json' }).$type<Platform[]>().notNull(),
  captions: text('captions', { mode: 'json' }).$type<Partial<Record<Platform, string>>>().notNull(),
  hashtags: text('hashtags', { mode: 'json' }).$type<Partial<Record<Platform, string[]>>>().notNull(),
  cta: text('cta'),
  status: text('status').$type<PackageStatus>().notNull().default('draft'),
  publishedPostIds: text('published_post_ids', { mode: 'json' }).$type<number[]>(),
  campaignId: integer('campaign_id').references(() => campaigns.id, { onDelete: 'set null' }),
  productionId: integer('production_id').references(() => productions.id, { onDelete: 'set null' }),
  scheduledFor: integer('scheduled_for', { mode: 'timestamp_ms' }),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull().default(now),
});

export const agentRuns = sqliteTable('agent_runs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  agentSlug: text('agent_slug').notNull(),
  inputJson: text('input_json', { mode: 'json' }).$type<unknown>().notNull(),
  outputText: text('output_text').notNull().default(''),
  tokensIn: integer('tokens_in').notNull().default(0),
  tokensOut: integer('tokens_out').notNull().default(0),
  costEstimateUsd: real('cost_estimate_usd').notNull().default(0),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull().default(now),
});

export type Artist = typeof artists.$inferSelect;
export type NewArtist = typeof artists.$inferInsert;
export type Campaign = typeof campaigns.$inferSelect;
export type NewCampaign = typeof campaigns.$inferInsert;
export type CalendarEntry = typeof calendarEntries.$inferSelect;
export type NewCalendarEntry = typeof calendarEntries.$inferInsert;
export type Post = typeof posts.$inferSelect;
export type NewPost = typeof posts.$inferInsert;
export type Package = typeof packages.$inferSelect;
export type NewPackage = typeof packages.$inferInsert;
export type CsvUpload = typeof csvUploads.$inferSelect;
export type CsvRow = typeof csvRows.$inferSelect;
export type AgentRun = typeof agentRuns.$inferSelect;
export type Production = typeof productions.$inferSelect;
export type NewProduction = typeof productions.$inferInsert;
export type Videographer = typeof videographers.$inferSelect;
export type NewVideographer = typeof videographers.$inferInsert;
