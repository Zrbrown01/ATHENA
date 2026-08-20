import { describe, expect, it } from "vitest";
import { buildCompanionExport } from "@/domain/companion/export-manifest";
import { buildSyntheticQmePdf, SYNTHETIC_QME_SHA256 } from "@/domain/documents/synthetic-qme-original";
import { readTarArchive } from "./tar-archive";
import { buildVerifiedMatterArchive } from "./matter-archive";

describe("complete golden matter archive", () => {
  it("packages and restores the coverage manifest plus the synthetic original", async () => {
    const documentMetadata = [{ id: "fixture-qme-rivera-20260818", sha256: SYNTHETIC_QME_SHA256, status: "ready" }];
    const manifest = buildCompanionExport({ tenantId: "tenant-golden", matterId: "matter-golden-001", generatedAt: new Date("2026-08-20T00:00:00Z"), generatedBy: "user-a", events: [], inventory: { auditRecords: [], deliveryReceipts: [], documentMetadata, legalHolds: [], originalDocumentBytesIncluded: 1 } });
    expect(manifest).toMatchObject({ manifestVersion: 3, completeness: "complete", missingItems: [] });
    const result = await buildVerifiedMatterArchive(manifest, [{ path: "documents/fixture-qme-rivera-20260818/original.pdf", bytes: buildSyntheticQmePdf(), sha256: SYNTHETIC_QME_SHA256 }]);
    expect(result).toMatchObject({ entryCount: 2, restorationVerified: true });
    expect(readTarArchive(result.archive).map((entry) => entry.path)).toEqual(["manifest.json", "documents/fixture-qme-rivera-20260818/original.pdf"]);
  });
});
