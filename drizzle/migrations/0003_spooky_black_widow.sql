PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_productions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`type` text NOT NULL,
	`template_slug` text DEFAULT 'manual' NOT NULL,
	`status` text DEFAULT 'email-sent' NOT NULL,
	`title` text NOT NULL,
	`slug` text NOT NULL,
	`t0_at` integer NOT NULL,
	`step_dates` text,
	`artist_id` integer,
	`videographer_id` integer,
	`platforms` text,
	`campaign_id` integer,
	`folder_path` text,
	`notes` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`artist_id`) REFERENCES `artists`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`videographer_id`) REFERENCES `videographers`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_productions`("id", "type", "template_slug", "status", "title", "slug", "t0_at", "step_dates", "artist_id", "videographer_id", "platforms", "campaign_id", "folder_path", "notes", "created_at") SELECT "id", "type", "template_slug", "status", "title", "slug", "t0_at", NULL, "artist_id", "videographer_id", "platforms", "campaign_id", "folder_path", "notes", "created_at" FROM `productions`;--> statement-breakpoint
DROP TABLE `productions`;--> statement-breakpoint
ALTER TABLE `__new_productions` RENAME TO `productions`;--> statement-breakpoint
PRAGMA foreign_keys=ON;