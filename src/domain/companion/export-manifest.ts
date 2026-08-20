import { companionFixture } from "./fixture";

export type ExportEvent = { eventId: string; eventType: string; occurredAt: Date | string; actorId: string; payload: unknown };

export interface ExportRecordInventory {
  auditRecords: unknown[];
  deliveryReceipts: unknown[];
  documentMetadata: unknown[];
  legalHolds: unknown[];
  originalDocumentBytesIncluded: number;
}

export function buildCompanionExport(input: { tenantId: string; matterId: string; generatedAt: Date; generatedBy: string; events: ExportEvent[]; inventory?: ExportRecordInventory }) {
  const inventory = input.inventory ?? { auditRecords: [], deliveryReceipts: [], documentMetadata: [], legalHolds: [], originalDocumentBytesIncluded: 0 };
  const coverage = assessExportCoverage({ sourceDocumentCount: Math.max(1, inventory.documentMetadata.length), originalDocumentBytesIncluded: inventory.originalDocumentBytesIncluded });
  return {
    manifestVersion: 3,
    classification: "synthetic-pilot-export",
    completeness: coverage.completeness,
    missingItems: coverage.missingItems,
    tenantId: input.tenantId,
    matterId: input.matterId,
    generatedAt: input.generatedAt.toISOString(),
    generatedBy: input.generatedBy,
    matter: companionFixture.matter,
    sourceDocument: companionFixture.document,
    sourceLinkedFacts: companionFixture.facts,
    workProduct: companionFixture.workProduct,
    candidateTime: companionFixture.time,
    events: input.events,
    records: inventory,
    coverage: coverage.items,
    limitations: ["Synthetic fixture export only", "No production PHI", ...(coverage.completeness === "partial" ? ["Original PDF bytes are not part of this deterministic fixture", "A partial export must never be represented as a complete tenant or matter export"] : []), "Microsoft delivery is blocked and not represented as sent"],
  };
}

export function assessExportCoverage(input: { sourceDocumentCount: number; originalDocumentBytesIncluded: number }) {
  const missingItems = input.originalDocumentBytesIncluded < input.sourceDocumentCount ? ["original_document_bytes"] : [];
  return {
    completeness: missingItems.length ? "partial" as const : "complete" as const,
    missingItems,
    items: [
      { category: "matter_and_claim_identity", status: "included" as const },
      { category: "source_document_metadata", status: "included" as const },
      { category: "source_linked_facts", status: "included" as const },
      { category: "work_product_and_time", status: "included" as const },
      { category: "events_audit_and_delivery_receipts", status: "included" as const },
      { category: "legal_holds", status: "included" as const },
      { category: "original_document_bytes", status: missingItems.length ? "omitted" as const : "included" as const, reason: missingItems.length ? "The deterministic fixture has no original file, and quarantined uploads are not silently bundled." : undefined },
    ],
  };
}
