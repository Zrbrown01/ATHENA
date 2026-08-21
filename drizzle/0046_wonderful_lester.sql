CREATE TABLE `obligation_dependencies` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`matter_id` text NOT NULL,
	`predecessor_obligation_id` text NOT NULL,
	`successor_obligation_id` text NOT NULL,
	`relation_type` text NOT NULL,
	`offset_business_days` integer NOT NULL,
	`blocks_predecessor_completion` integer NOT NULL,
	`calculation` text NOT NULL,
	`reason` text NOT NULL,
	`created_by` text NOT NULL,
	`event_id` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_obligation_dependency_edge` ON `obligation_dependencies` (`tenant_id`,`predecessor_obligation_id`,`successor_obligation_id`);--> statement-breakpoint
CREATE INDEX `idx_obligation_dependency_predecessor` ON `obligation_dependencies` (`tenant_id`,`matter_id`,`predecessor_obligation_id`);--> statement-breakpoint
CREATE TABLE `obligation_escalations` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`matter_id` text NOT NULL,
	`obligation_id` text NOT NULL,
	`level` text NOT NULL,
	`status` text NOT NULL,
	`evaluated_at` integer NOT NULL,
	`due_at` integer NOT NULL,
	`business_days_remaining` integer NOT NULL,
	`basis` text NOT NULL,
	`response` text,
	`revision` integer DEFAULT 1 NOT NULL,
	`created_by` text NOT NULL,
	`acknowledged_by` text,
	`acknowledged_at` integer,
	`event_id` text NOT NULL,
	`acknowledgment_event_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_obligation_escalation_status` ON `obligation_escalations` (`tenant_id`,`matter_id`,`obligation_id`,`status`);--> statement-breakpoint
CREATE TABLE `obligation_exceptions` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`matter_id` text NOT NULL,
	`obligation_id` text NOT NULL,
	`exception_type` text NOT NULL,
	`status` text NOT NULL,
	`proposed_due_at` integer,
	`reason` text NOT NULL,
	`authority_basis` text NOT NULL,
	`decision_reason` text,
	`revision` integer DEFAULT 1 NOT NULL,
	`requested_by` text NOT NULL,
	`requested_at` integer NOT NULL,
	`decided_by` text,
	`decided_at` integer,
	`request_event_id` text NOT NULL,
	`decision_event_id` text,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_obligation_exception_status` ON `obligation_exceptions` (`tenant_id`,`matter_id`,`obligation_id`,`status`);--> statement-breakpoint
PRAGMA optimize;
