CREATE TABLE `compliance_agreements` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`subprocessor_id` text NOT NULL,
	`agreement_type` text NOT NULL,
	`status` text NOT NULL,
	`effective_at` integer,
	`expires_at` integer,
	`artifact_ref` text NOT NULL,
	`artifact_sha256` text NOT NULL,
	`approved_by` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_compliance_agreement_type` ON `compliance_agreements` (`tenant_id`,`subprocessor_id`,`agreement_type`);--> statement-breakpoint
CREATE TABLE `compliance_registry_decisions` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`subprocessor_id` text NOT NULL,
	`action` text NOT NULL,
	`from_status` text NOT NULL,
	`to_status` text NOT NULL,
	`reason` text NOT NULL,
	`actor_id` text NOT NULL,
	`event_id` text NOT NULL,
	`idempotency_key` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_compliance_registry_idempotency` ON `compliance_registry_decisions` (`tenant_id`,`idempotency_key`);--> statement-breakpoint
CREATE INDEX `idx_compliance_registry_vendor` ON `compliance_registry_decisions` (`tenant_id`,`subprocessor_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `data_use_authorities` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`subprocessor_id` text NOT NULL,
	`purpose` text NOT NULL,
	`allowed_data_categories` text NOT NULL,
	`allowed_operations` text NOT NULL,
	`ai_allowed` integer NOT NULL,
	`training_use_prohibited` integer NOT NULL,
	`status` text NOT NULL,
	`approved_by` text NOT NULL,
	`approved_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_data_use_authority_subprocessor` ON `data_use_authorities` (`tenant_id`,`subprocessor_id`,`status`);--> statement-breakpoint
CREATE TABLE `provider_activation_assessments` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`subprocessor_id` text NOT NULL,
	`outcome` text NOT NULL,
	`missing_requirements` text NOT NULL,
	`credential_activation_allowed` integer NOT NULL,
	`provider_connected` integer NOT NULL,
	`detail` text NOT NULL,
	`assessed_by` text NOT NULL,
	`assessed_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_provider_activation_subprocessor` ON `provider_activation_assessments` (`tenant_id`,`subprocessor_id`,`assessed_at`);--> statement-breakpoint
CREATE TABLE `subprocessors` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`name` text NOT NULL,
	`service` text NOT NULL,
	`status` text NOT NULL,
	`data_regions` text NOT NULL,
	`data_categories` text NOT NULL,
	`uses_ai` integer NOT NULL,
	`training_use` text NOT NULL,
	`provider_connected` integer NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`owner_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_subprocessor_name` ON `subprocessors` (`tenant_id`,`name`);--> statement-breakpoint
CREATE TABLE `vendor_security_reviews` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`subprocessor_id` text NOT NULL,
	`outcome` text NOT NULL,
	`controls_reviewed` text NOT NULL,
	`evidence_ref` text NOT NULL,
	`evidence_sha256` text NOT NULL,
	`valid_until` integer NOT NULL,
	`reviewed_by` text NOT NULL,
	`reviewed_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_vendor_review_subprocessor` ON `vendor_security_reviews` (`tenant_id`,`subprocessor_id`,`reviewed_at`);--> statement-breakpoint
PRAGMA optimize;
