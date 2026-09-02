CREATE INDEX "calendar_entries_production_id_idx" ON "calendar_entries" USING btree ("production_id");--> statement-breakpoint
CREATE INDEX "calendar_entries_campaign_id_idx" ON "calendar_entries" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "calendar_entries_artist_id_idx" ON "calendar_entries" USING btree ("artist_id");--> statement-breakpoint
CREATE INDEX "calendar_entries_starts_at_idx" ON "calendar_entries" USING btree ("starts_at");--> statement-breakpoint
CREATE INDEX "csv_rows_upload_id_idx" ON "csv_rows" USING btree ("upload_id");--> statement-breakpoint
CREATE INDEX "posts_campaign_id_idx" ON "posts" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "posts_production_id_idx" ON "posts" USING btree ("production_id");--> statement-breakpoint
CREATE INDEX "posts_raw_csv_row_id_idx" ON "posts" USING btree ("raw_csv_row_id");--> statement-breakpoint
CREATE INDEX "posts_published_at_idx" ON "posts" USING btree ("published_at");--> statement-breakpoint
CREATE INDEX "productions_campaign_id_idx" ON "productions" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "productions_artist_id_idx" ON "productions" USING btree ("artist_id");--> statement-breakpoint
CREATE INDEX "productions_videographer_id_idx" ON "productions" USING btree ("videographer_id");--> statement-breakpoint
CREATE INDEX "productions_t0_at_idx" ON "productions" USING btree ("t0_at");