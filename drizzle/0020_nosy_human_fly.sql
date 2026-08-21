CREATE TABLE `proceeding_assessments` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`matter_id` text NOT NULL,
	`proceeding_id` text NOT NULL,
	`state` text NOT NULL,
	`pass_count` integer NOT NULL,
	`gap_count` integer NOT NULL,
	`blocked_count` integer NOT NULL,
	`data_as_of` integer NOT NULL,
	`evaluated_by` text NOT NULL,
	`non_autonomous` integer NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_proceeding_assessment_history` ON `proceeding_assessments` (`tenant_id`,`proceeding_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `proceeding_decisions` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`matter_id` text NOT NULL,
	`proceeding_id` text NOT NULL,
	`action` text NOT NULL,
	`item_code` text,
	`from_status` text,
	`to_status` text,
	`evidence` text,
	`actor_id` text NOT NULL,
	`event_id` text NOT NULL,
	`idempotency_key` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_proceeding_decision_idempotency` ON `proceeding_decisions` (`tenant_id`,`idempotency_key`);--> statement-breakpoint
CREATE INDEX `idx_proceeding_decision_history` ON `proceeding_decisions` (`tenant_id`,`proceeding_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `proceeding_findings` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`matter_id` text NOT NULL,
	`proceeding_id` text NOT NULL,
	`assessment_id` text NOT NULL,
	`code` text NOT NULL,
	`category` text NOT NULL,
	`status` text NOT NULL,
	`severity` text NOT NULL,
	`explanation` text NOT NULL,
	`evidence_type` text,
	`evidence_id` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_proceeding_finding_code` ON `proceeding_findings` (`tenant_id`,`assessment_id`,`code`);--> statement-breakpoint
CREATE INDEX `idx_proceeding_finding_status` ON `proceeding_findings` (`tenant_id`,`proceeding_id`,`status`);--> statement-breakpoint
CREATE TABLE `proceeding_readiness_items` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`matter_id` text NOT NULL,
	`proceeding_id` text NOT NULL,
	`code` text NOT NULL,
	`label` text NOT NULL,
	`category` text NOT NULL,
	`severity` text NOT NULL,
	`status` text NOT NULL,
	`evidence` text,
	`evidence_type` text,
	`evidence_id` text,
	`provider_mode` text NOT NULL,
	`verified_by` text,
	`verified_at` integer,
	`revision` integer DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_proceeding_item_code` ON `proceeding_readiness_items` (`tenant_id`,`proceeding_id`,`code`);--> statement-breakpoint
CREATE INDEX `idx_proceeding_item_status` ON `proceeding_readiness_items` (`tenant_id`,`matter_id`,`status`);--> statement-breakpoint
CREATE TABLE `proceedings` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`matter_id` text NOT NULL,
	`proceeding_type` text NOT NULL,
	`title` text NOT NULL,
	`scheduled_at` integer NOT NULL,
	`venue` text NOT NULL,
	`source_type` text NOT NULL,
	`source_id` text NOT NULL,
	`content_status` text NOT NULL,
	`status` text NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_proceeding_source` ON `proceedings` (`tenant_id`,`source_type`,`source_id`);--> statement-breakpoint
CREATE INDEX `idx_proceeding_matter_date` ON `proceedings` (`tenant_id`,`matter_id`,`scheduled_at`);
--> statement-breakpoint
PRAGMA optimize;
