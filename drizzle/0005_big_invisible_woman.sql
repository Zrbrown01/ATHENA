ALTER TABLE `export_jobs` ADD `archive_entry_count` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `export_jobs` ADD `restoration_verified_at` integer;--> statement-breakpoint
PRAGMA optimize;
