CREATE TABLE `productions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`type` text NOT NULL,
	`template_slug` text DEFAULT 'manual' NOT NULL,
	`status` text DEFAULT 'idea' NOT NULL,
	`title` text NOT NULL,
	`slug` text NOT NULL,
	`t0_at` integer NOT NULL,
	`artist_id` integer,
	`videographer_id` integer,
	`platforms` text,
	`campaign_id` integer,
	`folder_path` text,
	`notes` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`artist_id`) REFERENCES `artists`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
ALTER TABLE `calendar_entries` ADD `production_id` integer REFERENCES productions(id);--> statement-breakpoint
ALTER TABLE `packages` ADD `production_id` integer REFERENCES productions(id);--> statement-breakpoint
ALTER TABLE `posts` ADD `production_id` integer REFERENCES productions(id);