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

export const PRODUCTION_STATUSES = [
  'idea',
  'planning',
  'outreach',
  'confirmed',
  'briefing',
  'ready-to-shoot',
  'shooting',
  'editing',
  'review',
  'approved',
  'publishing',
  'published',
  'analyzed',
  'cancelled',
] as const;
export type ProductionStatus = (typeof PRODUCTION_STATUSES)[number];

/** Workflow order — used for next/prev step UI. `cancelled` is terminal off-track. */
export const PRODUCTION_PROGRESSION: ProductionStatus[] = [
  'idea',
  'planning',
  'outreach',
  'confirmed',
  'briefing',
  'ready-to-shoot',
  'shooting',
  'editing',
  'review',
  'approved',
  'publishing',
  'published',
  'analyzed',
];

const now = sql`(unixepoch() * 1000)`;

export const artists = sqliteTable('artists', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  handle: text('handle'),
  email: text('email'),
  phone: text('phone'),
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
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull().default(now),
});

export const productions = sqliteTable('productions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  type: text('type').$type<ProductionType>().notNull(),
  templateSlug: text('template_slug').notNull().default('manual'),
  status: text('status').$type<ProductionStatus>().notNull().default('idea'),
  title: text('title').notNull(),
  slug: text('slug').notNull(),
  t0At: integer('t0_at', { mode: 'timestamp_ms' }).notNull(),
  artistId: integer('artist_id').references(() => artists.id, { onDelete: 'set null' }),
  videographerId: integer('videographer_id'),
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
