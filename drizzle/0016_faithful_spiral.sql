CREATE TABLE `record_request_decisions` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`matter_id` text NOT NULL,
	`record_request_id` text NOT NULL,
	`action` text NOT NULL,
	`from_status` text NOT NULL,
	`to_status` text NOT NULL,
	`evidence` text,
	`actor_id` text NOT NULL,
	`event_id` text NOT NULL,
	`idempotency_key` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_record_request_decision_idempotency` ON `record_request_decisions` (`tenant_id`,`idempotency_key`);--> statement-breakpoint
CREATE INDEX `idx_record_request_decision_history` ON `record_request_decisions` (`tenant_id`,`record_request_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `record_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`matter_id` text NOT NULL,
	`request_type` text NOT NULL,
	`custodian_name` text NOT NULL,
	`scope` text NOT NULL,
	`authority_basis` text,
	`status` text NOT NULL,
	`prepared_by` text,
	`prepared_at` integer,
	`service_method` text,
	`served_by` text,
	`served_at` integer,
	`service_evidence` text,
	`compliance_due_at` integer,
	`received_at` integer,
	`received_document_count` integer,
	`completeness_evidence` text,
	`deficiency_reason` text,
	`delivered_to` text,
	`delivery_evidence` text,
	`delivered_at` integer,
	`cost_cents` integer,
	`billing_disposition` text,
	`closed_by` text,
	`closed_at` integer,
	`cancellation_reason` text,
	`revision` integer DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_record_request_matter` ON `record_requests` (`tenant_id`,`matter_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_record_request_due` ON `record_requests` (`tenant_id`,`status`,`compliance_due_at`);--> statement-breakpoint
PRAGMA optimize;
