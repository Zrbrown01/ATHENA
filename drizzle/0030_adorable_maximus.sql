CREATE TABLE `backup_snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`scope` text NOT NULL,
	`source_type` text NOT NULL,
	`provider_mode` text NOT NULL,
	`object_ref` text NOT NULL,
	`sha256` text NOT NULL,
	`byte_size` integer NOT NULL,
	`table_count` integer NOT NULL,
	`data_as_of` integer NOT NULL,
	`immutable` integer NOT NULL,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_backup_snapshot_checksum` ON `backup_snapshots` (`tenant_id`,`sha256`);--> statement-breakpoint
CREATE TABLE `recovery_approvals` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`exercise_id` text NOT NULL,
	`outcome` text NOT NULL,
	`scope_limitation` text NOT NULL,
	`notes` text NOT NULL,
	`approved_by` text NOT NULL,
	`approved_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_recovery_approval_exercise` ON `recovery_approvals` (`tenant_id`,`exercise_id`,`approved_at`);--> statement-breakpoint
CREATE TABLE `recovery_decisions` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`exercise_id` text NOT NULL,
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
CREATE UNIQUE INDEX `idx_recovery_decision_idempotency` ON `recovery_decisions` (`tenant_id`,`idempotency_key`);--> statement-breakpoint
CREATE INDEX `idx_recovery_decision_exercise` ON `recovery_decisions` (`tenant_id`,`exercise_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `recovery_exercises` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`snapshot_id` text NOT NULL,
	`status` text NOT NULL,
	`target_environment` text NOT NULL,
	`production_mutation` integer NOT NULL,
	`started_at` integer NOT NULL,
	`completed_at` integer,
	`duration_seconds` integer,
	`rpo_seconds` integer,
	`rto_seconds` integer,
	`revision` integer DEFAULT 1 NOT NULL,
	`operator_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_recovery_exercise_status` ON `recovery_exercises` (`tenant_id`,`status`,`updated_at`);--> statement-breakpoint
CREATE TABLE `recovery_verification_checks` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`exercise_id` text NOT NULL,
	`code` text NOT NULL,
	`expected_value` text NOT NULL,
	`actual_value` text NOT NULL,
	`outcome` text NOT NULL,
	`evidence_ref` text NOT NULL,
	`verified_by` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_recovery_check_code` ON `recovery_verification_checks` (`tenant_id`,`exercise_id`,`code`);--> statement-breakpoint
PRAGMA optimize;
