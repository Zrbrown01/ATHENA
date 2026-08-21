CREATE TABLE `directory_connections` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`provider` text NOT NULL,
	`provider_mode` text NOT NULL,
	`status` text NOT NULL,
	`sync_cursor` text,
	`last_reconciled_at` integer,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_directory_provider` ON `directory_connections` (`tenant_id`,`provider`);--> statement-breakpoint
CREATE TABLE `directory_identities` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`connection_id` text NOT NULL,
	`external_object_id` text,
	`email` text NOT NULL,
	`normalized_email` text NOT NULL,
	`display_name` text NOT NULL,
	`status` text NOT NULL,
	`identity_source` text NOT NULL,
	`mfa_state` text NOT NULL,
	`session_revocation_state` text NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_directory_identity_email` ON `directory_identities` (`tenant_id`,`normalized_email`);--> statement-breakpoint
CREATE INDEX `idx_directory_identity_status` ON `directory_identities` (`tenant_id`,`status`);--> statement-breakpoint
CREATE TABLE `identity_decisions` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`identity_id` text NOT NULL,
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
CREATE UNIQUE INDEX `idx_identity_decision_idempotency` ON `identity_decisions` (`tenant_id`,`idempotency_key`);--> statement-breakpoint
CREATE INDEX `idx_identity_decision_identity` ON `identity_decisions` (`tenant_id`,`identity_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `offboarding_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`identity_id` text NOT NULL,
	`status` text NOT NULL,
	`reason` text NOT NULL,
	`active_assignment_count` integer NOT NULL,
	`revoked_assignment_count` integer NOT NULL,
	`session_revocation_mode` text NOT NULL,
	`session_revocation_evidence` text,
	`revision` integer DEFAULT 1 NOT NULL,
	`initiated_by` text NOT NULL,
	`initiated_at` integer NOT NULL,
	`completed_at` integer,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_offboarding_identity` ON `offboarding_runs` (`tenant_id`,`identity_id`,`status`);--> statement-breakpoint
CREATE TABLE `role_assignments` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`identity_id` text NOT NULL,
	`role_definition_id` text NOT NULL,
	`scope_type` text NOT NULL,
	`matter_id` text,
	`status` text NOT NULL,
	`grant_reason` text NOT NULL,
	`granted_by` text NOT NULL,
	`granted_at` integer NOT NULL,
	`revoked_by` text,
	`revoked_at` integer,
	`revocation_evidence` text
);
--> statement-breakpoint
CREATE INDEX `idx_role_assignment_identity` ON `role_assignments` (`tenant_id`,`identity_id`,`status`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_role_assignment_scope` ON `role_assignments` (`tenant_id`,`identity_id`,`role_definition_id`,`scope_type`,`matter_id`);--> statement-breakpoint
CREATE TABLE `role_definitions` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`code` text NOT NULL,
	`title` text NOT NULL,
	`permissions` text NOT NULL,
	`privileged` integer NOT NULL,
	`immutable` integer NOT NULL,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_role_definition_code` ON `role_definitions` (`tenant_id`,`code`);--> statement-breakpoint
PRAGMA optimize;
