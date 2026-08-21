CREATE TABLE `matter_tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`matter_id` text NOT NULL,
	`title` text NOT NULL,
	`task_type` text NOT NULL,
	`priority` text NOT NULL,
	`owner_id` text NOT NULL,
	`due_at` integer NOT NULL,
	`status` text NOT NULL,
	`blocker_reason` text,
	`completion_evidence` text,
	`completed_by` text,
	`completed_at` integer,
	`cancelled_by` text,
	`cancelled_at` integer,
	`cancellation_reason` text,
	`revision` integer DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_matter_task_queue` ON `matter_tasks` (`tenant_id`,`owner_id`,`status`,`due_at`);--> statement-breakpoint
CREATE INDEX `idx_matter_task_matter` ON `matter_tasks` (`tenant_id`,`matter_id`,`status`);--> statement-breakpoint
CREATE TABLE `task_decisions` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`matter_id` text NOT NULL,
	`task_id` text NOT NULL,
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
CREATE UNIQUE INDEX `idx_task_decision_idempotency` ON `task_decisions` (`tenant_id`,`idempotency_key`);--> statement-breakpoint
CREATE INDEX `idx_task_decision_history` ON `task_decisions` (`tenant_id`,`task_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `task_dependencies` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`matter_id` text NOT NULL,
	`task_id` text NOT NULL,
	`depends_on_task_id` text NOT NULL,
	`dependency_type` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_task_dependency_identity` ON `task_dependencies` (`tenant_id`,`task_id`,`depends_on_task_id`);--> statement-breakpoint
PRAGMA optimize;
