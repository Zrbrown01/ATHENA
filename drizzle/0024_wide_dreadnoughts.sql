CREATE TABLE `communication_attachments` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`thread_id` text NOT NULL,
	`message_id` text NOT NULL,
	`matter_id` text,
	`file_name` text NOT NULL,
	`mime_type` text NOT NULL,
	`byte_size` integer NOT NULL,
	`sha256` text NOT NULL,
	`provider_attachment_id` text,
	`source_object_key` text,
	`extraction_status` text NOT NULL,
	`document_evidence_id` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_communication_attachment_message` ON `communication_attachments` (`tenant_id`,`message_id`,`id`);--> statement-breakpoint
CREATE INDEX `idx_communication_attachment_thread` ON `communication_attachments` (`tenant_id`,`thread_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `communication_decisions` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`matter_id` text,
	`aggregate_type` text NOT NULL,
	`aggregate_id` text NOT NULL,
	`action` text NOT NULL,
	`from_status` text NOT NULL,
	`to_status` text NOT NULL,
	`reason` text,
	`actor_id` text NOT NULL,
	`event_id` text NOT NULL,
	`idempotency_key` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_communication_decision_idempotency` ON `communication_decisions` (`tenant_id`,`idempotency_key`);--> statement-breakpoint
CREATE INDEX `idx_communication_decision_aggregate` ON `communication_decisions` (`tenant_id`,`aggregate_type`,`aggregate_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `communication_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`thread_id` text NOT NULL,
	`matter_id` text,
	`provider_message_id` text,
	`internet_message_id` text,
	`direction` text NOT NULL,
	`from_address` text NOT NULL,
	`to_addresses` text NOT NULL,
	`cc_addresses` text DEFAULT '[]' NOT NULL,
	`subject` text NOT NULL,
	`body_text` text NOT NULL,
	`body_sha256` text NOT NULL,
	`received_or_drafted_at` integer NOT NULL,
	`status` text NOT NULL,
	`provider_mode` text NOT NULL,
	`delivery_attempted` integer DEFAULT false NOT NULL,
	`approved_by` text,
	`approved_at` integer,
	`revision` integer DEFAULT 1 NOT NULL,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_communication_message_provider` ON `communication_messages` (`tenant_id`,`provider_message_id`);--> statement-breakpoint
CREATE INDEX `idx_communication_message_thread` ON `communication_messages` (`tenant_id`,`thread_id`,`received_or_drafted_at`);--> statement-breakpoint
CREATE INDEX `idx_communication_message_matter` ON `communication_messages` (`tenant_id`,`matter_id`,`received_or_drafted_at`);--> statement-breakpoint
CREATE TABLE `communication_threads` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`mailbox_connection_id` text NOT NULL,
	`provider_thread_id` text,
	`subject` text NOT NULL,
	`participants` text NOT NULL,
	`matter_id` text,
	`association_status` text NOT NULL,
	`auto_filing_excluded` integer DEFAULT false NOT NULL,
	`message_count` integer DEFAULT 0 NOT NULL,
	`last_message_at` integer NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_communication_thread_matter` ON `communication_threads` (`tenant_id`,`matter_id`,`last_message_at`);--> statement-breakpoint
CREATE INDEX `idx_communication_thread_review` ON `communication_threads` (`tenant_id`,`association_status`,`last_message_at`);--> statement-breakpoint
CREATE TABLE `mailbox_connections` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`provider` text NOT NULL,
	`mailbox_address` text NOT NULL,
	`status` text NOT NULL,
	`provider_mode` text NOT NULL,
	`granted_scopes` text DEFAULT '[]' NOT NULL,
	`delta_cursor` text,
	`last_successful_sync_at` integer,
	`health_detail` text NOT NULL,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_mailbox_tenant_address` ON `mailbox_connections` (`tenant_id`,`mailbox_address`);--> statement-breakpoint
CREATE INDEX `idx_mailbox_tenant_status` ON `mailbox_connections` (`tenant_id`,`status`,`updated_at`);--> statement-breakpoint
CREATE TABLE `matter_association_candidates` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`thread_id` text NOT NULL,
	`message_id` text NOT NULL,
	`suggested_matter_id` text NOT NULL,
	`target_matter_id` text,
	`signals` text NOT NULL,
	`confidence_basis` text NOT NULL,
	`status` text NOT NULL,
	`resolution_reason` text,
	`resolved_by` text,
	`resolved_at` integer,
	`revision` integer DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_association_candidate_message` ON `matter_association_candidates` (`tenant_id`,`message_id`);--> statement-breakpoint
CREATE INDEX `idx_association_candidate_review` ON `matter_association_candidates` (`tenant_id`,`status`,`updated_at`);
--> statement-breakpoint
PRAGMA optimize;
