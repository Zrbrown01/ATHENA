CREATE TABLE `audit_records` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`actor_id` text NOT NULL,
	`actor_email` text NOT NULL,
	`action` text NOT NULL,
	`resource_type` text NOT NULL,
	`resource_id` text NOT NULL,
	`outcome` text NOT NULL,
	`reason` text NOT NULL,
	`request_id` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_audit_tenant_request` ON `audit_records` (`tenant_id`,`request_id`);--> statement-breakpoint
CREATE INDEX `idx_audit_tenant_resource` ON `audit_records` (`tenant_id`,`resource_type`,`resource_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `billing_validations` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`matter_id` text NOT NULL,
	`run_id` text NOT NULL,
	`candidate_time_id` text NOT NULL,
	`rule_code` text NOT NULL,
	`rule_version` text NOT NULL,
	`outcome` text NOT NULL,
	`explanation` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_billing_validations_tenant_run` ON `billing_validations` (`tenant_id`,`run_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `candidate_time_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`matter_id` text NOT NULL,
	`run_id` text NOT NULL,
	`minutes` integer NOT NULL,
	`narrative` text NOT NULL,
	`task_code` text NOT NULL,
	`activity_code` text NOT NULL,
	`status` text NOT NULL,
	`confirmed_by` text NOT NULL,
	`confirmed_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_candidate_time_tenant_run` ON `candidate_time_entries` (`tenant_id`,`run_id`,`confirmed_at`);--> statement-breakpoint
CREATE TABLE `companion_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`matter_id` text NOT NULL,
	`stage` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`source_system` text DEFAULT 'meruscase_deterministic_sandbox' NOT NULL,
	`provider_mode` text DEFAULT 'deterministic_sandbox' NOT NULL,
	`document_title` text,
	`report_title` text,
	`delivery_status` text,
	`candidate_time_minutes` integer,
	`billing_status` text,
	`export_job_id` text,
	`last_event_id` text NOT NULL,
	`actor_id` text NOT NULL,
	`actor_email` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_companion_runs_tenant_matter` ON `companion_runs` (`tenant_id`,`matter_id`);--> statement-breakpoint
CREATE INDEX `idx_companion_runs_tenant_stage` ON `companion_runs` (`tenant_id`,`stage`,`updated_at`);--> statement-breakpoint
CREATE TABLE `export_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`matter_id` text NOT NULL,
	`run_id` text NOT NULL,
	`status` text NOT NULL,
	`object_key` text NOT NULL,
	`sha256` text NOT NULL,
	`byte_size` integer NOT NULL,
	`format` text NOT NULL,
	`manifest_version` integer NOT NULL,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_export_jobs_object_key` ON `export_jobs` (`object_key`);--> statement-breakpoint
CREATE INDEX `idx_export_jobs_tenant_matter` ON `export_jobs` (`tenant_id`,`matter_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `integration_handoffs` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`matter_id` text NOT NULL,
	`run_id` text NOT NULL,
	`provider` text NOT NULL,
	`operation` text NOT NULL,
	`status` text NOT NULL,
	`provider_mode` text NOT NULL,
	`retryable` integer NOT NULL,
	`activation_requirement` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_handoffs_tenant_run` ON `integration_handoffs` (`tenant_id`,`run_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `work_product_drafts` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`matter_id` text NOT NULL,
	`run_id` text NOT NULL,
	`work_product_type` text NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`source_document_id` text NOT NULL,
	`source_fact_ids` text NOT NULL,
	`status` text NOT NULL,
	`provider_mode` text NOT NULL,
	`approved_by` text,
	`approved_at` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_work_product_tenant_run` ON `work_product_drafts` (`tenant_id`,`run_id`,`created_at`);--> statement-breakpoint
ALTER TABLE `preview_events` ADD `causation_id` text;--> statement-breakpoint
ALTER TABLE `preview_events` ADD `source` text DEFAULT 'athena.web' NOT NULL;--> statement-breakpoint
ALTER TABLE `preview_events` ADD `retention_policy` text DEFAULT 'firm-default' NOT NULL;--> statement-breakpoint
PRAGMA optimize;
