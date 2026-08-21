CREATE TABLE `task_recurrence_decisions` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`matter_id` text NOT NULL,
	`series_id` text NOT NULL,
	`action` text NOT NULL,
	`from_status` text NOT NULL,
	`to_status` text NOT NULL,
	`detail` text,
	`actor_id` text NOT NULL,
	`event_id` text NOT NULL,
	`idempotency_key` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_task_recurrence_decision_idempotency` ON `task_recurrence_decisions` (`tenant_id`,`idempotency_key`);--> statement-breakpoint
CREATE INDEX `idx_task_recurrence_decision_history` ON `task_recurrence_decisions` (`tenant_id`,`series_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `task_recurrence_exceptions` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`matter_id` text NOT NULL,
	`series_id` text NOT NULL,
	`nominal_due_on` integer NOT NULL,
	`action` text NOT NULL,
	`moved_due_on` integer,
	`reason` text NOT NULL,
	`actor_id` text NOT NULL,
	`event_id` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_task_recurrence_exception_identity` ON `task_recurrence_exceptions` (`tenant_id`,`series_id`,`nominal_due_on`);--> statement-breakpoint
CREATE TABLE `task_recurrence_occurrences` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`matter_id` text NOT NULL,
	`series_id` text NOT NULL,
	`task_id` text,
	`sequence` integer NOT NULL,
	`nominal_due_on` integer NOT NULL,
	`effective_due_on` integer,
	`status` text NOT NULL,
	`exception_action` text NOT NULL,
	`event_id` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_task_recurrence_occurrence_identity` ON `task_recurrence_occurrences` (`tenant_id`,`series_id`,`nominal_due_on`);--> statement-breakpoint
CREATE INDEX `idx_task_recurrence_occurrence_series` ON `task_recurrence_occurrences` (`tenant_id`,`series_id`,`sequence`);--> statement-breakpoint
CREATE TABLE `task_recurrence_series` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`matter_id` text NOT NULL,
	`title` text NOT NULL,
	`task_type` text NOT NULL,
	`priority` text NOT NULL,
	`owner_id` text NOT NULL,
	`cadence` text NOT NULL,
	`interval` integer NOT NULL,
	`day_of_month` integer,
	`starts_on` integer NOT NULL,
	`ends_on` integer,
	`occurrence_limit` integer NOT NULL,
	`timezone` text NOT NULL,
	`status` text NOT NULL,
	`last_materialized_through` integer,
	`materialized_count` integer DEFAULT 0 NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`created_by` text NOT NULL,
	`approved_by` text,
	`approved_at` integer,
	`cancelled_by` text,
	`cancelled_at` integer,
	`cancellation_reason` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_task_recurrence_series_matter` ON `task_recurrence_series` (`tenant_id`,`matter_id`,`status`);--> statement-breakpoint
ALTER TABLE `matter_tasks` ADD `recurrence_series_id` text;--> statement-breakpoint
ALTER TABLE `matter_tasks` ADD `recurrence_occurrence_id` text;--> statement-breakpoint
CREATE UNIQUE INDEX `idx_matter_task_recurrence_occurrence` ON `matter_tasks` (`tenant_id`,`recurrence_occurrence_id`);