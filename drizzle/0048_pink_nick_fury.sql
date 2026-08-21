CREATE TABLE `obligation_rebuild_findings` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`tenant_id` text NOT NULL,
	`matter_id` text NOT NULL,
	`obligation_id` text NOT NULL,
	`result` text NOT NULL,
	`actual_due_at` integer NOT NULL,
	`expected_due_at` integer,
	`actual_status` text NOT NULL,
	`expected_status` text,
	`rule_code` text NOT NULL,
	`rule_version` integer NOT NULL,
	`dependency_id` text,
	`exception_ids` text NOT NULL,
	`reasons` text NOT NULL,
	`calculation` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_obligation_rebuild_finding` ON `obligation_rebuild_findings` (`run_id`,`obligation_id`);--> statement-breakpoint
CREATE INDEX `idx_obligation_rebuild_finding_matter` ON `obligation_rebuild_findings` (`tenant_id`,`matter_id`,`run_id`);--> statement-breakpoint
CREATE TABLE `obligation_rebuild_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`matter_id` text NOT NULL,
	`as_of` integer NOT NULL,
	`outcome` text NOT NULL,
	`status` text NOT NULL,
	`obligation_count` integer NOT NULL,
	`matched_count` integer NOT NULL,
	`drifted_count` integer NOT NULL,
	`blocked_count` integer NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`review_outcome` text,
	`review_notes` text,
	`requested_by` text NOT NULL,
	`reviewed_by` text,
	`run_event_id` text NOT NULL,
	`review_event_id` text,
	`created_at` integer NOT NULL,
	`reviewed_at` integer
);
--> statement-breakpoint
CREATE INDEX `idx_obligation_rebuild_run_matter` ON `obligation_rebuild_runs` (`tenant_id`,`matter_id`,`created_at`);