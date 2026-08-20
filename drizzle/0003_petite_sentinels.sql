CREATE TABLE `governance_rules` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`code` text NOT NULL,
	`version` integer NOT NULL,
	`authority_type` text NOT NULL,
	`authority_citation` text NOT NULL,
	`business_days` integer NOT NULL,
	`effective_at` integer NOT NULL,
	`review_by` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_governance_rule_version` ON `governance_rules` (`tenant_id`,`code`,`version`);--> statement-breakpoint
CREATE TABLE `legal_holds` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`matter_id` text NOT NULL,
	`name` text NOT NULL,
	`reason` text NOT NULL,
	`status` text NOT NULL,
	`placed_by` text NOT NULL,
	`placed_at` integer NOT NULL,
	`released_by` text,
	`released_at` integer
);
--> statement-breakpoint
CREATE INDEX `idx_legal_holds_tenant_matter` ON `legal_holds` (`tenant_id`,`matter_id`,`status`);--> statement-breakpoint
CREATE TABLE `matter_access_policies` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`matter_id` text NOT NULL,
	`user_id` text NOT NULL,
	`effect` text NOT NULL,
	`reason` text NOT NULL,
	`source` text NOT NULL,
	`effective_at` integer NOT NULL,
	`expires_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_matter_access_policy_identity` ON `matter_access_policies` (`tenant_id`,`matter_id`,`user_id`,`source`);--> statement-breakpoint
CREATE INDEX `idx_matter_access_policy_user` ON `matter_access_policies` (`tenant_id`,`user_id`,`effect`);--> statement-breakpoint
CREATE TABLE `obligations` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`matter_id` text NOT NULL,
	`rule_id` text NOT NULL,
	`title` text NOT NULL,
	`due_at` integer NOT NULL,
	`owner_id` text NOT NULL,
	`status` text NOT NULL,
	`calculation` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_obligations_tenant_due` ON `obligations` (`tenant_id`,`status`,`due_at`);--> statement-breakpoint
CREATE TABLE `outbox_deliveries` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`outbox_id` text NOT NULL,
	`event_id` text NOT NULL,
	`destination` text NOT NULL,
	`outcome` text NOT NULL,
	`attempt` integer NOT NULL,
	`detail` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_outbox_delivery_outbox_attempt` ON `outbox_deliveries` (`outbox_id`,`attempt`);--> statement-breakpoint
CREATE INDEX `idx_outbox_delivery_tenant_event` ON `outbox_deliveries` (`tenant_id`,`event_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `retention_policies` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`code` text NOT NULL,
	`version` integer NOT NULL,
	`retain_days` integer NOT NULL,
	`disposition` text NOT NULL,
	`effective_at` integer NOT NULL,
	`superseded_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_retention_policy_version` ON `retention_policies` (`tenant_id`,`code`,`version`);--> statement-breakpoint
CREATE INDEX `idx_retention_policy_effective` ON `retention_policies` (`tenant_id`,`effective_at`);--> statement-breakpoint
DROP INDEX `idx_preview_outbox_ready`;--> statement-breakpoint
ALTER TABLE `preview_outbox` ADD `status` text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE `preview_outbox` ADD `lease_owner` text;--> statement-breakpoint
ALTER TABLE `preview_outbox` ADD `lease_expires_at` integer;--> statement-breakpoint
ALTER TABLE `preview_outbox` ADD `last_error` text;--> statement-breakpoint
CREATE UNIQUE INDEX `idx_preview_outbox_tenant_event_topic` ON `preview_outbox` (`tenant_id`,`event_id`,`topic`);--> statement-breakpoint
CREATE INDEX `idx_preview_outbox_lease` ON `preview_outbox` (`status`,`lease_expires_at`);--> statement-breakpoint
CREATE INDEX `idx_preview_outbox_ready` ON `preview_outbox` (`tenant_id`,`status`,`available_at`);
--> statement-breakpoint
INSERT OR IGNORE INTO `retention_policies` (`id`,`tenant_id`,`code`,`version`,`retain_days`,`disposition`,`effective_at`) VALUES ('retention-firm-default-v1','tenant-golden','firm-default',1,2555,'review_required',1767225600000);
--> statement-breakpoint
INSERT OR IGNORE INTO `governance_rules` (`id`,`tenant_id`,`code`,`version`,`authority_type`,`authority_citation`,`business_days`,`effective_at`,`review_by`) VALUES ('rule-firm-pilot-qme-review-v1','tenant-golden','firm-pilot-qme-review',1,'firm_policy','Synthetic pilot policy; attorney validation required',5,1767225600000,1798675200000);
--> statement-breakpoint
PRAGMA optimize;
