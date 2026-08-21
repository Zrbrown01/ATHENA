CREATE TABLE `deposition_artifacts` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`matter_id` text NOT NULL,
	`deposition_id` text NOT NULL,
	`artifact_type` text NOT NULL,
	`title` text NOT NULL,
	`sha256` text NOT NULL,
	`provider_mode` text NOT NULL,
	`status` text NOT NULL,
	`verified_by` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_deposition_artifact_history` ON `deposition_artifacts` (`tenant_id`,`deposition_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `deposition_decisions` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`matter_id` text NOT NULL,
	`deposition_id` text NOT NULL,
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
CREATE UNIQUE INDEX `idx_deposition_decision_idempotency` ON `deposition_decisions` (`tenant_id`,`idempotency_key`);--> statement-breakpoint
CREATE INDEX `idx_deposition_decision_history` ON `deposition_decisions` (`tenant_id`,`deposition_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `depositions` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`matter_id` text NOT NULL,
	`deponent_name` text NOT NULL,
	`deposition_type` text NOT NULL,
	`requested_starts_at` integer NOT NULL,
	`timezone` text NOT NULL,
	`location_mode` text NOT NULL,
	`reporter_required` integer NOT NULL,
	`video_required` integer NOT NULL,
	`interpreter_required` integer NOT NULL,
	`realtime_required` integer NOT NULL,
	`client_approval_required` integer NOT NULL,
	`status` text NOT NULL,
	`provider` text NOT NULL,
	`provider_mode` text NOT NULL,
	`external_booking_id` text,
	`scheduled_at` integer,
	`revision` integer DEFAULT 1 NOT NULL,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_deposition_matter_status` ON `depositions` (`tenant_id`,`matter_id`,`status`);--> statement-breakpoint
PRAGMA optimize;
