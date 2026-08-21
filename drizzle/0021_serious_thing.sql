CREATE TABLE `filing_packet_decisions` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`matter_id` text NOT NULL,
	`packet_id` text NOT NULL,
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
CREATE UNIQUE INDEX `idx_filing_packet_decision_idempotency` ON `filing_packet_decisions` (`tenant_id`,`idempotency_key`);--> statement-breakpoint
CREATE INDEX `idx_filing_packet_decision_history` ON `filing_packet_decisions` (`tenant_id`,`packet_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `filing_packet_documents` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`matter_id` text NOT NULL,
	`packet_id` text NOT NULL,
	`kind` text NOT NULL,
	`title` text NOT NULL,
	`position` integer NOT NULL,
	`sha256` text NOT NULL,
	`signature_status` text NOT NULL,
	`source_document_id` text NOT NULL,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_filing_packet_document_position` ON `filing_packet_documents` (`tenant_id`,`packet_id`,`position`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_filing_packet_document_source` ON `filing_packet_documents` (`tenant_id`,`packet_id`,`source_document_id`);--> statement-breakpoint
CREATE TABLE `filing_packet_validations` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`matter_id` text NOT NULL,
	`packet_id` text NOT NULL,
	`packet_revision` integer NOT NULL,
	`outcome` text NOT NULL,
	`checks` text NOT NULL,
	`event_id` text NOT NULL,
	`validated_by` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_filing_validation_history` ON `filing_packet_validations` (`tenant_id`,`packet_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `filing_packets` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`matter_id` text NOT NULL,
	`proceeding_id` text NOT NULL,
	`form_definition_id` text NOT NULL,
	`packet_type` text NOT NULL,
	`adj_number` text,
	`uan` text,
	`venue` text,
	`judge` text,
	`status` text NOT NULL,
	`revision_number` integer NOT NULL,
	`prior_packet_id` text,
	`correction_reason` text,
	`submission_identity` text NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`approved_by` text,
	`approved_at` integer,
	`external_status_evidence` text,
	`external_reference` text,
	`provider_mode` text NOT NULL,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_filing_submission_revision` ON `filing_packets` (`tenant_id`,`submission_identity`,`revision_number`);--> statement-breakpoint
CREATE INDEX `idx_filing_packet_matter` ON `filing_packets` (`tenant_id`,`matter_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `jurisdiction_form_definitions` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`jurisdiction` text NOT NULL,
	`form_code` text NOT NULL,
	`version` integer NOT NULL,
	`official_title` text NOT NULL,
	`effective_at` integer NOT NULL,
	`review_by` integer NOT NULL,
	`source_authority` text NOT NULL,
	`content_status` text NOT NULL,
	`supersedes_id` text,
	`required_document_kinds` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_form_definition_version` ON `jurisdiction_form_definitions` (`tenant_id`,`jurisdiction`,`form_code`,`version`);
--> statement-breakpoint
PRAGMA optimize;
