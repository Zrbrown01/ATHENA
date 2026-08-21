CREATE TABLE `client_portal_access_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`matter_id` text NOT NULL,
	`client_organization_id` text NOT NULL,
	`contact_name` text NOT NULL,
	`contact_email` text NOT NULL,
	`purpose` text NOT NULL,
	`requested_expires_at` integer NOT NULL,
	`status` text NOT NULL,
	`identity_provider_mode` text NOT NULL,
	`identity_evidence` text,
	`approved_by` text,
	`approved_at` integer,
	`revoked_by` text,
	`revoked_at` integer,
	`revocation_reason` text,
	`revision` integer DEFAULT 1 NOT NULL,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_portal_access_matter_status` ON `client_portal_access_requests` (`tenant_id`,`matter_id`,`status`);--> statement-breakpoint
CREATE TABLE `client_portal_decisions` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`matter_id` text NOT NULL,
	`access_request_id` text NOT NULL,
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
CREATE UNIQUE INDEX `idx_portal_decision_idempotency` ON `client_portal_decisions` (`tenant_id`,`idempotency_key`);--> statement-breakpoint
CREATE INDEX `idx_portal_decision_history` ON `client_portal_decisions` (`tenant_id`,`access_request_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `client_portal_share_items` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`matter_id` text NOT NULL,
	`access_request_id` text NOT NULL,
	`resource_type` text NOT NULL,
	`resource_id` text NOT NULL,
	`title` text NOT NULL,
	`labels` text NOT NULL,
	`outcome` text NOT NULL,
	`reason_codes` text NOT NULL,
	`policy_version` integer NOT NULL,
	`status` text NOT NULL,
	`approved_by` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_portal_share_resource` ON `client_portal_share_items` (`tenant_id`,`access_request_id`,`resource_type`,`resource_id`);--> statement-breakpoint
CREATE INDEX `idx_portal_share_history` ON `client_portal_share_items` (`tenant_id`,`access_request_id`,`created_at`);