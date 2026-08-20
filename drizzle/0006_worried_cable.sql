ALTER TABLE `governance_rules` ADD `content_status` text DEFAULT 'pending_attorney_review' NOT NULL;--> statement-breakpoint
ALTER TABLE `governance_rules` ADD `reviewed_by` text;--> statement-breakpoint
ALTER TABLE `governance_rules` ADD `reviewed_at` integer;--> statement-breakpoint
ALTER TABLE `obligations` ADD `rule_code` text DEFAULT 'legacy' NOT NULL;--> statement-breakpoint
ALTER TABLE `obligations` ADD `rule_version` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `obligations` ADD `authority_citation` text DEFAULT 'Legacy obligation; review required' NOT NULL;--> statement-breakpoint
ALTER TABLE `obligations` ADD `requirement` text DEFAULT 'Review obligation requirements' NOT NULL;--> statement-breakpoint
ALTER TABLE `obligations` ADD `trigger_at` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `obligations` ADD `trigger_source_type` text DEFAULT 'legacy' NOT NULL;--> statement-breakpoint
ALTER TABLE `obligations` ADD `trigger_source_id` text DEFAULT 'legacy' NOT NULL;--> statement-breakpoint
ALTER TABLE `obligations` ADD `revision` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `obligations` ADD `completed_by` text;--> statement-breakpoint
ALTER TABLE `obligations` ADD `completed_at` integer;--> statement-breakpoint
ALTER TABLE `obligations` ADD `completion_evidence` text;--> statement-breakpoint
ALTER TABLE `obligations` ADD `cancelled_by` text;--> statement-breakpoint
ALTER TABLE `obligations` ADD `cancelled_at` integer;--> statement-breakpoint
ALTER TABLE `obligations` ADD `cancellation_reason` text;--> statement-breakpoint
ALTER TABLE `obligations` ADD `updated_at` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
UPDATE `governance_rules` SET `content_status` = 'synthetic_sandbox' WHERE `tenant_id` = 'tenant-golden' AND `code` = 'firm-pilot-qme-review' AND `version` = 1;--> statement-breakpoint
PRAGMA optimize;
