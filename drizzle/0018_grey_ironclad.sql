CREATE TABLE `closure_decisions` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`matter_id` text NOT NULL,
	`checklist_id` text NOT NULL,
	`action` text NOT NULL,
	`item` text,
	`evidence` text,
	`actor_id` text NOT NULL,
	`event_id` text NOT NULL,
	`idempotency_key` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_closure_decision_idempotency` ON `closure_decisions` (`tenant_id`,`idempotency_key`);--> statement-breakpoint
CREATE INDEX `idx_closure_decision_history` ON `closure_decisions` (`tenant_id`,`matter_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `matter_closure_checklists` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`matter_id` text NOT NULL,
	`status` text NOT NULL,
	`settlement_evidence` text,
	`final_report_evidence` text,
	`billing_evidence` text,
	`retention_evidence` text,
	`lien_evidence` text,
	`closed_by` text,
	`closed_at` integer,
	`reopened_by` text,
	`reopened_at` integer,
	`reopen_reason` text,
	`reopen_source` text,
	`revision` integer DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_closure_checklist_matter` ON `matter_closure_checklists` (`tenant_id`,`matter_id`);--> statement-breakpoint
CREATE TABLE `matter_status_history` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`matter_id` text NOT NULL,
	`from_status` text NOT NULL,
	`to_status` text NOT NULL,
	`reason` text NOT NULL,
	`source` text NOT NULL,
	`actor_id` text NOT NULL,
	`event_id` text NOT NULL,
	`occurred_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_matter_status_history` ON `matter_status_history` (`tenant_id`,`matter_id`,`occurred_at`);--> statement-breakpoint
PRAGMA optimize;
