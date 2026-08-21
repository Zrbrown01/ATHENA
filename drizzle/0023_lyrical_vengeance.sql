CREATE TABLE `bates_assignments` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`matter_id` text NOT NULL,
	`derivative_id` text NOT NULL,
	`prefix` text NOT NULL,
	`start_number` integer NOT NULL,
	`end_number` integer NOT NULL,
	`digits` integer NOT NULL,
	`assigned_by` text NOT NULL,
	`event_id` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_bates_derivative` ON `bates_assignments` (`tenant_id`,`derivative_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_bates_range_start` ON `bates_assignments` (`tenant_id`,`matter_id`,`prefix`,`start_number`);--> statement-breakpoint
CREATE TABLE `document_derivatives` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`matter_id` text NOT NULL,
	`evidence_id` text NOT NULL,
	`parent_derivative_id` text,
	`derivative_kind` text NOT NULL,
	`version` integer NOT NULL,
	`title` text NOT NULL,
	`object_key` text,
	`sha256` text,
	`source_page_start` integer NOT NULL,
	`source_page_end` integer NOT NULL,
	`status` text NOT NULL,
	`provider_mode` text NOT NULL,
	`approved_by` text,
	`approved_at` integer,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_derivative_version` ON `document_derivatives` (`tenant_id`,`evidence_id`,`derivative_kind`,`version`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_derivative_object` ON `document_derivatives` (`object_key`);--> statement-breakpoint
CREATE INDEX `idx_derivative_lineage` ON `document_derivatives` (`tenant_id`,`evidence_id`,`parent_derivative_id`);--> statement-breakpoint
CREATE TABLE `document_evidence_decisions` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`matter_id` text NOT NULL,
	`aggregate_type` text NOT NULL,
	`aggregate_id` text NOT NULL,
	`action` text NOT NULL,
	`from_status` text NOT NULL,
	`to_status` text NOT NULL,
	`evidence` text,
	`actor_id` text NOT NULL,
	`event_id` text NOT NULL,
	`idempotency_key` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_document_evidence_decision_idempotency` ON `document_evidence_decisions` (`tenant_id`,`idempotency_key`);--> statement-breakpoint
CREATE INDEX `idx_document_evidence_decision_history` ON `document_evidence_decisions` (`tenant_id`,`aggregate_type`,`aggregate_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `document_evidence_records` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`matter_id` text NOT NULL,
	`source_type` text NOT NULL,
	`source_id` text NOT NULL,
	`title` text NOT NULL,
	`original_object_key` text NOT NULL,
	`original_sha256` text NOT NULL,
	`byte_size` integer NOT NULL,
	`mime_type` text NOT NULL,
	`page_count` integer NOT NULL,
	`custody_status` text NOT NULL,
	`privilege` text NOT NULL,
	`confidentiality` text NOT NULL,
	`retention_policy_id` text,
	`legal_hold_required` integer NOT NULL,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_evidence_source` ON `document_evidence_records` (`tenant_id`,`source_type`,`source_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_evidence_original_object` ON `document_evidence_records` (`original_object_key`);--> statement-breakpoint
CREATE INDEX `idx_evidence_matter` ON `document_evidence_records` (`tenant_id`,`matter_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `exhibit_assignments` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`matter_id` text NOT NULL,
	`derivative_id` text NOT NULL,
	`proceeding_id` text NOT NULL,
	`exhibit_label` text NOT NULL,
	`description` text NOT NULL,
	`assigned_by` text NOT NULL,
	`event_id` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_exhibit_label` ON `exhibit_assignments` (`tenant_id`,`proceeding_id`,`exhibit_label`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_exhibit_derivative` ON `exhibit_assignments` (`tenant_id`,`proceeding_id`,`derivative_id`);--> statement-breakpoint
CREATE TABLE `production_set_items` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`matter_id` text NOT NULL,
	`production_set_id` text NOT NULL,
	`evidence_id` text NOT NULL,
	`derivative_id` text NOT NULL,
	`position` integer NOT NULL,
	`included_page_start` integer NOT NULL,
	`included_page_end` integer NOT NULL,
	`privilege_reviewed` integer NOT NULL,
	`confidentiality_reviewed` integer NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_production_item_position` ON `production_set_items` (`tenant_id`,`production_set_id`,`position`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_production_item_derivative` ON `production_set_items` (`tenant_id`,`production_set_id`,`derivative_id`);--> statement-breakpoint
CREATE TABLE `production_sets` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`matter_id` text NOT NULL,
	`title` text NOT NULL,
	`purpose` text NOT NULL,
	`status` text NOT NULL,
	`item_count` integer NOT NULL,
	`page_count` integer NOT NULL,
	`manifest_object_key` text,
	`manifest_sha256` text,
	`revision` integer DEFAULT 1 NOT NULL,
	`approved_by` text,
	`approved_at` integer,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_production_set_matter` ON `production_sets` (`tenant_id`,`matter_id`,`created_at`);
--> statement-breakpoint
PRAGMA optimize;
