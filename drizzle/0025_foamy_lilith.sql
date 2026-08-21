CREATE TABLE `calendar_conflicts` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`matter_id` text NOT NULL,
	`event_id` text NOT NULL,
	`conflicting_event_id` text NOT NULL,
	`conflict_type` text NOT NULL,
	`status` text NOT NULL,
	`explanation` text NOT NULL,
	`resolution_reason` text,
	`resolved_by` text,
	`resolved_at` integer,
	`revision` integer DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_calendar_conflict_pair` ON `calendar_conflicts` (`tenant_id`,`event_id`,`conflicting_event_id`);--> statement-breakpoint
CREATE INDEX `idx_calendar_conflict_status` ON `calendar_conflicts` (`tenant_id`,`status`,`updated_at`);--> statement-breakpoint
CREATE TABLE `calendar_decisions` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`matter_id` text NOT NULL,
	`aggregate_type` text NOT NULL,
	`aggregate_id` text NOT NULL,
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
CREATE UNIQUE INDEX `idx_calendar_decision_idempotency` ON `calendar_decisions` (`tenant_id`,`idempotency_key`);--> statement-breakpoint
CREATE INDEX `idx_calendar_decision_aggregate` ON `calendar_decisions` (`tenant_id`,`aggregate_type`,`aggregate_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `calendar_event_dependencies` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`matter_id` text NOT NULL,
	`parent_event_id` text NOT NULL,
	`child_event_id` text NOT NULL,
	`relation_type` text NOT NULL,
	`offset_days` integer NOT NULL,
	`calculation_basis` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_calendar_dependency_edge` ON `calendar_event_dependencies` (`tenant_id`,`parent_event_id`,`child_event_id`);--> statement-breakpoint
CREATE INDEX `idx_calendar_dependency_matter` ON `calendar_event_dependencies` (`tenant_id`,`matter_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `calendar_events` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`matter_id` text NOT NULL,
	`series_id` text,
	`parent_event_id` text,
	`event_kind` text NOT NULL,
	`title` text NOT NULL,
	`starts_at` integer NOT NULL,
	`ends_at` integer NOT NULL,
	`all_day` integer DEFAULT false NOT NULL,
	`timezone` text NOT NULL,
	`location` text,
	`owner_id` text NOT NULL,
	`status` text NOT NULL,
	`source_type` text NOT NULL,
	`source_id` text NOT NULL,
	`external_provider_id` text,
	`revision` integer DEFAULT 1 NOT NULL,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_calendar_event_matter_time` ON `calendar_events` (`tenant_id`,`matter_id`,`starts_at`);--> statement-breakpoint
CREATE INDEX `idx_calendar_event_owner_time` ON `calendar_events` (`tenant_id`,`owner_id`,`starts_at`,`ends_at`);--> statement-breakpoint
CREATE TABLE `calendar_reminders` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`matter_id` text NOT NULL,
	`event_id` text NOT NULL,
	`channel` text NOT NULL,
	`offset_minutes` integer NOT NULL,
	`remind_at` integer NOT NULL,
	`status` text NOT NULL,
	`acknowledged_by` text,
	`acknowledged_at` integer,
	`revision` integer DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_calendar_reminder_due` ON `calendar_reminders` (`tenant_id`,`status`,`remind_at`);--> statement-breakpoint
CREATE TABLE `calendar_series` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`matter_id` text NOT NULL,
	`title` text NOT NULL,
	`recurrence_rule` text NOT NULL,
	`timezone` text NOT NULL,
	`starts_at` integer NOT NULL,
	`ends_at` integer NOT NULL,
	`occurrence_count` integer NOT NULL,
	`status` text NOT NULL,
	`provider_mode` text NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_calendar_series_matter` ON `calendar_series` (`tenant_id`,`matter_id`,`starts_at`);--> statement-breakpoint
CREATE TABLE `calendar_sync_states` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`provider` text NOT NULL,
	`calendar_owner_id` text NOT NULL,
	`status` text NOT NULL,
	`provider_mode` text NOT NULL,
	`granted_scopes` text DEFAULT '[]' NOT NULL,
	`delta_cursor` text,
	`subscription_id` text,
	`last_successful_sync_at` integer,
	`health_detail` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_calendar_sync_owner` ON `calendar_sync_states` (`tenant_id`,`provider`,`calendar_owner_id`);
--> statement-breakpoint
PRAGMA optimize;
