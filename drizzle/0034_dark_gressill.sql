CREATE TABLE `classification_decisions` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`matter_id` text,
	`resource_type` text NOT NULL,
	`resource_id` text NOT NULL,
	`plane` text NOT NULL,
	`outcome` text NOT NULL,
	`labels` text NOT NULL,
	`reason_codes` text NOT NULL,
	`policy_version` integer NOT NULL,
	`override_id` text,
	`actor_id` text NOT NULL,
	`event_id` text NOT NULL,
	`idempotency_key` text NOT NULL,
	`decided_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_classification_decision_idempotency` ON `classification_decisions` (`tenant_id`,`idempotency_key`);--> statement-breakpoint
CREATE INDEX `idx_classification_decision_resource` ON `classification_decisions` (`tenant_id`,`resource_type`,`resource_id`,`decided_at`);--> statement-breakpoint
CREATE TABLE `classification_overrides` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`resource_type` text NOT NULL,
	`resource_id` text NOT NULL,
	`plane` text NOT NULL,
	`reason` text NOT NULL,
	`approved_by` text NOT NULL,
	`expires_at` integer NOT NULL,
	`status` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_classification_override_resource` ON `classification_overrides` (`tenant_id`,`resource_type`,`resource_id`,`status`);--> statement-breakpoint
CREATE TABLE `classification_policy_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`version` integer NOT NULL,
	`status` text NOT NULL,
	`labels` text NOT NULL,
	`planes` text NOT NULL,
	`deny_overrides_allow` integer NOT NULL,
	`approved_by` text NOT NULL,
	`approved_at` integer NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_classification_policy_version` ON `classification_policy_versions` (`tenant_id`,`version`);--> statement-breakpoint
CREATE TABLE `resource_classifications` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`matter_id` text,
	`resource_type` text NOT NULL,
	`resource_id` text NOT NULL,
	`labels` text NOT NULL,
	`policy_version` integer NOT NULL,
	`source` text NOT NULL,
	`status` text NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`classified_by` text NOT NULL,
	`classified_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_resource_classification_active` ON `resource_classifications` (`tenant_id`,`resource_type`,`resource_id`,`revision`);--> statement-breakpoint
CREATE INDEX `idx_resource_classification_matter` ON `resource_classifications` (`tenant_id`,`matter_id`,`status`);--> statement-breakpoint
PRAGMA optimize;
