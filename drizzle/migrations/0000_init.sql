CREATE TABLE "agent_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"agent_slug" text NOT NULL,
	"input_json" jsonb NOT NULL,
	"output_text" text DEFAULT '' NOT NULL,
	"tokens_in" integer DEFAULT 0 NOT NULL,
	"tokens_out" integer DEFAULT 0 NOT NULL,
	"cost_estimate_usd" real DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "artists" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"handle" text,
	"email" text,
	"phone" text,
	"avatar_url" text,
	"notes" text,
	"last_contact_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "calendar_entries" (
	"id" serial PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"platforms" jsonb,
	"artist_id" integer,
	"campaign_id" integer,
	"production_id" integer,
	"stage" text,
	"brief_path" text,
	"status" text DEFAULT 'planned' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campaigns" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"goal" text NOT NULL,
	"release_at" timestamp with time zone NOT NULL,
	"phase" text DEFAULT 'build-up' NOT NULL,
	"kpis" jsonb,
	"notes" text,
	"template_slug" text,
	"periods" jsonb,
	"milestones" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "csv_rows" (
	"id" serial PRIMARY KEY NOT NULL,
	"upload_id" integer NOT NULL,
	"data" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "csv_uploads" (
	"id" serial PRIMARY KEY NOT NULL,
	"filename" text NOT NULL,
	"source" text NOT NULL,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"row_count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "posts" (
	"id" serial PRIMARY KEY NOT NULL,
	"published_at" timestamp with time zone NOT NULL,
	"platform" text NOT NULL,
	"title" text NOT NULL,
	"caption" text DEFAULT '' NOT NULL,
	"hashtags" jsonb,
	"asset_path" text,
	"campaign_id" integer,
	"production_id" integer,
	"reach" integer,
	"impressions" integer,
	"engagement_rate" real,
	"completion_rate" real,
	"saves" integer,
	"shares" integer,
	"comments" integer,
	"followers_gained" integer,
	"raw_csv_row_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "productions" (
	"id" serial PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"slug" text NOT NULL,
	"t0_at" timestamp with time zone NOT NULL,
	"steps" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"periods" jsonb,
	"cancelled_at" timestamp with time zone,
	"artist_id" integer,
	"videographer_id" integer,
	"platforms" jsonb,
	"campaign_id" integer,
	"folder_path" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "videographers" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"contact" text,
	"hourly_rate" real,
	"equipment" text,
	"availability_notes" text,
	"avatar_url" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "calendar_entries" ADD CONSTRAINT "calendar_entries_artist_id_artists_id_fk" FOREIGN KEY ("artist_id") REFERENCES "public"."artists"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_entries" ADD CONSTRAINT "calendar_entries_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_entries" ADD CONSTRAINT "calendar_entries_production_id_productions_id_fk" FOREIGN KEY ("production_id") REFERENCES "public"."productions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "csv_rows" ADD CONSTRAINT "csv_rows_upload_id_csv_uploads_id_fk" FOREIGN KEY ("upload_id") REFERENCES "public"."csv_uploads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_production_id_productions_id_fk" FOREIGN KEY ("production_id") REFERENCES "public"."productions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_raw_csv_row_id_csv_rows_id_fk" FOREIGN KEY ("raw_csv_row_id") REFERENCES "public"."csv_rows"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "productions" ADD CONSTRAINT "productions_artist_id_artists_id_fk" FOREIGN KEY ("artist_id") REFERENCES "public"."artists"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "productions" ADD CONSTRAINT "productions_videographer_id_videographers_id_fk" FOREIGN KEY ("videographer_id") REFERENCES "public"."videographers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "productions" ADD CONSTRAINT "productions_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE set null ON UPDATE no action;