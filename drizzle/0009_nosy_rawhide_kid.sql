CREATE TABLE `access_review_attestations` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`period_started_at` integer NOT NULL,
	`period_ended_at` integer NOT NULL,
	`outcome` text NOT NULL,
	`notes` text NOT NULL,
	`snapshot` text NOT NULL,
	`reviewer_id` text NOT NULL,
	`reviewed_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_access_review_period` ON `access_review_attestations` (`tenant_id`,`period_ended_at`);--> statement-breakpoint
CREATE TABLE `support_access_grants` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`matter_id` text NOT NULL,
	`support_user_id` text NOT NULL,
	`purpose` text NOT NULL,
	`ticket_reference` text NOT NULL,
	`status` text NOT NULL,
	`approved_by` text NOT NULL,
	`approved_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`revoked_by` text,
	`revoked_at` integer,
	`revocation_reason` text,
	`revision` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_support_grant_scope` ON `support_access_grants` (`tenant_id`,`matter_id`,`support_user_id`);--> statement-breakpoint
CREATE INDEX `idx_support_grant_active` ON `support_access_grants` (`tenant_id`,`status`,`expires_at`);--> statement-breakpoint
PRAGMA optimize;
