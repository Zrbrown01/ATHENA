CREATE TABLE `telephony_contacts` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`matter_id` text,
	`contact_name` text NOT NULL,
	`contact_number` text NOT NULL,
	`tenant_number` text NOT NULL,
	`sms_consent_status` text NOT NULL,
	`voice_consent_status` text NOT NULL,
	`consent_evidence` text,
	`recording_allowed` integer DEFAULT false NOT NULL,
	`provider` text NOT NULL,
	`provider_mode` text NOT NULL,
	`status` text NOT NULL,
	`candidate_time_id` text,
	`revision` integer DEFAULT 1 NOT NULL,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_telephony_contact_number` ON `telephony_contacts` (`tenant_id`,`contact_number`);--> statement-breakpoint
CREATE INDEX `idx_telephony_contact_status` ON `telephony_contacts` (`tenant_id`,`status`,`updated_at`);--> statement-breakpoint
CREATE TABLE `telephony_decisions` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`matter_id` text,
	`contact_id` text NOT NULL,
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
CREATE UNIQUE INDEX `idx_telephony_decision_idempotency` ON `telephony_decisions` (`tenant_id`,`idempotency_key`);--> statement-breakpoint
CREATE INDEX `idx_telephony_decision_history` ON `telephony_decisions` (`tenant_id`,`contact_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `telephony_interactions` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`matter_id` text,
	`contact_id` text NOT NULL,
	`channel` text NOT NULL,
	`direction` text NOT NULL,
	`interaction_type` text NOT NULL,
	`body` text,
	`body_sha256` text,
	`duration_seconds` integer,
	`recording_status` text NOT NULL,
	`status` text NOT NULL,
	`provider_mode` text NOT NULL,
	`delivery_attempted` integer DEFAULT false NOT NULL,
	`approved_by` text,
	`occurred_at` integer NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_telephony_interaction_history` ON `telephony_interactions` (`tenant_id`,`contact_id`,`occurred_at`);