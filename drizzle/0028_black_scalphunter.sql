CREATE TABLE `migration_acceptances` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`batch_id` text NOT NULL,
	`outcome` text NOT NULL,
	`scope` text NOT NULL,
	`evidence` text NOT NULL,
	`accepted_by` text NOT NULL,
	`accepted_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_migration_acceptance_batch` ON `migration_acceptances` (`tenant_id`,`batch_id`,`accepted_at`);--> statement-breakpoint
CREATE TABLE `migration_batches` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`source_system_id` text NOT NULL,
	`package_id` text NOT NULL,
	`mapping_version_id` text NOT NULL,
	`status` text NOT NULL,
	`source_record_count` integer NOT NULL,
	`staged_record_count` integer NOT NULL,
	`accepted_record_count` integer NOT NULL,
	`exception_count` integer NOT NULL,
	`source_aggregate_sha256` text NOT NULL,
	`target_aggregate_sha256` text,
	`resumable` integer NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_migration_batch_status` ON `migration_batches` (`tenant_id`,`status`,`updated_at`);--> statement-breakpoint
CREATE TABLE `migration_cutovers` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`batch_id` text NOT NULL,
	`status` text NOT NULL,
	`rollback_plan` text NOT NULL,
	`source_write_frozen` integer NOT NULL,
	`legacy_archive_read_only` integer NOT NULL,
	`authorized_by` text NOT NULL,
	`authorized_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_migration_cutover_batch` ON `migration_cutovers` (`tenant_id`,`batch_id`,`authorized_at`);--> statement-breakpoint
CREATE TABLE `migration_decisions` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`batch_id` text NOT NULL,
	`action` text NOT NULL,
	`from_status` text NOT NULL,
	`to_status` text NOT NULL,
	`reason` text,
	`actor_id` text NOT NULL,
	`event_id` text NOT NULL,
	`idempotency_key` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_migration_decision_idempotency` ON `migration_decisions` (`tenant_id`,`idempotency_key`);--> statement-breakpoint
CREATE INDEX `idx_migration_decision_batch` ON `migration_decisions` (`tenant_id`,`batch_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `migration_exceptions` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`batch_id` text NOT NULL,
	`migration_record_id` text NOT NULL,
	`code` text NOT NULL,
	`severity` text NOT NULL,
	`detail` text NOT NULL,
	`status` text NOT NULL,
	`resolution` text,
	`resolved_by` text,
	`resolved_at` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_migration_exception_batch` ON `migration_exceptions` (`tenant_id`,`batch_id`,`status`);--> statement-breakpoint
CREATE TABLE `migration_export_packages` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`source_system_id` text NOT NULL,
	`file_name` text NOT NULL,
	`sha256` text NOT NULL,
	`byte_size` integer NOT NULL,
	`record_count` integer NOT NULL,
	`object_key` text,
	`custody_status` text NOT NULL,
	`immutable` integer NOT NULL,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_migration_package_checksum` ON `migration_export_packages` (`tenant_id`,`sha256`);--> statement-breakpoint
CREATE TABLE `migration_mapping_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`source_system_id` text NOT NULL,
	`version` integer NOT NULL,
	`status` text NOT NULL,
	`entity_mappings` text NOT NULL,
	`preserves_separate_identities` integer NOT NULL,
	`transformation_checksum` text NOT NULL,
	`approved_by` text,
	`approved_at` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_migration_mapping_version` ON `migration_mapping_versions` (`tenant_id`,`source_system_id`,`version`);--> statement-breakpoint
CREATE TABLE `migration_reconciliations` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`batch_id` text NOT NULL,
	`source_count` integer NOT NULL,
	`target_count` integer NOT NULL,
	`open_exception_count` integer NOT NULL,
	`source_aggregate_sha256` text NOT NULL,
	`target_aggregate_sha256` text NOT NULL,
	`outcome` text NOT NULL,
	`detail` text NOT NULL,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_migration_reconciliation_batch` ON `migration_reconciliations` (`tenant_id`,`batch_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `migration_records` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`batch_id` text NOT NULL,
	`source_system_id` text NOT NULL,
	`source_record_type` text NOT NULL,
	`source_record_id` text NOT NULL,
	`target_entity_type` text NOT NULL,
	`target_entity_id` text NOT NULL,
	`status` text NOT NULL,
	`source_sha256` text NOT NULL,
	`transformed_sha256` text,
	`file_custody_status` text NOT NULL,
	`correction_evidence` text,
	`corrected_by` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_migration_record_source_once` ON `migration_records` (`tenant_id`,`source_system_id`,`source_record_type`,`source_record_id`);--> statement-breakpoint
CREATE INDEX `idx_migration_record_batch` ON `migration_records` (`tenant_id`,`batch_id`,`status`);--> statement-breakpoint
CREATE TABLE `migration_source_systems` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`name` text NOT NULL,
	`provider` text NOT NULL,
	`provider_mode` text NOT NULL,
	`status` text NOT NULL,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_migration_source_name` ON `migration_source_systems` (`tenant_id`,`name`);
--> statement-breakpoint
PRAGMA optimize;
