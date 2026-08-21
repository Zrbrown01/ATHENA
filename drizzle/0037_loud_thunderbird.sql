CREATE TABLE `dictation_artifacts` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`matter_id` text NOT NULL,
	`session_id` text NOT NULL,
	`artifact_type` text NOT NULL,
	`title` text NOT NULL,
	`content` text,
	`sha256` text NOT NULL,
	`source_artifact_id` text,
	`provider_mode` text NOT NULL,
	`status` text NOT NULL,
	`approved_by` text,
	`approved_at` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_dictation_artifact_history` ON `dictation_artifacts` (`tenant_id`,`session_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `dictation_decisions` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`matter_id` text NOT NULL,
	`session_id` text NOT NULL,
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
CREATE UNIQUE INDEX `idx_dictation_decision_idempotency` ON `dictation_decisions` (`tenant_id`,`idempotency_key`);--> statement-breakpoint
CREATE INDEX `idx_dictation_decision_history` ON `dictation_decisions` (`tenant_id`,`session_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `dictation_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`matter_id` text NOT NULL,
	`title` text NOT NULL,
	`work_product_type` text NOT NULL,
	`duration_seconds` integer NOT NULL,
	`audio_sha256` text NOT NULL,
	`consent_evidence` text NOT NULL,
	`template_id` text,
	`template_version` text,
	`status` text NOT NULL,
	`provider` text NOT NULL,
	`provider_mode` text NOT NULL,
	`work_product_id` text,
	`candidate_time_id` text,
	`revision` integer DEFAULT 1 NOT NULL,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_dictation_session_matter_status` ON `dictation_sessions` (`tenant_id`,`matter_id`,`status`);