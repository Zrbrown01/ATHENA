CREATE TABLE `readiness_assessments` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`matter_id` text NOT NULL,
	`assessment_type` text NOT NULL,
	`conclusion` text NOT NULL,
	`pass_count` integer NOT NULL,
	`gap_count` integer NOT NULL,
	`blocked_count` integer NOT NULL,
	`data_as_of` integer NOT NULL,
	`evaluated_by` text NOT NULL,
	`non_autonomous` integer NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_readiness_assessment_matter` ON `readiness_assessments` (`tenant_id`,`matter_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `readiness_findings` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`matter_id` text NOT NULL,
	`assessment_id` text NOT NULL,
	`code` text NOT NULL,
	`label` text NOT NULL,
	`category` text NOT NULL,
	`status` text NOT NULL,
	`severity` text NOT NULL,
	`explanation` text NOT NULL,
	`evidence_type` text,
	`evidence_id` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_readiness_finding_code` ON `readiness_findings` (`tenant_id`,`assessment_id`,`code`);--> statement-breakpoint
CREATE INDEX `idx_readiness_finding_matter` ON `readiness_findings` (`tenant_id`,`matter_id`,`status`);--> statement-breakpoint
CREATE TABLE `readiness_reviews` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`matter_id` text NOT NULL,
	`assessment_id` text NOT NULL,
	`outcome` text NOT NULL,
	`notes` text NOT NULL,
	`reviewed_by` text NOT NULL,
	`event_id` text NOT NULL,
	`idempotency_key` text NOT NULL,
	`reviewed_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_readiness_review_idempotency` ON `readiness_reviews` (`tenant_id`,`idempotency_key`);--> statement-breakpoint
CREATE INDEX `idx_readiness_review_assessment` ON `readiness_reviews` (`tenant_id`,`assessment_id`,`reviewed_at`);--> statement-breakpoint
PRAGMA optimize;
