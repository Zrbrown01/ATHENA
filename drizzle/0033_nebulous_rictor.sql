CREATE TABLE `disposition_approvals` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`request_id` text NOT NULL,
	`sequence` integer NOT NULL,
	`outcome` text NOT NULL,
	`notes` text NOT NULL,
	`approver_id` text NOT NULL,
	`approved_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_disposition_approval_sequence` ON `disposition_approvals` (`tenant_id`,`request_id`,`sequence`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_disposition_approval_actor` ON `disposition_approvals` (`tenant_id`,`request_id`,`approver_id`);--> statement-breakpoint
CREATE TABLE `disposition_decisions` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`request_id` text NOT NULL,
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
CREATE UNIQUE INDEX `idx_disposition_decision_idempotency` ON `disposition_decisions` (`tenant_id`,`idempotency_key`);--> statement-breakpoint
CREATE INDEX `idx_disposition_decision_request` ON `disposition_decisions` (`tenant_id`,`request_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `disposition_executions` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`request_id` text NOT NULL,
	`deleted_item_count` integer NOT NULL,
	`deleted_payload_sha256` text NOT NULL,
	`audit_records_preserved` integer NOT NULL,
	`event_records_preserved` integer NOT NULL,
	`executed_by` text NOT NULL,
	`executed_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_disposition_execution_request` ON `disposition_executions` (`tenant_id`,`request_id`);--> statement-breakpoint
CREATE TABLE `disposition_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`matter_id` text NOT NULL,
	`target_type` text NOT NULL,
	`target_id` text NOT NULL,
	`status` text NOT NULL,
	`reason` text NOT NULL,
	`legal_hold_count` integer NOT NULL,
	`preview_item_count` integer NOT NULL,
	`immutable_exclusions` text NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`requested_by` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_disposition_request_status` ON `disposition_requests` (`tenant_id`,`status`,`updated_at`);--> statement-breakpoint
CREATE TABLE `disposition_sandbox_records` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`matter_id` text NOT NULL,
	`payload` text NOT NULL,
	`payload_sha256` text NOT NULL,
	`synthetic_disposable` integer NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_disposition_sandbox_matter` ON `disposition_sandbox_records` (`tenant_id`,`matter_id`);--> statement-breakpoint
PRAGMA optimize;
