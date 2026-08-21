CREATE TABLE `outbox_consumer_checkpoints` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`consumer` text NOT NULL,
	`event_id` text NOT NULL,
	`outbox_id` text NOT NULL,
	`payload_hash` text NOT NULL,
	`processed_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_consumer_event_once` ON `outbox_consumer_checkpoints` (`tenant_id`,`consumer`,`event_id`);--> statement-breakpoint
CREATE INDEX `idx_consumer_checkpoint_outbox` ON `outbox_consumer_checkpoints` (`tenant_id`,`outbox_id`);--> statement-breakpoint
CREATE TABLE `outbox_reconciliation_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`consumer` text NOT NULL,
	`trigger` text NOT NULL,
	`processed_messages` integer NOT NULL,
	`checkpoints` integer NOT NULL,
	`delivery_receipts` integer NOT NULL,
	`exceptions` integer NOT NULL,
	`outcome` text NOT NULL,
	`detail` text NOT NULL,
	`started_at` integer NOT NULL,
	`finished_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_reconciliation_tenant_time` ON `outbox_reconciliation_runs` (`tenant_id`,`finished_at`);--> statement-breakpoint
INSERT OR IGNORE INTO `outbox_consumer_checkpoints` (`id`,`tenant_id`,`consumer`,`event_id`,`outbox_id`,`payload_hash`,`processed_at`)
SELECT 'legacy:' || d.`id`, d.`tenant_id`, 'athena_internal_event_bus', d.`event_id`, d.`outbox_id`, 'legacy-receipt-baseline', d.`created_at`
FROM `outbox_deliveries` d
JOIN `preview_outbox` o ON o.`id` = d.`outbox_id` AND o.`tenant_id` = d.`tenant_id`
WHERE d.`destination` = 'athena_internal_event_bus' AND d.`outcome` = 'delivered' AND o.`status` = 'processed';--> statement-breakpoint
PRAGMA optimize;
