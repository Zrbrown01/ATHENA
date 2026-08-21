CREATE TABLE `report_recurrence_decisions` (
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
CREATE UNIQUE INDEX `idx_report_recurrence_decision_idempotency` ON `report_recurrence_decisions` (`tenant_id`,`idempotency_key`);--> statement-breakpoint
CREATE INDEX `idx_report_recurrence_decision_history` ON `report_recurrence_decisions` (`tenant_id`,`series_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `report_recurrence_exceptions` (
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
CREATE UNIQUE INDEX `idx_report_recurrence_exception_identity` ON `report_recurrence_exceptions` (`tenant_id`,`series_id`,`nominal_due_on`);--> statement-breakpoint
CREATE TABLE `report_recurrence_occurrences` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`matter_id` text NOT NULL,
	`series_id` text NOT NULL,
	`report_instance_id` text,
	`sequence` integer NOT NULL,
	`nominal_due_on` integer NOT NULL,
	`effective_due_on` integer,
	`status` text NOT NULL,
	`exception_action` text NOT NULL,
	`event_id` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_report_recurrence_occurrence_identity` ON `report_recurrence_occurrences` (`tenant_id`,`series_id`,`nominal_due_on`);--> statement-breakpoint
CREATE INDEX `idx_report_recurrence_occurrence_series` ON `report_recurrence_occurrences` (`tenant_id`,`series_id`,`sequence`);--> statement-breakpoint
CREATE TABLE `report_recurrence_series` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`matter_id` text NOT NULL,
	`definition_id` text NOT NULL,
	`definition_code` text DEFAULT 'SUMMIT-RECURRING-STATUS' NOT NULL,
	`title_pattern` text NOT NULL,
	`recipient_addresses` text NOT NULL,
	`section_templates` text NOT NULL,
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
CREATE INDEX `idx_report_recurrence_series_matter` ON `report_recurrence_series` (`tenant_id`,`matter_id`,`status`);