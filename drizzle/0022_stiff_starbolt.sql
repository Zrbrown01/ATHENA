CREATE TABLE `billing_lifecycle_decisions` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`matter_id` text NOT NULL,
	`aggregate_type` text NOT NULL,
	`aggregate_id` text NOT NULL,
	`action` text NOT NULL,
	`from_status` text NOT NULL,
	`to_status` text NOT NULL,
	`amount_cents` integer,
	`reason` text,
	`actor_id` text NOT NULL,
	`event_id` text NOT NULL,
	`idempotency_key` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_billing_lifecycle_idempotency` ON `billing_lifecycle_decisions` (`tenant_id`,`idempotency_key`);--> statement-breakpoint
CREATE INDEX `idx_billing_lifecycle_history` ON `billing_lifecycle_decisions` (`tenant_id`,`aggregate_type`,`aggregate_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `client_billing_profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`client_id` text NOT NULL,
	`name` text NOT NULL,
	`version` integer NOT NULL,
	`effective_at` integer NOT NULL,
	`expires_at` integer,
	`hourly_rate_cents` integer NOT NULL,
	`billing_increment_minutes` integer NOT NULL,
	`approved_timekeeper_ids` text NOT NULL,
	`allowed_task_codes` text NOT NULL,
	`allowed_activity_codes` text NOT NULL,
	`allowed_expense_codes` text NOT NULL,
	`content_status` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_billing_profile_version` ON `client_billing_profiles` (`tenant_id`,`client_id`,`version`);--> statement-breakpoint
CREATE TABLE `invoice_adjustments` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`matter_id` text NOT NULL,
	`invoice_id` text NOT NULL,
	`adjustment_type` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`reason_code` text NOT NULL,
	`explanation` text NOT NULL,
	`external_reference` text,
	`provider_mode` text NOT NULL,
	`actor_id` text NOT NULL,
	`event_id` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_invoice_adjustment_history` ON `invoice_adjustments` (`tenant_id`,`invoice_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `invoice_payments` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`matter_id` text NOT NULL,
	`invoice_id` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`paid_at` integer NOT NULL,
	`external_reference` text NOT NULL,
	`provider_mode` text NOT NULL,
	`recorded_by` text NOT NULL,
	`event_id` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_invoice_payment_reference` ON `invoice_payments` (`tenant_id`,`external_reference`);--> statement-breakpoint
CREATE INDEX `idx_invoice_payment_history` ON `invoice_payments` (`tenant_id`,`invoice_id`,`paid_at`);--> statement-breakpoint
CREATE TABLE `invoices` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`matter_id` text NOT NULL,
	`prebill_id` text NOT NULL,
	`invoice_number` text NOT NULL,
	`client_matter_id` text NOT NULL,
	`status` text NOT NULL,
	`gross_amount_cents` integer NOT NULL,
	`reduction_amount_cents` integer NOT NULL,
	`appeal_recovery_cents` integer NOT NULL,
	`paid_amount_cents` integer NOT NULL,
	`balance_cents` integer NOT NULL,
	`provider_mode` text NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_invoice_number` ON `invoices` (`tenant_id`,`invoice_number`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_invoice_prebill` ON `invoices` (`tenant_id`,`prebill_id`);--> statement-breakpoint
CREATE TABLE `ledes_exports` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`matter_id` text NOT NULL,
	`invoice_id` text NOT NULL,
	`format` text NOT NULL,
	`outcome` text NOT NULL,
	`checks` text NOT NULL,
	`sha256` text NOT NULL,
	`provider_mode` text NOT NULL,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_ledes_invoice` ON `ledes_exports` (`tenant_id`,`invoice_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `matter_expenses` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`matter_id` text NOT NULL,
	`expense_code` text NOT NULL,
	`description` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`incurred_at` integer NOT NULL,
	`status` text NOT NULL,
	`source_type` text NOT NULL,
	`source_id` text NOT NULL,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_expense_source` ON `matter_expenses` (`tenant_id`,`source_type`,`source_id`);--> statement-breakpoint
CREATE INDEX `idx_expense_matter` ON `matter_expenses` (`tenant_id`,`matter_id`,`status`);--> statement-breakpoint
CREATE TABLE `prebill_lines` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`matter_id` text NOT NULL,
	`prebill_id` text NOT NULL,
	`line_type` text NOT NULL,
	`source_id` text NOT NULL,
	`task_code` text,
	`activity_code` text,
	`expense_code` text,
	`minutes` integer,
	`rate_cents` integer,
	`amount_cents` integer NOT NULL,
	`narrative` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_prebill_line_source` ON `prebill_lines` (`tenant_id`,`prebill_id`,`line_type`,`source_id`);--> statement-breakpoint
CREATE TABLE `prebills` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`matter_id` text NOT NULL,
	`billing_profile_id` text NOT NULL,
	`period_start` integer NOT NULL,
	`period_end` integer NOT NULL,
	`status` text NOT NULL,
	`time_amount_cents` integer NOT NULL,
	`expense_amount_cents` integer NOT NULL,
	`adjustment_amount_cents` integer NOT NULL,
	`total_cents` integer NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`approved_by` text,
	`approved_at` integer,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_prebill_matter` ON `prebills` (`tenant_id`,`matter_id`,`created_at`);
--> statement-breakpoint
PRAGMA optimize;
