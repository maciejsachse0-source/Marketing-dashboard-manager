CREATE TABLE `agent_runs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`agent_slug` text NOT NULL,
	`input_json` text NOT NULL,
	`output_text` text DEFAULT '' NOT NULL,
	`tokens_in` integer DEFAULT 0 NOT NULL,
	`tokens_out` integer DEFAULT 0 NOT NULL,
	`cost_estimate_usd` real DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `artists` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`handle` text,
	`email` text,
	`phone` text,
	`notes` text,
	`last_contact_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `calendar_entries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`starts_at` integer NOT NULL,
	`ends_at` integer NOT NULL,
	`platforms` text,
	`artist_id` integer,
	`campaign_id` integer,
	`brief_path` text,
	`status` text DEFAULT 'planned' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`artist_id`) REFERENCES `artists`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `campaigns` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`goal` text NOT NULL,
	`release_at` integer NOT NULL,
	`phase` text DEFAULT 'build-up' NOT NULL,
	`kpis` text,
	`notes` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `csv_rows` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`upload_id` integer NOT NULL,
	`data` text NOT NULL,
	FOREIGN KEY (`upload_id`) REFERENCES `csv_uploads`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `csv_uploads` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`filename` text NOT NULL,
	`source` text NOT NULL,
	`uploaded_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`row_count` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `packages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`asset_path` text,
	`platforms` text NOT NULL,
	`captions` text NOT NULL,
	`hashtags` text NOT NULL,
	`cta` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`published_post_ids` text,
	`campaign_id` integer,
	`scheduled_for` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `posts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`published_at` integer NOT NULL,
	`platform` text NOT NULL,
	`title` text NOT NULL,
	`caption` text DEFAULT '' NOT NULL,
	`hashtags` text,
	`asset_path` text,
	`campaign_id` integer,
	`reach` integer,
	`impressions` integer,
	`engagement_rate` real,
	`completion_rate` real,
	`saves` integer,
	`shares` integer,
	`comments` integer,
	`followers_gained` integer,
	`raw_csv_row_id` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`raw_csv_row_id`) REFERENCES `csv_rows`(`id`) ON UPDATE no action ON DELETE set null
);
