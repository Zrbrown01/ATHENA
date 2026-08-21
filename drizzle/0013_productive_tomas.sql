CREATE TABLE `conflict_findings` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`intake_candidate_id` text NOT NULL,
	`subject_name` text NOT NULL,
	`conflict_type` text NOT NULL,
	`severity` text NOT NULL,
	`reason` text NOT NULL,
	`source_reference` text NOT NULL,
	`status` text NOT NULL,
	`resolved_by` text,
	`resolved_at` integer,
	`resolution_reason` text
);
--> statement-breakpoint
CREATE INDEX `idx_conflict_candidate_status` ON `conflict_findings` (`tenant_id`,`intake_candidate_id`,`status`);--> statement-breakpoint
CREATE TABLE `intake_candidates` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`proposed_matter_id` text NOT NULL,
	`source_type` text NOT NULL,
	`source_record_id` text NOT NULL,
	`provider_mode` text NOT NULL,
	`caption` text NOT NULL,
	`client_name` text NOT NULL,
	`employer_name` text NOT NULL,
	`applicant_name` text NOT NULL,
	`claim_number` text,
	`adj_number` text,
	`injury_date` integer,
	`missing_fields` text NOT NULL,
	`status` text NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`opened_by` text,
	`opened_at` integer,
	`rejected_by` text,
	`rejected_at` integer,
	`rejection_reason` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_intake_source_identity` ON `intake_candidates` (`tenant_id`,`source_type`,`source_record_id`);--> statement-breakpoint
CREATE INDEX `idx_intake_tenant_status` ON `intake_candidates` (`tenant_id`,`status`,`updated_at`);--> statement-breakpoint
CREATE TABLE `intake_match_candidates` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`intake_candidate_id` text NOT NULL,
	`existing_matter_id` text NOT NULL,
	`match_type` text NOT NULL,
	`score_basis_points` integer NOT NULL,
	`evidence` text NOT NULL,
	`disposition` text NOT NULL,
	`reviewed_by` text,
	`reviewed_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_intake_match_identity` ON `intake_match_candidates` (`tenant_id`,`intake_candidate_id`,`existing_matter_id`);--> statement-breakpoint
CREATE TABLE `intake_review_decisions` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`intake_candidate_id` text NOT NULL,
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
CREATE UNIQUE INDEX `idx_intake_review_idempotency` ON `intake_review_decisions` (`tenant_id`,`idempotency_key`);--> statement-breakpoint
CREATE INDEX `idx_intake_review_candidate` ON `intake_review_decisions` (`tenant_id`,`intake_candidate_id`,`created_at`);--> statement-breakpoint
PRAGMA optimize;
