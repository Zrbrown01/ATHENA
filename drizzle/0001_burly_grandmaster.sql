CREATE TABLE `workflow_decisions` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`workflow_type` text NOT NULL,
	`aggregate_id` text NOT NULL,
	`action` text NOT NULL,
	`reason` text,
	`actor_id` text NOT NULL,
	`actor_email` text NOT NULL,
	`event_id` text NOT NULL,
	`idempotency_key` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_workflow_decisions_tenant_idempotency` ON `workflow_decisions` (`tenant_id`,`idempotency_key`);--> statement-breakpoint
CREATE INDEX `idx_workflow_decisions_tenant_aggregate` ON `workflow_decisions` (`tenant_id`,`workflow_type`,`aggregate_id`,`created_at`);--> statement-breakpoint
PRAGMA optimize;
