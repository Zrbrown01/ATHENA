ALTER TABLE `matter_access_policies` ADD `status` text DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE `matter_access_policies` ADD `placed_by` text DEFAULT 'legacy' NOT NULL;--> statement-breakpoint
ALTER TABLE `matter_access_policies` ADD `released_by` text;--> statement-breakpoint
ALTER TABLE `matter_access_policies` ADD `released_at` integer;--> statement-breakpoint
ALTER TABLE `matter_access_policies` ADD `release_reason` text;--> statement-breakpoint
ALTER TABLE `matter_access_policies` ADD `revision` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
PRAGMA optimize;
