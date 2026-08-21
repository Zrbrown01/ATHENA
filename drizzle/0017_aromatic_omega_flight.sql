CREATE TABLE `authority_candidates` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`matter_id` text NOT NULL,
	`classification` text NOT NULL,
	`amount_cents` integer,
	`currency` text NOT NULL,
	`settlement_structure` text,
	`scope` text,
	`includes` text NOT NULL,
	`excludes` text NOT NULL,
	`conditions` text NOT NULL,
	`negotiation_threshold_cents` integer,
	`grantor_name` text NOT NULL,
	`grantor_role` text NOT NULL,
	`grantor_organization` text NOT NULL,
	`effective_at` integer,
	`expires_at` integer,
	`source_type` text NOT NULL,
	`source_id` text NOT NULL,
	`source_excerpt` text NOT NULL,
	`status` text NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_authority_candidate_source` ON `authority_candidates` (`tenant_id`,`source_type`,`source_id`);--> statement-breakpoint
CREATE INDEX `idx_authority_candidate_matter` ON `authority_candidates` (`tenant_id`,`matter_id`,`status`);--> statement-breakpoint
CREATE TABLE `authority_decisions` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`matter_id` text NOT NULL,
	`candidate_id` text,
	`ledger_id` text,
	`action` text NOT NULL,
	`reason` text NOT NULL,
	`actor_id` text NOT NULL,
	`event_id` text NOT NULL,
	`idempotency_key` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_authority_decision_idempotency` ON `authority_decisions` (`tenant_id`,`idempotency_key`);--> statement-breakpoint
CREATE INDEX `idx_authority_decision_matter` ON `authority_decisions` (`tenant_id`,`matter_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `authority_ledger` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`matter_id` text NOT NULL,
	`source_candidate_id` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`currency` text NOT NULL,
	`settlement_structure` text NOT NULL,
	`scope` text NOT NULL,
	`includes` text NOT NULL,
	`excludes` text NOT NULL,
	`conditions` text NOT NULL,
	`negotiation_threshold_cents` integer,
	`grantor_name` text NOT NULL,
	`grantor_role` text NOT NULL,
	`grantor_organization` text NOT NULL,
	`effective_at` integer NOT NULL,
	`expires_at` integer,
	`status` text NOT NULL,
	`verified_by` text NOT NULL,
	`verified_at` integer NOT NULL,
	`superseded_by_id` text,
	`revision` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_authority_ledger_matter` ON `authority_ledger` (`tenant_id`,`matter_id`,`verified_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_authority_ledger_candidate` ON `authority_ledger` (`tenant_id`,`source_candidate_id`);--> statement-breakpoint
PRAGMA optimize;
