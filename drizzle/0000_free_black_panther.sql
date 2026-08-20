CREATE TABLE `document_intakes` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`matter_id` text,
	`title` text NOT NULL,
	`object_key` text NOT NULL,
	`sha256` text NOT NULL,
	`byte_size` integer NOT NULL,
	`mime_type` text NOT NULL,
	`classification` text NOT NULL,
	`status` text NOT NULL,
	`actor_id` text NOT NULL,
	`actor_email` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_document_intakes_object_key` ON `document_intakes` (`object_key`);--> statement-breakpoint
CREATE INDEX `idx_document_intakes_tenant_matter` ON `document_intakes` (`tenant_id`,`matter_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_document_intakes_tenant_sha` ON `document_intakes` (`tenant_id`,`sha256`);--> statement-breakpoint
CREATE TABLE `fact_reviews` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`matter_id` text NOT NULL,
	`fact_id` text NOT NULL,
	`decision` text NOT NULL,
	`edited_value` text,
	`reason` text,
	`actor_id` text NOT NULL,
	`actor_email` text NOT NULL,
	`event_id` text NOT NULL,
	`idempotency_key` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_fact_reviews_tenant_idempotency` ON `fact_reviews` (`tenant_id`,`idempotency_key`);--> statement-breakpoint
CREATE INDEX `idx_fact_reviews_tenant_matter` ON `fact_reviews` (`tenant_id`,`matter_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `preview_events` (
	`event_id` text PRIMARY KEY NOT NULL,
	`event_type` text NOT NULL,
	`event_version` integer NOT NULL,
	`tenant_id` text NOT NULL,
	`aggregate_type` text NOT NULL,
	`aggregate_id` text NOT NULL,
	`matter_id` text,
	`actor_id` text NOT NULL,
	`occurred_at` integer NOT NULL,
	`correlation_id` text NOT NULL,
	`idempotency_key` text NOT NULL,
	`visibility` text NOT NULL,
	`payload` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_preview_events_tenant_idempotency` ON `preview_events` (`tenant_id`,`idempotency_key`);--> statement-breakpoint
CREATE INDEX `idx_preview_events_tenant_matter` ON `preview_events` (`tenant_id`,`matter_id`,`occurred_at`);--> statement-breakpoint
CREATE TABLE `preview_outbox` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`event_id` text NOT NULL,
	`topic` text NOT NULL,
	`payload` text NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`available_at` integer NOT NULL,
	`processed_at` integer,
	`failed_at` integer
);
--> statement-breakpoint
CREATE INDEX `idx_preview_outbox_ready` ON `preview_outbox` (`processed_at`,`available_at`);
--> statement-breakpoint
PRAGMA optimize;
