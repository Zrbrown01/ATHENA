CREATE TABLE `automation_execution_heartbeats` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`subsystem` text NOT NULL,
	`trigger` text NOT NULL,
	`scheduled_for` integer NOT NULL,
	`started_at` integer NOT NULL,
	`finished_at` integer NOT NULL,
	`outcome` text NOT NULL,
	`detail` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_automation_heartbeat_latest` ON `automation_execution_heartbeats` (`tenant_id`,`subsystem`,`finished_at`);