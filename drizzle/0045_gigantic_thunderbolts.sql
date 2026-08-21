CREATE TABLE `directory_reconciliation_findings` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`reconciliation_id` text NOT NULL,
	`identity_id` text,
	`external_object_id` text,
	`normalized_email` text NOT NULL,
	`code` text NOT NULL,
	`severity` text NOT NULL,
	`blocking` integer NOT NULL,
	`local_value` text,
	`provider_value` text,
	`explanation` text NOT NULL,
	`status` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_directory_reconciliation_finding` ON `directory_reconciliation_findings` (`tenant_id`,`reconciliation_id`,`severity`);--> statement-breakpoint
CREATE TABLE `directory_reconciliation_reviews` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`reconciliation_id` text NOT NULL,
	`outcome` text NOT NULL,
	`notes` text NOT NULL,
	`open_finding_count` integer NOT NULL,
	`accepted_exception_count` integer NOT NULL,
	`reviewed_by` text NOT NULL,
	`event_id` text NOT NULL,
	`idempotency_key` text NOT NULL,
	`reviewed_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_directory_reconciliation_review_idempotency` ON `directory_reconciliation_reviews` (`tenant_id`,`idempotency_key`);--> statement-breakpoint
CREATE INDEX `idx_directory_reconciliation_review_run` ON `directory_reconciliation_reviews` (`tenant_id`,`reconciliation_id`,`reviewed_at`);--> statement-breakpoint
CREATE TABLE `directory_reconciliation_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`connection_id` text NOT NULL,
	`provider` text NOT NULL,
	`provider_mode` text NOT NULL,
	`status` text NOT NULL,
	`snapshot_as_of` integer NOT NULL,
	`snapshot_sha256` text NOT NULL,
	`local_identity_count` integer NOT NULL,
	`provider_identity_count` integer NOT NULL,
	`matched_identity_count` integer NOT NULL,
	`finding_count` integer NOT NULL,
	`blocking_finding_count` integer NOT NULL,
	`limitation` text NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`initiated_by` text NOT NULL,
	`event_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`reviewed_at` integer,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_directory_reconciliation_connection` ON `directory_reconciliation_runs` (`tenant_id`,`connection_id`,`created_at`);--> statement-breakpoint
PRAGMA optimize;
