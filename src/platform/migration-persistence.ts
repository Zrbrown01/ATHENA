import { createId } from "@paralleldrive/cuid2";
import { and, asc, eq } from "drizzle-orm";
import { getPreviewDb } from "../../db";
import {
  migrationAcceptances,
  migrationBatches,
  migrationCutovers,
  migrationDecisions,
  migrationExceptions,
  migrationExportPackages,
  migrationMappingVersions,
  migrationReconciliations,
  migrationRecords,
  migrationSourceSystems,
  previewEvents,
  previewOutbox,
} from "../../db/schema";
import type { MigrationCommand } from "@/domain/migration/lifecycle";
import type { EventEnvelope } from "./events";
import type { RequestActor } from "./request-actor";
export async function readMigrationBatch(t: string, id: string) {
  const [x] = await getPreviewDb()
    .select()
    .from(migrationBatches)
    .where(and(eq(migrationBatches.tenantId, t), eq(migrationBatches.id, id)))
    .limit(1);
  return x ?? null;
}
export async function readMigrationEvent(t: string, key: string) {
  const [x] = await getPreviewDb()
    .select({ eventId: previewEvents.eventId })
    .from(previewEvents)
    .where(
      and(eq(previewEvents.tenantId, t), eq(previewEvents.idempotencyKey, key)),
    )
    .limit(1);
  return x ?? null;
}
export async function migrationProjection(t: string) {
  const db = getPreviewDb(),
    [
      sources,
      packages,
      mappings,
      batches,
      records,
      exceptions,
      reconciliations,
      acceptances,
      cutovers,
      decisions,
    ] = await Promise.all([
      db
        .select()
        .from(migrationSourceSystems)
        .where(eq(migrationSourceSystems.tenantId, t)),
      db
        .select()
        .from(migrationExportPackages)
        .where(eq(migrationExportPackages.tenantId, t)),
      db
        .select()
        .from(migrationMappingVersions)
        .where(eq(migrationMappingVersions.tenantId, t)),
      db
        .select()
        .from(migrationBatches)
        .where(eq(migrationBatches.tenantId, t))
        .orderBy(asc(migrationBatches.createdAt)),
      db
        .select()
        .from(migrationRecords)
        .where(eq(migrationRecords.tenantId, t))
        .orderBy(asc(migrationRecords.createdAt)),
      db
        .select()
        .from(migrationExceptions)
        .where(eq(migrationExceptions.tenantId, t))
        .orderBy(asc(migrationExceptions.createdAt)),
      db
        .select()
        .from(migrationReconciliations)
        .where(eq(migrationReconciliations.tenantId, t)),
      db
        .select()
        .from(migrationAcceptances)
        .where(eq(migrationAcceptances.tenantId, t)),
      db
        .select()
        .from(migrationCutovers)
        .where(eq(migrationCutovers.tenantId, t))
        .orderBy(asc(migrationCutovers.authorizedAt)),
      db
        .select()
        .from(migrationDecisions)
        .where(eq(migrationDecisions.tenantId, t))
        .orderBy(asc(migrationDecisions.createdAt)),
    ]);
  return {
    sources,
    packages,
    mappings,
    batches,
    records,
    exceptions,
    reconciliations,
    acceptances,
    cutovers,
    decisions,
  };
}
export async function persistMigration(input: {
  command: MigrationCommand;
  fromStatus: string;
  toStatus: string;
  event: EventEnvelope<Record<string, unknown>>;
  actor: RequestActor;
}) {
  const db = getPreviewDb(),
    c = input.command,
    now = new Date(input.event.occurredAt),
    eventWrite = db.insert(previewEvents).values(eventValues(input.event)),
    outboxWrite = db
      .insert(previewOutbox)
      .values({
        id: createId(),
        tenantId: c.tenantId,
        eventId: input.event.eventId,
        topic: "athena.migration",
        payload: input.event,
        attempts: 0,
        availableAt: now,
      }),
    decisionWrite = db
      .insert(migrationDecisions)
      .values({
        id: createId(),
        tenantId: c.tenantId,
        batchId: c.batchId,
        action: c.action,
        fromStatus: input.fromStatus,
        toStatus: input.toStatus,
        reason: commandReason(c),
        actorId: input.actor.userId,
        eventId: input.event.eventId,
        idempotencyKey: c.idempotencyKey,
        createdAt: now,
      });
  if (c.action === "register_fixture_package")
    await db.batch([
      db
        .insert(migrationSourceSystems)
        .values({
          id: c.sourceSystemId,
          tenantId: c.tenantId,
          name: "MerusCase deterministic export",
          provider: "meruscase",
          providerMode: "deterministic_sandbox",
          status: "registered",
          createdBy: input.actor.userId,
          createdAt: now,
        }),
      db
        .insert(migrationExportPackages)
        .values({
          id: c.packageId,
          tenantId: c.tenantId,
          sourceSystemId: c.sourceSystemId,
          fileName: c.fileName,
          sha256: c.packageSha256,
          byteSize: c.byteSize,
          recordCount: c.recordCount,
          objectKey: null,
          custodyStatus: "checksum_registered",
          immutable: true,
          createdBy: input.actor.userId,
          createdAt: now,
        }),
      db
        .insert(migrationMappingVersions)
        .values({
          id: c.mappingVersionId,
          tenantId: c.tenantId,
          sourceSystemId: c.sourceSystemId,
          version: 1,
          status: "draft",
          entityMappings: {
            matter: "matters",
            claim: "claims",
            injury: "injuries",
            adj: "adjudication_cases",
            document: "document_intakes",
          },
          preservesSeparateIdentities: true,
          transformationChecksum: c.packageSha256,
          createdAt: now,
        }),
      db
        .insert(migrationBatches)
        .values({
          id: c.batchId,
          tenantId: c.tenantId,
          sourceSystemId: c.sourceSystemId,
          packageId: c.packageId,
          mappingVersionId: c.mappingVersionId,
          status: "package_registered",
          sourceRecordCount: 5,
          stagedRecordCount: 0,
          acceptedRecordCount: 0,
          exceptionCount: 0,
          sourceAggregateSha256: c.packageSha256,
          targetAggregateSha256: null,
          resumable: true,
          revision: 1,
          createdBy: input.actor.userId,
          createdAt: now,
          updatedAt: now,
        }),
      decisionWrite,
      eventWrite,
      outboxWrite,
    ]);
  else {
    const b = await readMigrationBatch(c.tenantId, c.batchId);
    if (!b) throw new Error("Migration batch does not exist");
    const nextRevision = b.revision + 1;
    if (c.action === "validate_package")
      await db.batch([
        db
          .update(migrationMappingVersions)
          .set({
            status: "approved",
            approvedBy: input.actor.userId,
            approvedAt: now,
          })
          .where(
            and(
              eq(migrationMappingVersions.tenantId, c.tenantId),
              eq(migrationMappingVersions.id, b.mappingVersionId),
            ),
          ),
        batchUpdate(c, b, {
          status: "validated",
          revision: nextRevision,
          updatedAt: now,
        }),
        decisionWrite,
        eventWrite,
        outboxWrite,
      ]);
    else if (c.action === "stage_import") {
      const kinds = ["matter", "claim", "injury", "adj", "document"],
        targets = [
          "matter-migrated-001",
          "claim-migrated-001",
          "injury-migrated-001",
          "adj-migrated-001",
          "document-migrated-001",
        ],
        recordWrites = c.recordIds.map((id, i) =>
          db
            .insert(migrationRecords)
            .values({
              id,
              tenantId: c.tenantId,
              batchId: c.batchId,
              sourceSystemId: b.sourceSystemId,
              sourceRecordType: kinds[i],
              sourceRecordId: `MC-${kinds[i]}-001`,
              targetEntityType: kinds[i],
              targetEntityId: targets[i],
              status: i === 2 ? "rejected" : "staged",
              sourceSha256: b.sourceAggregateSha256,
              transformedSha256: i === 2 ? null : b.sourceAggregateSha256,
              fileCustodyStatus: i === 4 ? "quarantined" : "not_file",
              createdAt: now,
              updatedAt: now,
            }),
        );
      await db.batch([
        recordWrites[0]!,
        recordWrites[1]!,
        recordWrites[2]!,
        recordWrites[3]!,
        recordWrites[4]!,
        db
          .insert(migrationExceptions)
          .values({
            id: c.exceptionId,
            tenantId: c.tenantId,
            batchId: c.batchId,
            migrationRecordId: c.recordIds[2],
            code: "INJURY_EMPLOYER_NORMALIZATION",
            severity: "blocking",
            detail:
              "Synthetic employer alias requires explicit normalized target confirmation.",
            status: "open",
            createdAt: now,
          }),
        batchUpdate(c, b, {
          status: "staged_with_exceptions",
          stagedRecordCount: 4,
          exceptionCount: 1,
          revision: nextRevision,
          updatedAt: now,
        }),
        decisionWrite,
        eventWrite,
        outboxWrite,
      ]);
    } else if (c.action === "resolve_exception")
      await db.batch([
        db
          .update(migrationExceptions)
          .set({
            status: "resolved",
            resolution: c.correctionEvidence,
            resolvedBy: input.actor.userId,
            resolvedAt: now,
          })
          .where(
            and(
              eq(migrationExceptions.tenantId, c.tenantId),
              eq(migrationExceptions.id, c.exceptionId),
              eq(migrationExceptions.status, "open"),
            ),
          ),
        db
          .update(migrationRecords)
          .set({
            status: "corrected",
            transformedSha256: b.sourceAggregateSha256,
            correctionEvidence: c.correctionEvidence,
            correctedBy: input.actor.userId,
            updatedAt: now,
          })
          .where(
            and(
              eq(migrationRecords.tenantId, c.tenantId),
              eq(migrationRecords.id, c.migrationRecordId),
              eq(migrationRecords.status, "rejected"),
            ),
          ),
        batchUpdate(c, b, {
          status: "staged",
          stagedRecordCount: 5,
          exceptionCount: 0,
          targetAggregateSha256: b.sourceAggregateSha256,
          revision: nextRevision,
          updatedAt: now,
        }),
        decisionWrite,
        eventWrite,
        outboxWrite,
      ]);
    else if (c.action === "reconcile_batch")
      await db.batch([
        db
          .insert(migrationReconciliations)
          .values({
            id: c.reconciliationId,
            tenantId: c.tenantId,
            batchId: c.batchId,
            sourceCount: b.sourceRecordCount,
            targetCount: b.stagedRecordCount,
            openExceptionCount: b.exceptionCount,
            sourceAggregateSha256: b.sourceAggregateSha256,
            targetAggregateSha256: b.targetAggregateSha256!,
            outcome: "matched",
            detail:
              "Counts, aggregate checksums, source identities, separate domain mappings, and zero open exceptions match.",
            createdBy: input.actor.userId,
            createdAt: now,
          }),
        batchUpdate(c, b, {
          status: "reconciled",
          revision: nextRevision,
          updatedAt: now,
        }),
        decisionWrite,
        eventWrite,
        outboxWrite,
      ]);
    else if (c.action === "accept_batch")
      await db.batch([
        db
          .insert(migrationAcceptances)
          .values({
            id: c.acceptanceId,
            tenantId: c.tenantId,
            batchId: c.batchId,
            outcome: "accepted",
            scope: c.scope,
            evidence: c.evidence,
            acceptedBy: input.actor.userId,
            acceptedAt: now,
          }),
        db
          .update(migrationRecords)
          .set({ status: "accepted", updatedAt: now })
          .where(
            and(
              eq(migrationRecords.tenantId, c.tenantId),
              eq(migrationRecords.batchId, c.batchId),
            ),
          ),
        batchUpdate(c, b, {
          status: "accepted",
          acceptedRecordCount: 5,
          revision: nextRevision,
          updatedAt: now,
        }),
        decisionWrite,
        eventWrite,
        outboxWrite,
      ]);
    else {
      const status =
          c.action === "freeze_source"
            ? "frozen"
            : c.action === "authorize_cutover"
              ? "cutover"
              : "archived",
        frozen = true,
        archived = c.action === "archive_legacy";
      await db.batch([
        db
          .insert(migrationCutovers)
          .values({
            id: c.cutoverRecordId,
            tenantId: c.tenantId,
            batchId: c.batchId,
            status,
            rollbackPlan: c.rollbackPlan,
            sourceWriteFrozen: frozen,
            legacyArchiveReadOnly: archived,
            authorizedBy: input.actor.userId,
            authorizedAt: now,
          }),
        batchUpdate(c, b, { status, revision: nextRevision, updatedAt: now }),
        decisionWrite,
        eventWrite,
        outboxWrite,
      ]);
    }
  }
  return { replayed: false, eventId: input.event.eventId };
}
function batchUpdate(
  c: Exclude<MigrationCommand, { action: "register_fixture_package" }>,
  b: NonNullable<Awaited<ReturnType<typeof readMigrationBatch>>>,
  set: Record<string, unknown>,
) {
  return getPreviewDb()
    .update(migrationBatches)
    .set(set)
    .where(
      and(
        eq(migrationBatches.tenantId, c.tenantId),
        eq(migrationBatches.id, c.batchId),
        eq(migrationBatches.revision, c.expectedRevision),
        eq(migrationBatches.status, b.status),
      ),
    );
}
function commandReason(c: MigrationCommand) {
  if ("reason" in c) return c.reason;
  if ("correctionEvidence" in c) return c.correctionEvidence;
  if ("evidence" in c) return c.evidence;
  if ("rollbackPlan" in c) return c.rollbackPlan;
  return "Acknowledged immutable deterministic migration package and provider limitations.";
}
function eventValues(e: EventEnvelope<Record<string, unknown>>) {
  return {
    eventId: e.eventId,
    eventType: e.eventType,
    eventVersion: e.eventVersion,
    tenantId: e.tenantId,
    aggregateType: e.aggregateType,
    aggregateId: e.aggregateId,
    matterId: e.matterId,
    actorId: e.actorId,
    occurredAt: new Date(e.occurredAt),
    correlationId: e.correlationId,
    causationId: e.causationId,
    idempotencyKey: e.idempotencyKey,
    source: e.source,
    visibility: e.visibility,
    retentionPolicy: e.retentionPolicy,
    payload: e.payload,
  };
}
