import { createId } from "@paralleldrive/cuid2";
import { and, asc, eq } from "drizzle-orm";
import { getDocumentBucket, getPreviewDb } from "../../db";
import {
  auditRecords,
  billingValidations,
  candidateTimeEntries,
  companionRuns,
  exportJobs,
  integrationHandoffs,
  documentIntakes,
  legalHolds,
  outboxDeliveries,
  previewEvents,
  previewOutbox,
  workProductDrafts,
} from "../../db/schema";
import { companionFixture } from "@/domain/companion/fixture";
import { buildCompanionExport } from "@/domain/companion/export-manifest";
import { summitSyntheticBillingProfile, validateBillingEntry } from "@/domain/billing/validate-entry";
import type { CompanionAction, CompanionStage } from "@/domain/companion/run";
import type { EventEnvelope } from "./events";
import type { RequestActor } from "./request-actor";

export async function readCompanionRun(tenantId: string, matterId: string) {
  const db = getPreviewDb();
  const [run] = await db.select().from(companionRuns).where(and(eq(companionRuns.tenantId, tenantId), eq(companionRuns.matterId, matterId))).limit(1);
  if (!run) return null;
  const [draft] = await db.select({ id: workProductDrafts.id, title: workProductDrafts.title, status: workProductDrafts.status, providerMode: workProductDrafts.providerMode })
    .from(workProductDrafts).where(and(eq(workProductDrafts.tenantId, tenantId), eq(workProductDrafts.runId, run.id))).limit(1);
  const [handoff] = await db.select({ provider: integrationHandoffs.provider, status: integrationHandoffs.status, providerMode: integrationHandoffs.providerMode, activationRequirement: integrationHandoffs.activationRequirement })
    .from(integrationHandoffs).where(and(eq(integrationHandoffs.tenantId, tenantId), eq(integrationHandoffs.runId, run.id))).limit(1);
  const [time] = await db.select({ id: candidateTimeEntries.id, minutes: candidateTimeEntries.minutes, narrative: candidateTimeEntries.narrative, taskCode: candidateTimeEntries.taskCode, activityCode: candidateTimeEntries.activityCode, status: candidateTimeEntries.status })
    .from(candidateTimeEntries).where(and(eq(candidateTimeEntries.tenantId, tenantId), eq(candidateTimeEntries.runId, run.id))).limit(1);
  const [billing] = await db.select({ outcome: billingValidations.outcome, ruleCode: billingValidations.ruleCode, ruleVersion: billingValidations.ruleVersion, explanation: billingValidations.explanation })
    .from(billingValidations).where(and(eq(billingValidations.tenantId, tenantId), eq(billingValidations.runId, run.id))).limit(1);
  const [exportJob] = await db.select({ id: exportJobs.id, status: exportJobs.status, sha256: exportJobs.sha256, byteSize: exportJobs.byteSize, format: exportJobs.format, completeness: exportJobs.completeness, missingItems: exportJobs.missingItems })
    .from(exportJobs).where(and(eq(exportJobs.tenantId, tenantId), eq(exportJobs.runId, run.id))).limit(1);
  return { ...run, draft: draft ?? null, handoff: handoff ?? null, time: time ?? null, billing: billing ?? null, exportJob: exportJob ?? null };
}

export async function persistCompanionTransition(input: {
  action: CompanionAction;
  currentStage: CompanionStage;
  nextStage: Exclude<CompanionStage, "not_started">;
  actor: RequestActor;
  event: EventEnvelope<Record<string, unknown>>;
}) {
  const db = getPreviewDb();
  const now = new Date(input.event.occurredAt);
  const eventQuery = db.insert(previewEvents).values(eventValues(input.event)).onConflictDoNothing();
  const outboxQuery = db.insert(previewOutbox).values({ id: createId(), tenantId: input.event.tenantId, eventId: input.event.eventId, topic: `athena.${input.action}`, payload: input.event, attempts: 0, availableAt: now }).onConflictDoNothing();
  const auditQuery = db.insert(auditRecords).values({
    id: createId(), tenantId: input.event.tenantId, actorId: input.actor.userId, actorEmail: input.actor.email,
    action: input.action, resourceType: "companion_workflow", resourceId: input.event.aggregateId,
    outcome: "success", reason: auditReason(input.action), requestId: input.event.idempotencyKey, createdAt: now,
  }).onConflictDoNothing();

  if (input.action === "import_matter") {
    await db.batch([
      db.insert(companionRuns).values({ id: input.event.aggregateId, tenantId: input.event.tenantId, matterId: input.event.matterId!, stage: input.nextStage, version: 1, sourceSystem: companionFixture.matter.sourceSystem, providerMode: "deterministic_sandbox", lastEventId: input.event.eventId, actorId: input.actor.userId, actorEmail: input.actor.email, createdAt: now, updatedAt: now }),
      eventQuery, outboxQuery, auditQuery,
    ]);
    return;
  }

  const runUpdate = db.update(companionRuns).set({
    stage: input.nextStage, version: currentVersion(input.currentStage) + 1, lastEventId: input.event.eventId,
    actorId: input.actor.userId, actorEmail: input.actor.email, updatedAt: now,
    ...runPatch(input.action),
  }).where(and(eq(companionRuns.id, input.event.aggregateId), eq(companionRuns.tenantId, input.event.tenantId), eq(companionRuns.stage, input.currentStage as Exclude<CompanionStage, "not_started">)));

  if (input.action === "create_verbatim_draft") {
    await db.batch([runUpdate, db.insert(workProductDrafts).values({
      id: companionFixture.workProduct.id, tenantId: input.event.tenantId, matterId: input.event.matterId!, runId: input.event.aggregateId,
      workProductType: companionFixture.workProduct.type, title: companionFixture.workProduct.title, body: companionFixture.workProduct.body,
      sourceDocumentId: companionFixture.document.id, sourceFactIds: companionFixture.facts.map((fact) => fact.id), status: "draft",
      providerMode: "deterministic_sandbox", createdAt: now,
    }).onConflictDoNothing(), eventQuery, outboxQuery, auditQuery]);
    return;
  }

  if (input.action === "approve_report") {
    await db.batch([runUpdate, db.update(workProductDrafts).set({ status: "approved", approvedBy: input.actor.userId, approvedAt: now }).where(and(eq(workProductDrafts.tenantId, input.event.tenantId), eq(workProductDrafts.runId, input.event.aggregateId))), eventQuery, outboxQuery, auditQuery]);
    return;
  }

  if (input.action === "queue_email") {
    await db.batch([runUpdate, db.insert(integrationHandoffs).values({
      id: createId(), tenantId: input.event.tenantId, matterId: input.event.matterId!, runId: input.event.aggregateId,
      provider: "microsoft_365", operation: "send_client_report", status: "blocked_not_connected", providerMode: "disabled_external_provider",
      retryable: true, activationRequirement: "Microsoft app registration, tenant consent, least-privileged scopes, mailbox authorization, and delivery reconciliation are required.", createdAt: now,
    }), eventQuery, outboxQuery, auditQuery]);
    return;
  }

  if (input.action === "confirm_time") {
    const timeId = companionFixture.time.id;
    const validation = validateBillingEntry(companionFixture.time, summitSyntheticBillingProfile);
    await db.batch([runUpdate, db.insert(candidateTimeEntries).values({
      id: timeId, tenantId: input.event.tenantId, matterId: input.event.matterId!, runId: input.event.aggregateId,
      minutes: companionFixture.time.minutes, narrative: companionFixture.time.narrative, taskCode: companionFixture.time.taskCode,
      activityCode: companionFixture.time.activityCode, status: "confirmed", confirmedBy: input.actor.userId, confirmedAt: now,
    }).onConflictDoNothing(), db.insert(billingValidations).values({
      id: createId(), tenantId: input.event.tenantId, matterId: input.event.matterId!, runId: input.event.aggregateId,
      candidateTimeId: timeId, ruleCode: validation.ruleCode, ruleVersion: validation.ruleVersion, outcome: validation.outcome,
      explanation: validation.explanation, createdAt: now,
    }), eventQuery, outboxQuery, auditQuery]);
    return;
  }

  if (input.action === "create_export") {
    const artifact = await buildExportArtifact(input, now);
    try {
      await db.batch([
        runUpdate,
        db.update(companionRuns).set({ exportJobId: artifact.exportId }).where(and(eq(companionRuns.id, input.event.aggregateId), eq(companionRuns.tenantId, input.event.tenantId))),
        db.insert(exportJobs).values({ id: artifact.exportId, tenantId: input.event.tenantId, matterId: input.event.matterId!, runId: input.event.aggregateId, status: "ready", objectKey: artifact.objectKey, sha256: artifact.sha256, byteSize: artifact.byteSize, format: "application/json", manifestVersion: 2, completeness: artifact.completeness, missingItems: artifact.missingItems, createdBy: input.actor.userId, createdAt: now }),
        eventQuery, outboxQuery, auditQuery,
      ]);
    } catch (error) {
      await getDocumentBucket().delete(artifact.objectKey);
      throw error;
    }
    return;
  }

  await db.batch([runUpdate, eventQuery, outboxQuery, auditQuery]);
}

export async function getExportForActor(tenantId: string, exportId: string) {
  const db = getPreviewDb();
  const [job] = await db.select().from(exportJobs).where(and(eq(exportJobs.id, exportId), eq(exportJobs.tenantId, tenantId))).limit(1);
  if (!job || job.status !== "ready") return null;
  const object = await getDocumentBucket().get(job.objectKey);
  return object ? { job, object } : null;
}

async function buildExportArtifact(input: Parameters<typeof persistCompanionTransition>[0], now: Date) {
  const db = getPreviewDb();
  const events = await db.select({ eventId: previewEvents.eventId, eventType: previewEvents.eventType, occurredAt: previewEvents.occurredAt, actorId: previewEvents.actorId, payload: previewEvents.payload })
    .from(previewEvents).where(and(eq(previewEvents.tenantId, input.event.tenantId), eq(previewEvents.matterId, input.event.matterId!))).orderBy(asc(previewEvents.occurredAt));
  const audits = await db.select({ id: auditRecords.id, action: auditRecords.action, actorId: auditRecords.actorId, outcome: auditRecords.outcome, reason: auditRecords.reason, createdAt: auditRecords.createdAt })
    .from(auditRecords).where(and(eq(auditRecords.tenantId, input.event.tenantId), eq(auditRecords.resourceId, input.event.aggregateId))).orderBy(asc(auditRecords.createdAt));
  const documents = await db.select({ id: documentIntakes.id, title: documentIntakes.title, objectKey: documentIntakes.objectKey, sha256: documentIntakes.sha256, byteSize: documentIntakes.byteSize, mimeType: documentIntakes.mimeType, status: documentIntakes.status, createdAt: documentIntakes.createdAt })
    .from(documentIntakes).where(and(eq(documentIntakes.tenantId, input.event.tenantId), eq(documentIntakes.matterId, input.event.matterId!))).orderBy(asc(documentIntakes.createdAt));
  const holds = await db.select({ id: legalHolds.id, name: legalHolds.name, reason: legalHolds.reason, status: legalHolds.status, placedBy: legalHolds.placedBy, placedAt: legalHolds.placedAt, releasedAt: legalHolds.releasedAt })
    .from(legalHolds).where(and(eq(legalHolds.tenantId, input.event.tenantId), eq(legalHolds.matterId, input.event.matterId!))).orderBy(asc(legalHolds.placedAt));
  const eventIds = new Set(events.map((event) => event.eventId));
  const receipts = (await db.select({ id: outboxDeliveries.id, eventId: outboxDeliveries.eventId, destination: outboxDeliveries.destination, outcome: outboxDeliveries.outcome, attempt: outboxDeliveries.attempt, detail: outboxDeliveries.detail, createdAt: outboxDeliveries.createdAt })
    .from(outboxDeliveries).where(eq(outboxDeliveries.tenantId, input.event.tenantId)).orderBy(asc(outboxDeliveries.createdAt))).filter((receipt) => eventIds.has(receipt.eventId));
  const exportId = createId();
  const manifest = buildCompanionExport({ tenantId: input.event.tenantId, matterId: input.event.matterId!, generatedAt: now, generatedBy: input.actor.userId, events: [...events, { eventId: input.event.eventId, eventType: input.event.eventType, occurredAt: now, actorId: input.actor.userId, payload: input.event.payload }], inventory: { auditRecords: audits, deliveryReceipts: receipts, documentMetadata: documents, legalHolds: holds, originalDocumentBytesIncluded: 0 } });
  const bytes = new TextEncoder().encode(JSON.stringify(manifest, null, 2));
  const sha256 = await digestHex(bytes);
  const objectKey = `${input.event.tenantId}/exports/${input.event.matterId}/${exportId}/manifest.json`;
  const bucket = getDocumentBucket();
  await bucket.put(objectKey, bytes, { httpMetadata: { contentType: "application/json" }, customMetadata: { tenantId: input.event.tenantId, matterId: input.event.matterId!, exportId, sha256, classification: "synthetic-pilot-export" } });
  return { exportId, objectKey, sha256, byteSize: bytes.byteLength, completeness: manifest.completeness, missingItems: manifest.missingItems };
}

function eventValues(event: EventEnvelope<Record<string, unknown>>) {
  return { eventId: event.eventId, eventType: event.eventType, eventVersion: event.eventVersion, tenantId: event.tenantId, aggregateType: event.aggregateType, aggregateId: event.aggregateId, matterId: event.matterId, actorId: event.actorId, occurredAt: new Date(event.occurredAt), correlationId: event.correlationId, causationId: event.causationId, idempotencyKey: event.idempotencyKey, source: event.source, visibility: event.visibility, retentionPolicy: event.retentionPolicy, payload: event.payload };
}

function runPatch(action: CompanionAction) {
  if (action === "process_qme") return { documentTitle: companionFixture.document.title };
  if (action === "create_verbatim_draft") return { reportTitle: companionFixture.workProduct.title };
  if (action === "queue_email") return { deliveryStatus: "blocked_not_connected" };
  if (action === "confirm_time") return { candidateTimeMinutes: companionFixture.time.minutes, billingStatus: "pass" };
  return {};
}

function currentVersion(stage: CompanionStage) { return Math.max(0, ["not_started", "matter_imported", "analysis_ready", "draft_ready", "report_approved", "delivery_handoff_blocked", "time_confirmed", "export_ready"].indexOf(stage)); }
function auditReason(action: CompanionAction) { return `Authenticated ${action.replaceAll("_", " ")} command accepted for the synthetic companion pilot.`; }
async function digestHex(bytes: Uint8Array) { const digest = await crypto.subtle.digest("SHA-256", bytes.buffer as ArrayBuffer); return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join(""); }
