CREATE TABLE `access_decision_events` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`actor_id` text NOT NULL,
	`matter_id` text NOT NULL,
	`plane` text NOT NULL,
	`outcome` text NOT NULL,
	`reason_code` text NOT NULL,
	`request_id` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_access_decision_request` ON `access_decision_events` (`tenant_id`,`request_id`);--> statement-breakpoint
CREATE INDEX `idx_access_decision_matter` ON `access_decision_events` (`tenant_id`,`matter_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_access_decision_actor` ON `access_decision_events` (`tenant_id`,`actor_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `rate_limit_windows` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`actor_id` text NOT NULL,
	`action` text NOT NULL,
	`window_started_at` integer NOT NULL,
	`count` integer DEFAULT 1 NOT NULL,
	`limit` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_rate_limit_expiry` ON `rate_limit_windows` (`tenant_id`,`expires_at`);--> statement-breakpoint
CREATE INDEX `idx_rate_limit_actor` ON `rate_limit_windows` (`tenant_id`,`actor_id`,`window_started_at`);--> statement-breakpoint
PRAGMA optimize;
