CREATE TABLE `client_instruction_decisions` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`matter_id` text NOT NULL,
	`instruction_id` text NOT NULL,
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
CREATE UNIQUE INDEX `idx_client_instruction_decision_idempotency` ON `client_instruction_decisions` (`tenant_id`,`idempotency_key`);--> statement-breakpoint
CREATE INDEX `idx_client_instruction_decision_history` ON `client_instruction_decisions` (`tenant_id`,`instruction_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `client_instruction_reviews` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`matter_id` text NOT NULL,
	`instruction_id` text NOT NULL,
	`review_type` text NOT NULL,
	`outcome` text NOT NULL,
	`source_sha256` text NOT NULL,
	`evidence` text NOT NULL,
	`reviewer_id` text NOT NULL,
	`event_id` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_client_instruction_review_type` ON `client_instruction_reviews` (`tenant_id`,`instruction_id`,`review_type`);--> statement-breakpoint
CREATE INDEX `idx_client_instruction_review_history` ON `client_instruction_reviews` (`tenant_id`,`instruction_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `client_instruction_sources` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`matter_id` text NOT NULL,
	`client_id` text NOT NULL,
	`evidence_id` text NOT NULL,
	`code` text NOT NULL,
	`version` integer NOT NULL,
	`title` text NOT NULL,
	`source_sha256` text NOT NULL,
	`source_object_key` text NOT NULL,
	`source_byte_size` integer NOT NULL,
	`business_days` integer NOT NULL,
	`authority_citation` text NOT NULL,
	`effective_at` integer NOT NULL,
	`review_by` integer NOT NULL,
	`source_mode` text NOT NULL,
	`status` text NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`activated_layer_id` text,
	`created_by` text NOT NULL,
	`activated_by` text,
	`activated_at` integer,
	`deactivated_by` text,
	`deactivated_at` integer,
	`deactivation_reason` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_client_instruction_version` ON `client_instruction_sources` (`tenant_id`,`client_id`,`code`,`version`);--> statement-breakpoint
CREATE INDEX `idx_client_instruction_status` ON `client_instruction_sources` (`tenant_id`,`client_id`,`status`);--> statement-breakpoint
ALTER TABLE `governance_policy_layers` ADD `source_kind` text DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE `governance_policy_layers` ADD `source_id` text;--> statement-breakpoint
ALTER TABLE `governance_policy_layers` ADD `source_sha256` text;