import { z } from "zod";
import { createEvent } from "@/platform/events";
import { readTarArchive } from "./tar-archive";
import {
  AuthorizationError,
  requireRole,
  type TenantContext,
} from "@/platform/tenant-context";

export const tenantExportCategories = [
  "original_files",
  "human_readable_indexes",
  "structured_data",
  "document_metadata",
  "communications",
  "calendar",
  "tasks",
  "events",
  "billing",
  "audit",
  "checksums",
  "export_manifest",
] as const;

export type TenantExportCategory = (typeof tenantExportCategories)[number];

export const tenantExportRuntimeLimits = {
  queryPageSize: 500,
  maximumRows: 50_000,
  maximumArchiveBytes: 64 * 1024 * 1024,
} as const;

export class TenantExportLimitError extends Error {
  constructor(
    public readonly code: "row_limit_exceeded" | "archive_byte_limit_exceeded",
    public readonly observed: number,
    public readonly limit: number,
  ) {
    super(`Tenant export ${code.replaceAll("_", " ")}: ${observed} exceeds ${limit}`);
    this.name = "TenantExportLimitError";
  }
}

export function enforceTenantExportRuntimeBudget(input: {
  rowCount: number;
  estimatedArchiveBytes: number;
}) {
  if (input.rowCount > tenantExportRuntimeLimits.maximumRows)
    throw new TenantExportLimitError(
      "row_limit_exceeded",
      input.rowCount,
      tenantExportRuntimeLimits.maximumRows,
    );
  if (
    input.estimatedArchiveBytes >
    tenantExportRuntimeLimits.maximumArchiveBytes
  )
    throw new TenantExportLimitError(
      "archive_byte_limit_exceeded",
      input.estimatedArchiveBytes,
      tenantExportRuntimeLimits.maximumArchiveBytes,
    );
}

export function estimateTarByteSize(entries: Array<{ bytes: Uint8Array }>) {
  return estimateTarByteSizeFromSizes(
    entries.map((entry) => entry.bytes.byteLength),
  );
}

export function estimateTarByteSizeFromSizes(sizes: number[]) {
  return (
    sizes.reduce(
      (total, size) => total + 512 + Math.ceil(size / 512) * 512,
      0,
    ) + 1024
  );
}

export function tenantExportLimitFailureEvidence(
  error: TenantExportLimitError,
) {
  return {
    status: "failed" as const,
    completeness: "partial" as const,
    eventType: "tenant_export.failed" as const,
    decisionOutcome: "failed" as const,
    missingItems: [`runtime_${error.code}`],
    limitCode: error.code,
    observed: error.observed,
    limit: error.limit,
  };
}

export const tenantExportCommand = z.object({
  action: z.literal("create_portability_archive"),
  tenantId: z.string().min(1),
  exportId: z.string().min(3).max(160),
  purpose: z.string().trim().min(12).max(1000),
  syntheticDataAcknowledged: z.literal(true),
  idempotencyKey: z.string().min(8).max(200),
});

export type TenantExportCommand = z.infer<typeof tenantExportCommand>;

export function assessTenantExportCoverage(input: {
  sourceTableCount: number;
  includedTableCount: number;
  sourceOriginalCount: number;
  includedOriginalCount: number;
  categoryRecordCounts: Record<TenantExportCategory, number>;
}) {
  const missingItems: string[] = [];
  if (input.includedTableCount < input.sourceTableCount)
    missingItems.push(
      `${input.sourceTableCount - input.includedTableCount}_schema_tables_not_serialized`,
    );
  if (input.includedOriginalCount < input.sourceOriginalCount)
    missingItems.push(
      `${input.sourceOriginalCount - input.includedOriginalCount}_original_objects_missing_or_unverified`,
    );
  const items = tenantExportCategories.map((category) => {
    const isOriginals = category === "original_files";
    const partial =
      (category === "structured_data" &&
        input.includedTableCount < input.sourceTableCount) ||
      (isOriginals && input.includedOriginalCount < input.sourceOriginalCount);
    return {
      category,
      status: partial ? ("partial" as const) : ("included" as const),
      recordCount: input.categoryRecordCounts[category],
      reason: partial
        ? isOriginals
          ? "One or more original objects were missing or failed checksum verification."
          : "The current serializer does not yet cover every tenant-owned schema table."
        : null,
    };
  });
  return {
    completeness: missingItems.length
      ? ("partial" as const)
      : ("complete" as const),
    missingItems,
    items,
    requiredCategoryCount: tenantExportCategories.length,
    includedCategoryCount: items.length,
  };
}

export function decideTenantExport(input: {
  context: TenantContext;
  raw: unknown;
  exportExists?: boolean;
}) {
  const command = tenantExportCommand.parse(input.raw);
  if (command.tenantId !== input.context.tenantId)
    throw new AuthorizationError();
  requireRole(input.context, ["partner", "security_admin"]);
  if (input.exportExists)
    throw new Error("Tenant export identity already exists");
  return {
    command,
    event: createEvent({
      eventType: "tenant_export.created",
      tenantId: command.tenantId,
      aggregateType: "tenant_export",
      aggregateId: command.exportId,
      actorId: input.context.userId,
      correlationId: command.idempotencyKey,
      idempotencyKey: command.idempotencyKey,
      source: "athena.web",
      visibility: "restricted",
      retentionPolicy: "security-permanent",
      payload: {
        action: command.action,
        humanAuthorized: true,
        syntheticDataOnly: true,
        completenessMustBeMachineReadable: true,
      },
    }),
  };
}

export async function verifyTenantPortabilityArchive(archive: Uint8Array) {
  const entries = readTarArchive(archive);
  const byPath = new Map(entries.map((entry) => [entry.path, entry.bytes]));
  const manifestBytes = byPath.get("manifest.json");
  const checksumsBytes = byPath.get("checksums.json");
  if (!manifestBytes || !checksumsBytes)
    throw new Error("Tenant archive manifest or checksums are missing");
  const decoder = new TextDecoder();
  const manifest = JSON.parse(decoder.decode(manifestBytes)) as {
    exportType?: string;
    completeness?: "partial" | "complete";
    missingItems?: string[];
  };
  if (manifest.exportType !== "tenant_portability")
    throw new Error("Tenant archive type is invalid");
  const checksums = JSON.parse(decoder.decode(checksumsBytes)) as Array<{
    path: string;
    sha256: string;
    byteSize: number;
  }>;
  for (const expected of checksums) {
    const bytes = byPath.get(expected.path);
    if (!bytes)
      throw new Error(`Tenant archive entry is missing: ${expected.path}`);
    if (bytes.byteLength !== expected.byteSize)
      throw new Error(`Tenant archive byte size mismatch: ${expected.path}`);
    if ((await digest(bytes)) !== expected.sha256)
      throw new Error(`Tenant archive checksum mismatch: ${expected.path}`);
  }
  if (manifest.completeness === "complete" && manifest.missingItems?.length)
    throw new Error("Complete tenant archive declares missing items");
  return {
    entryCount: entries.length,
    verifiedEntryCount: checksums.length,
    completeness: manifest.completeness,
    missingItems: manifest.missingItems ?? [],
  };
}

async function digest(bytes: Uint8Array) {
  const value = await crypto.subtle.digest(
    "SHA-256",
    bytes.buffer as ArrayBuffer,
  );
  return Array.from(new Uint8Array(value), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}
