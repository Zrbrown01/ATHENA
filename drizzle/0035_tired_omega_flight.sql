CREATE TABLE `tenant_export_decisions` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`export_id` text NOT NULL,
	`action` text NOT NULL,
	`outcome` text NOT NULL,
	`reason` text NOT NULL,
	`actor_id` text NOT NULL,
	`event_id` text NOT NULL,
	`idempotency_key` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_tenant_export_decision_idempotency` ON `tenant_export_decisions` (`tenant_id`,`idempotency_key`);--> statement-breakpoint
CREATE INDEX `idx_tenant_export_decision_history` ON `tenant_export_decisions` (`tenant_id`,`export_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `tenant_export_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`status` text NOT NULL,
	`purpose` text NOT NULL,
	`format` text NOT NULL,
	`completeness` text NOT NULL,
	`required_category_count` integer NOT NULL,
	`included_category_count` integer NOT NULL,
	`source_table_count` integer NOT NULL,
	`included_table_count` integer NOT NULL,
	`source_original_count` integer NOT NULL,
	`included_original_count` integer NOT NULL,
	`missing_items` text NOT NULL,
	`object_key` text NOT NULL,
	`sha256` text NOT NULL,
	`byte_size` integer NOT NULL,
	`archive_entry_count` integer NOT NULL,
	`restoration_verified_at` integer,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_tenant_export_object_key` ON `tenant_export_jobs` (`object_key`);--> statement-breakpoint
CREATE INDEX `idx_tenant_export_history` ON `tenant_export_jobs` (`tenant_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `tenant_export_scope_items` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`export_id` text NOT NULL,
	`category` text NOT NULL,
	`status` text NOT NULL,
	`record_count` integer NOT NULL,
	`source_tables` text NOT NULL,
	`reason` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_tenant_export_scope_category` ON `tenant_export_scope_items` (`tenant_id`,`export_id`,`category`);--> statement-breakpoint
PRAGMA optimize;
