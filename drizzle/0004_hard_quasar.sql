ALTER TABLE `export_jobs` ADD `completeness` text DEFAULT 'partial' NOT NULL;--> statement-breakpoint
ALTER TABLE `export_jobs` ADD `missing_items` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
UPDATE `export_jobs` SET `missing_items` = '["original_document_bytes"]' WHERE `manifest_version` = 1;--> statement-breakpoint
PRAGMA optimize;
