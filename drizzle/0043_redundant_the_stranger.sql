CREATE TABLE `optimistic_write_claims` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`aggregate_type` text NOT NULL,
	`aggregate_id` text NOT NULL,
	`expected_revision` integer NOT NULL,
	`claimed_revision` integer NOT NULL,
	`actor_id` text NOT NULL,
	`event_id` text NOT NULL,
	`idempotency_key` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_optimistic_write_claim` ON `optimistic_write_claims` (`tenant_id`,`aggregate_type`,`aggregate_id`,`expected_revision`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_optimistic_write_idempotency` ON `optimistic_write_claims` (`tenant_id`,`idempotency_key`);