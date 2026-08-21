CREATE TABLE `scale_assessments` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`environment` text NOT NULL,
	`workload_profile` text NOT NULL,
	`status` text NOT NULL,
	`overall_outcome` text NOT NULL,
	`blocking_gaps` text NOT NULL,
	`max_page_size` integer NOT NULL,
	`outbox_batch_limit` integer NOT NULL,
	`archive_byte_limit` integer NOT NULL,
	`archive_row_limit` integer NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`reviewed_by` text,
	`reviewed_at` integer,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_scale_assessment_history` ON `scale_assessments` (`tenant_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `scale_decisions` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`assessment_id` text NOT NULL,
	`action` text NOT NULL,
	`from_status` text NOT NULL,
	`to_status` text NOT NULL,
	`reason` text NOT NULL,
	`actor_id` text NOT NULL,
	`event_id` text NOT NULL,
	`idempotency_key` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_scale_decision_idempotency` ON `scale_decisions` (`tenant_id`,`idempotency_key`);--> statement-breakpoint
CREATE INDEX `idx_scale_decision_history` ON `scale_decisions` (`tenant_id`,`assessment_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `scale_measurements` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`assessment_id` text NOT NULL,
	`metric_code` text NOT NULL,
	`target_ms` integer NOT NULL,
	`measured_ms` integer,
	`status` text NOT NULL,
	`method` text NOT NULL,
	`sample_size` integer NOT NULL,
	`limitation` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_scale_measurement_metric` ON `scale_measurements` (`tenant_id`,`assessment_id`,`metric_code`);