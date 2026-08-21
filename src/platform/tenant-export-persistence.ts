import { createId } from "@paralleldrive/cuid2";
import {
  and,
  asc,
  desc,
  eq,
  getTableColumns,
  getTableName,
  is,
} from "drizzle-orm";
import {
  SQLiteTable,
  type AnySQLiteColumn,
  type AnySQLiteTable,
} from "drizzle-orm/sqlite-core";
import { getDocumentBucket, getPreviewDb } from "../../db";
import * as athenaSchema from "../../db/schema";
import {
  previewEvents,
  previewOutbox,
  tenantExportDecisions,
  tenantExportJobs,
  tenantExportScopeItems,
} from "../../db/schema";
import { buildTarArchive, readTarArchive } from "@/domain/exports/tar-archive";
import {
  assessTenantExportCoverage,
  enforceTenantExportRuntimeBudget,
  estimateTarByteSize,
  estimateTarByteSizeFromSizes,
  TenantExportLimitError,
  tenantExportLimitFailureEvidence,
  tenantExportCategories,
  tenantExportRuntimeLimits,
  type TenantExportCategory,
  type TenantExportCommand,
  verifyTenantPortabilityArchive,
} from "@/domain/exports/tenant-portability";
import type { EventEnvelope } from "./events";
import type { RequestActor } from "./request-actor";

export async function readTenantExport(tenantId: string, exportId: string) {
  const [row] = await getPreviewDb()
    .select()
    .from(tenantExportJobs)
    .where(eq(tenantExportJobs.id, exportId))
    .limit(1);
  return row?.tenantId === tenantId ? row : null;
}

export async function readTenantExportEvent(
  tenantId: string,
  idempotencyKey: string,
) {
  const [row] = await getPreviewDb()
    .select({ eventId: previewEvents.eventId })
    .from(previewEvents)
    .where(
      and(
        eq(previewEvents.tenantId, tenantId),
        eq(previewEvents.idempotencyKey, idempotencyKey),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function tenantExportProjection(tenantId: string) {
  const db = getPreviewDb();
  const [jobs, scopeItems, decisions] = await Promise.all([
    db
      .select()
      .from(tenantExportJobs)
      .where(eq(tenantExportJobs.tenantId, tenantId))
      .orderBy(desc(tenantExportJobs.createdAt)),
    db
      .select()
      .from(tenantExportScopeItems)
      .where(eq(tenantExportScopeItems.tenantId, tenantId)),
    db
      .select()
      .from(tenantExportDecisions)
      .where(eq(tenantExportDecisions.tenantId, tenantId))
      .orderBy(asc(tenantExportDecisions.createdAt)),
  ]);
  return { jobs, scopeItems, decisions };
}

export async function getTenantExportObject(
  tenantId: string,
  exportId: string,
) {
  const job = await readTenantExport(tenantId, exportId);
  if (!job || job.status !== "ready") return null;
  const object = await getDocumentBucket().get(job.objectKey);
  return object ? { job, object } : null;
}

export async function persistTenantExport(input: {
  command: TenantExportCommand;
  event: EventEnvelope<Record<string, unknown>>;
  actor: RequestActor;
}) {
  let artifact: Awaited<ReturnType<typeof buildTenantArtifact>>;
  try {
    artifact = await buildTenantArtifact(input.command, input.actor);
  } catch (error) {
    if (error instanceof TenantExportLimitError)
      return persistTenantExportFailure(input, error);
    throw error;
  }
  const db = getPreviewDb();
  const now = new Date(input.event.occurredAt);
  try {
    await db.batch([
      db.insert(tenantExportJobs).values({
        id: input.command.exportId,
        tenantId: input.command.tenantId,
        status: "ready",
        purpose: input.command.purpose,
        format: "application/x-tar",
        completeness: artifact.coverage.completeness,
        requiredCategoryCount: artifact.coverage.requiredCategoryCount,
        includedCategoryCount: artifact.coverage.includedCategoryCount,
        sourceTableCount: artifact.sourceTableCount,
        includedTableCount: artifact.includedTableCount,
        sourceOriginalCount: artifact.sourceOriginalCount,
        includedOriginalCount: artifact.includedOriginalCount,
        missingItems: artifact.coverage.missingItems,
        objectKey: artifact.objectKey,
        sha256: artifact.sha256,
        byteSize: artifact.archive.byteLength,
        archiveEntryCount: artifact.archiveEntryCount,
        restorationVerifiedAt: null,
        createdBy: input.actor.userId,
        createdAt: now,
      }),
      ...artifact.coverage.items.map((item) =>
        db.insert(tenantExportScopeItems).values({
          id: createId(),
          tenantId: input.command.tenantId,
          exportId: input.command.exportId,
          category: item.category,
          status: item.status,
          recordCount: item.recordCount,
          sourceTables: artifact.sourceTables[item.category],
          reason: item.reason,
        }),
      ),
      db.insert(tenantExportDecisions).values({
        id: createId(),
        tenantId: input.command.tenantId,
        exportId: input.command.exportId,
        action: input.command.action,
        outcome: "created",
        reason: `Created a machine-labeled ${artifact.coverage.completeness} synthetic tenant portability archive.`,
        actorId: input.actor.userId,
        eventId: input.event.eventId,
        idempotencyKey: input.command.idempotencyKey,
        createdAt: now,
      }),
      db.insert(previewEvents).values({
        eventId: input.event.eventId,
        eventType: input.event.eventType,
        eventVersion: input.event.eventVersion,
        tenantId: input.event.tenantId,
        aggregateType: input.event.aggregateType,
        aggregateId: input.event.aggregateId,
        actorId: input.actor.userId,
        occurredAt: now,
        correlationId: input.event.correlationId,
        causationId: input.event.causationId,
        idempotencyKey: input.event.idempotencyKey,
        source: input.event.source,
        visibility: input.event.visibility,
        retentionPolicy: input.event.retentionPolicy,
        payload: {
          ...input.event.payload,
          completeness: artifact.coverage.completeness,
          missingItemCount: artifact.coverage.missingItems.length,
        },
      }),
      db.insert(previewOutbox).values({
        id: createId(),
        tenantId: input.command.tenantId,
        eventId: input.event.eventId,
        topic: "athena.tenant_exports",
        payload: input.event,
        attempts: 0,
        availableAt: now,
      }),
    ] as never);
  } catch (error) {
    await getDocumentBucket().delete(artifact.objectKey);
    throw error;
  }
  return {
    replayed: false,
    eventId: input.event.eventId,
    completeness: artifact.coverage.completeness,
    status: "ready" as const,
  };
}

async function persistTenantExportFailure(
  input: {
    command: TenantExportCommand;
    event: EventEnvelope<Record<string, unknown>>;
    actor: RequestActor;
  },
  error: TenantExportLimitError,
) {
  const db = getPreviewDb();
  const now = new Date(input.event.occurredAt);
  const failure = tenantExportLimitFailureEvidence(error);
  const failedEvent = {
    ...input.event,
    eventType: failure.eventType,
    payload: {
      ...input.event.payload,
      outcome: "failed",
      limitCode: failure.limitCode,
      observed: failure.observed,
      limit: failure.limit,
    },
  };
  const sourceTableCount = schemaTableInventory().length;
  const missingItems = failure.missingItems;
  await db.batch([
    db.insert(tenantExportJobs).values({
      id: input.command.exportId,
      tenantId: input.command.tenantId,
      status: failure.status,
      purpose: input.command.purpose,
      format: "application/x-tar",
      completeness: failure.completeness,
      requiredCategoryCount: tenantExportCategories.length,
      includedCategoryCount: 0,
      sourceTableCount,
      includedTableCount: 0,
      sourceOriginalCount: 0,
      includedOriginalCount: 0,
      missingItems,
      objectKey: `${input.command.tenantId}/exports/tenant/${input.command.exportId}/failed`,
      sha256: "",
      byteSize: 0,
      archiveEntryCount: 0,
      restorationVerifiedAt: null,
      createdBy: input.actor.userId,
      createdAt: now,
    }),
    db.insert(tenantExportDecisions).values({
      id: createId(),
      tenantId: input.command.tenantId,
      exportId: input.command.exportId,
      action: input.command.action,
      outcome: failure.decisionOutcome,
      reason: `Tenant portability archive stopped at the enforced ${error.code}: ${error.observed} exceeded ${error.limit}.`,
      actorId: input.actor.userId,
      eventId: failedEvent.eventId,
      idempotencyKey: input.command.idempotencyKey,
      createdAt: now,
    }),
    db.insert(previewEvents).values({
      eventId: failedEvent.eventId,
      eventType: failedEvent.eventType,
      eventVersion: failedEvent.eventVersion,
      tenantId: failedEvent.tenantId,
      aggregateType: failedEvent.aggregateType,
      aggregateId: failedEvent.aggregateId,
      actorId: input.actor.userId,
      occurredAt: now,
      correlationId: failedEvent.correlationId,
      causationId: failedEvent.causationId,
      idempotencyKey: failedEvent.idempotencyKey,
      source: failedEvent.source,
      visibility: failedEvent.visibility,
      retentionPolicy: failedEvent.retentionPolicy,
      payload: failedEvent.payload,
    }),
    db.insert(previewOutbox).values({
      id: createId(),
      tenantId: failedEvent.tenantId,
      eventId: failedEvent.eventId,
      topic: "athena.tenant_exports",
      payload: failedEvent,
      attempts: 0,
      availableAt: now,
    }),
  ]);
  return {
    replayed: false,
    eventId: failedEvent.eventId,
    completeness: "partial" as const,
    status: "failed" as const,
    limitCode: error.code,
  };
}

async function buildTenantArtifact(
  command: TenantExportCommand,
  actor: RequestActor,
) {
  const db = getPreviewDb();
  const schemaTables = schemaTableInventory();
  const tenantTables = schemaTables.flatMap((table) => {
    const tenantColumn = getTableColumns(table).tenantId;
    return tenantColumn ? [{ table, tenantColumn }] : [];
  });
  let totalRows = 0;
  const tableData = new Map<string, unknown[]>();
  for (const { table, tenantColumn } of tenantTables) {
    const tableRows = await pagedRows(
      db,
      table,
      tenantColumn,
      command.tenantId,
      (pageRows) => {
        totalRows += pageRows;
        enforceTenantExportRuntimeBudget({
          rowCount: totalRows,
          estimatedArchiveBytes: 0,
        });
      },
    );
    tableData.set(getTableName(table), tableRows);
  }
  const includedTableNames = [...tableData.keys()].sort();
  const categoryTables: Record<TenantExportCategory, string[]> = {
    original_files: ["document_intakes"],
    human_readable_indexes: ["matters"],
    structured_data: includedTableNames,
    document_metadata: [
      "document_intakes",
      "document_evidence_records",
      "document_derivatives",
      "production_sets",
      "resource_classifications",
    ],
    communications: [
      "communication_threads",
      "communication_messages",
      "communication_attachments",
    ],
    calendar: ["calendar_events", "calendar_reminders"],
    tasks: ["matter_tasks", "task_dependencies"],
    events: ["preview_events"],
    billing: [
      "candidate_time_entries",
      "prebills",
      "invoices",
      "invoice_payments",
    ],
    audit: [
      "audit_records",
      "access_decision_events",
      "classification_decisions",
    ],
    checksums: [],
    export_manifest: [],
  };
  const entries = tenantExportCategories
    .filter(
      (category) =>
        !["original_files", "checksums", "export_manifest"].includes(category),
    )
    .map((category) => {
      const tables = categoryTables[category];
      const payload = Object.fromEntries(
        tables.map((name) => [name, tableData.get(name) ?? []]),
      );
      return {
        path:
          category === "human_readable_indexes"
            ? "indexes/matters.json"
            : `records/${category}.json`,
        bytes: jsonBytes(payload),
        category,
        recordCount: Object.values(payload).reduce(
          (total, value) => total + (value as unknown[]).length,
          0,
        ),
      };
    });
  const documents = (tableData.get("document_intakes") ?? []) as Array<{
    id: string;
    objectKey: string;
    sha256: string;
  }>;
  const originalEntries: Array<{
    path: string;
    bytes: Uint8Array;
    category: TenantExportCategory;
    recordCount: number;
  }> = [];
  let projectedEntrySizes = entries.map((entry) => entry.bytes.byteLength);
  enforceTenantExportRuntimeBudget({
    rowCount: totalRows,
    estimatedArchiveBytes: estimateTarByteSizeFromSizes(projectedEntrySizes),
  });
  for (const document of documents) {
    const object = await getDocumentBucket().get(document.objectKey);
    if (!object) continue;
    enforceTenantExportRuntimeBudget({
      rowCount: totalRows,
      estimatedArchiveBytes: estimateTarByteSizeFromSizes([
        ...projectedEntrySizes,
        object.size,
      ]),
    });
    const bytes = new Uint8Array(await object.arrayBuffer());
    if ((await sha256Hex(bytes)) !== document.sha256) continue;
    originalEntries.push({
      path: `originals/${document.id}.pdf`,
      bytes,
      category: "original_files",
      recordCount: 1,
    });
    projectedEntrySizes = [...projectedEntrySizes, bytes.byteLength];
  }
  const contentEntries = [...entries, ...originalEntries];
  const checksums = await Promise.all(
    contentEntries.map(async (entry) => ({
      path: entry.path,
      sha256: await sha256Hex(entry.bytes),
      byteSize: entry.bytes.byteLength,
    })),
  );
  const categoryRecordCounts = Object.fromEntries(
    tenantExportCategories.map((category) => [
      category,
      contentEntries
        .filter((entry) => entry.category === category)
        .reduce((total, entry) => total + entry.recordCount, 0),
    ]),
  ) as Record<TenantExportCategory, number>;
  categoryRecordCounts.checksums = checksums.length;
  categoryRecordCounts.export_manifest = 1;
  const coverage = assessTenantExportCoverage({
    sourceTableCount: schemaTables.length,
    includedTableCount: includedTableNames.length,
    sourceOriginalCount: documents.length,
    includedOriginalCount: originalEntries.length,
    categoryRecordCounts,
  });
  const manifest = {
    manifestVersion: 1,
    exportType: "tenant_portability",
    tenantId: command.tenantId,
    generatedAt: new Date().toISOString(),
    generatedBy: actor.userId,
    purpose: command.purpose,
    syntheticDataOnly: true,
    completeness: coverage.completeness,
    missingItems: coverage.missingItems,
    sourceTableCount: schemaTables.length,
    includedTableCount: includedTableNames.length,
    sourceOriginalCount: documents.length,
    includedOriginalCount: originalEntries.length,
    coverage: coverage.items,
    limitations: [
      "Synthetic pilot data only.",
      "Completeness requires every schema table to carry tenant context and every original object to pass checksum verification.",
      "External provider data is not included while providers are disconnected.",
    ],
  };
  const archiveEntries = [
    ...contentEntries,
    { path: "checksums.json", bytes: jsonBytes(checksums) },
    { path: "manifest.json", bytes: jsonBytes(manifest) },
  ];
  enforceTenantExportRuntimeBudget({
    rowCount: totalRows,
    estimatedArchiveBytes: estimateTarByteSize(archiveEntries),
  });
  const archive = buildTarArchive(archiveEntries);
  enforceTenantExportRuntimeBudget({
    rowCount: totalRows,
    estimatedArchiveBytes: archive.byteLength,
  });
  await verifyTenantPortabilityArchive(archive);
  const objectKey = `${command.tenantId}/exports/tenant/${command.exportId}/tenant-portability.tar`;
  const sha256 = await sha256Hex(archive);
  await getDocumentBucket().put(objectKey, archive, {
    httpMetadata: { contentType: "application/x-tar" },
    customMetadata: {
      tenantId: command.tenantId,
      exportId: command.exportId,
      sha256,
      completeness: coverage.completeness,
      syntheticDataOnly: "true",
    },
  });
  return {
    archive,
    objectKey,
    sha256,
    coverage,
    sourceTables: categoryTables,
    sourceTableCount: schemaTables.length,
    includedTableCount: includedTableNames.length,
    sourceOriginalCount: documents.length,
    includedOriginalCount: originalEntries.length,
    archiveEntryCount: readTarArchive(archive).length,
  };
}

async function pagedRows(
  db: ReturnType<typeof getPreviewDb>,
  table: AnySQLiteTable,
  tenantColumn: AnySQLiteColumn,
  tenantId: string,
  onPage: (rowCount: number) => void,
) {
  const result: unknown[] = [];
  let offset = 0;
  while (true) {
    const page = await db
      .select()
      .from(table)
      .where(eq(tenantColumn, tenantId))
      .limit(tenantExportRuntimeLimits.queryPageSize)
      .offset(offset);
    result.push(...page);
    onPage(page.length);
    if (page.length < tenantExportRuntimeLimits.queryPageSize) break;
    offset += page.length;
  }
  return result;
}

function schemaTableInventory() {
  return (Object.values(athenaSchema) as unknown[]).filter(
    (value): value is AnySQLiteTable => is(value, SQLiteTable),
  );
}

function jsonBytes(value: unknown) {
  return new TextEncoder().encode(JSON.stringify(value, null, 2));
}

async function sha256Hex(bytes: Uint8Array) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    bytes.buffer as ArrayBuffer,
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}
