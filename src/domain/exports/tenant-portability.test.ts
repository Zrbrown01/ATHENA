import { describe, expect, it } from "vitest";
import {
  assessTenantExportCoverage,
  decideTenantExport,
  tenantExportCategories,
  verifyTenantPortabilityArchive,
} from "./tenant-portability";
import { buildTarArchive } from "./tar-archive";
import {
  AuthorizationError,
  type TenantContext,
} from "@/platform/tenant-context";

const counts = Object.fromEntries(
  tenantExportCategories.map((category) => [category, 1]),
) as Record<(typeof tenantExportCategories)[number], number>;
const context: TenantContext = {
  tenantId: "tenant-a",
  userId: "partner-1",
  roles: ["partner"],
  matterAccess: new Set(),
};

describe("tenant portability", () => {
  it("never labels incomplete schema coverage complete", () => {
    const result = assessTenantExportCoverage({
      sourceTableCount: 147,
      includedTableCount: 26,
      sourceOriginalCount: 2,
      includedOriginalCount: 2,
      categoryRecordCounts: counts,
    });
    expect(result.completeness).toBe("partial");
    expect(result.missingItems).toContain("121_schema_tables_not_serialized");
    expect(
      result.items.find((item) => item.category === "structured_data")?.status,
    ).toBe("partial");
  });

  it("requires every original checksum before completeness", () => {
    const result = assessTenantExportCoverage({
      sourceTableCount: 26,
      includedTableCount: 26,
      sourceOriginalCount: 2,
      includedOriginalCount: 1,
      categoryRecordCounts: counts,
    });
    expect(result.completeness).toBe("partial");
    expect(
      result.items.find((item) => item.category === "original_files")?.status,
    ).toBe("partial");
  });

  it("allows complete only with full table and original coverage", () =>
    expect(
      assessTenantExportCoverage({
        sourceTableCount: 26,
        includedTableCount: 26,
        sourceOriginalCount: 2,
        includedOriginalCount: 2,
        categoryRecordCounts: counts,
      }).completeness,
    ).toBe("complete"));

  it("enforces partner role and tenant isolation", () => {
    const raw = {
      action: "create_portability_archive",
      tenantId: "tenant-b",
      exportId: "tenant-export-1",
      purpose: "Create an authorized synthetic portability evidence package.",
      syntheticDataAcknowledged: true,
      idempotencyKey: "tenant-export-test-001",
    };
    expect(() => decideTenantExport({ context, raw })).toThrow(
      AuthorizationError,
    );
    expect(() =>
      decideTenantExport({
        context: { ...context, tenantId: "tenant-b", roles: ["attorney"] },
        raw,
      }),
    ).toThrow(/authorized legal reviewer/);
  });

  it("reads back and verifies every declared archive entry", async () => {
    const bytes = new TextEncoder().encode("synthetic tenant record");
    const hash = await crypto.subtle.digest("SHA-256", bytes);
    const sha256 = Array.from(new Uint8Array(hash), (byte) =>
      byte.toString(16).padStart(2, "0"),
    ).join("");
    const archive = buildTarArchive([
      { path: "records/core.json", bytes },
      {
        path: "checksums.json",
        bytes: new TextEncoder().encode(
          JSON.stringify([
            { path: "records/core.json", sha256, byteSize: bytes.byteLength },
          ]),
        ),
      },
      {
        path: "manifest.json",
        bytes: new TextEncoder().encode(
          JSON.stringify({
            exportType: "tenant_portability",
            completeness: "partial",
            missingItems: ["unsupported_tables"],
          }),
        ),
      },
    ]);
    await expect(
      verifyTenantPortabilityArchive(archive),
    ).resolves.toMatchObject({
      entryCount: 3,
      verifiedEntryCount: 1,
      completeness: "partial",
    });
    const corrupted = archive.slice();
    corrupted[512] ^= 1;
    await expect(verifyTenantPortabilityArchive(corrupted)).rejects.toThrow(
      /checksum mismatch/,
    );
  });
});
