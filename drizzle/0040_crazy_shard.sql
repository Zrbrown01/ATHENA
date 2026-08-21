CREATE TABLE `authority_approval_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`matter_id` text NOT NULL,
	`requested_amount_cents` integer NOT NULL,
	`currency` text NOT NULL,
	`settlement_structure` text NOT NULL,
	`scope` text NOT NULL,
	`includes` text NOT NULL,
	`excludes` text NOT NULL,
	`conditions` text NOT NULL,
	`examiner_name` text NOT NULL,
	`examiner_email` text NOT NULL,
	`examiner_organization` text NOT NULL,
	`requested_expires_at` integer NOT NULL,
	`status` text NOT NULL,
	`provider_mode` text NOT NULL,
	`approved_by` text,
	`approved_at` integer,
	`response_id` text,
	`ledger_id` text,
	`revision` integer DEFAULT 1 NOT NULL,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_authority_approval_request_matter` ON `authority_approval_requests` (`tenant_id`,`matter_id`,`status`);--> statement-breakpoint
CREATE TABLE `authority_approval_responses` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`matter_id` text NOT NULL,
	`request_id` text NOT NULL,
	`outcome` text NOT NULL,
	`amount_cents` integer,
	`currency` text NOT NULL,
	`settlement_structure` text,
	`scope` text,
	`includes` text NOT NULL,
	`excludes` text NOT NULL,
	`conditions` text NOT NULL,
	`negotiation_threshold_cents` integer,
	`responder_name` text NOT NULL,
	`responder_role` text NOT NULL,
	`responder_organization` text NOT NULL,
	`effective_at` integer,
	`expires_at` integer,
	`evidence` text NOT NULL,
	`provider_mode` text NOT NULL,
	`verified_by` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_authority_approval_response_request` ON `authority_approval_responses` (`tenant_id`,`request_id`);--> statement-breakpoint
CREATE TABLE `structured_authority_decisions` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`matter_id` text NOT NULL,
	`request_id` text NOT NULL,
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
CREATE UNIQUE INDEX `idx_structured_authority_decision_idempotency` ON `structured_authority_decisions` (`tenant_id`,`idempotency_key`);--> statement-breakpoint
CREATE INDEX `idx_structured_authority_decision_history` ON `structured_authority_decisions` (`tenant_id`,`request_id`,`created_at`);