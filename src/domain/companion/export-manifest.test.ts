import { describe, expect, it } from "vitest";
import { assessExportCoverage, buildCompanionExport } from "./export-manifest";

describe("buildCompanionExport", () => {
  it("includes provenance, history, limitations, and tenant scope", () => {
    const manifest = buildCompanionExport({ tenantId: "tenant-a", matterId: "matter-a", generatedAt: new Date("2026-08-20T00:00:00Z"), generatedBy: "user-a", events: [{ eventId: "event-a", eventType: "matter.imported", occurredAt: "2026-08-20T00:00:00Z", actorId: "user-a", payload: {} }] });
    expect(manifest.tenantId).toBe("tenant-a");
    expect(manifest.sourceLinkedFacts[0].page).toBe(27);
    expect(manifest.events).toHaveLength(1);
    expect(manifest.completeness).toBe("partial");
    expect(manifest.missingItems).toEqual(["original_document_bytes"]);
    expect(manifest.limitations.join(" ")).toContain("Original PDF bytes");
    expect(manifest.limitations.join(" ")).toContain("not represented as sent");
  });

  it("cannot claim completeness unless every source document byte stream is included", () => {
    expect(assessExportCoverage({ sourceDocumentCount: 2, originalDocumentBytesIncluded: 1 }).completeness).toBe("partial");
    expect(assessExportCoverage({ sourceDocumentCount: 2, originalDocumentBytesIncluded: 2 }).completeness).toBe("complete");
  });
});
