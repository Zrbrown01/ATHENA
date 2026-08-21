import { createId } from "@paralleldrive/cuid2";
import { and, asc, eq } from "drizzle-orm";
import { getPreviewDb } from "../../db";
import { previewEvents, previewOutbox, reportDecisions, reportDefinitions, reportDeliveries, reportInstances, reportSections, reportValidations } from "../../db/schema";
import { validateReport, type ReportCommand, type ReportDefinitionState, type ReportState } from "@/domain/reports/lifecycle";
import type { EventEnvelope } from "./events";
import type { RequestActor } from "./request-actor";

export async function readReportDefinition(tenantId: string, definitionId: string) {
  const [row] = await getPreviewDb().select().from(reportDefinitions).where(and(eq(reportDefinitions.tenantId, tenantId), eq(reportDefinitions.id, definitionId))).limit(1);
  return row ?? null;
}
export async function readReportInstance(tenantId: string, matterId: string, reportInstanceId: string) {
  const db = getPreviewDb();
  const [report] = await db.select().from(reportInstances).where(and(eq(reportInstances.tenantId, tenantId), eq(reportInstances.matterId, matterId), eq(reportInstances.id, reportInstanceId))).limit(1);
  if (!report) return null;
  const sections = await db.select().from(reportSections).where(and(eq(reportSections.tenantId, tenantId), eq(reportSections.matterId, matterId), eq(reportSections.reportInstanceId, reportInstanceId))).orderBy(asc(reportSections.position));
  return { ...report, sections } as typeof report & ReportState;
}
export async function readReportingEvent(tenantId: string, idempotencyKey: string) {
  const [row] = await getPreviewDb().select({ eventId: previewEvents.eventId }).from(previewEvents).where(and(eq(previewEvents.tenantId, tenantId), eq(previewEvents.idempotencyKey, idempotencyKey))).limit(1);
  return row ?? null;
}
export async function buildReportValidation(tenantId: string, matterId: string, reportInstanceId: string) {
  const report = await readReportInstance(tenantId, matterId, reportInstanceId);
  if (!report) throw new Error("Report instance does not exist");
  const definition = await readReportDefinition(tenantId, report.definitionId);
  if (!definition) throw new Error("Report definition does not exist");
  return { definition, validation: validateReport(definition as ReportDefinitionState, report as ReportState) };
}
export async function reportingProjection(tenantId: string, matterId: string) {
  const db = getPreviewDb();
  const [instances, sections, validations, deliveries, decisions] = await Promise.all([
    db.select().from(reportInstances).where(and(eq(reportInstances.tenantId, tenantId), eq(reportInstances.matterId, matterId))).orderBy(asc(reportInstances.dueAt)),
    db.select().from(reportSections).where(and(eq(reportSections.tenantId, tenantId), eq(reportSections.matterId, matterId))).orderBy(asc(reportSections.position)),
    db.select().from(reportValidations).where(and(eq(reportValidations.tenantId, tenantId), eq(reportValidations.matterId, matterId))).orderBy(asc(reportValidations.createdAt)),
    db.select().from(reportDeliveries).where(and(eq(reportDeliveries.tenantId, tenantId), eq(reportDeliveries.matterId, matterId))).orderBy(asc(reportDeliveries.createdAt)),
    db.select().from(reportDecisions).where(and(eq(reportDecisions.tenantId, tenantId), eq(reportDecisions.matterId, matterId))).orderBy(asc(reportDecisions.createdAt)),
  ]);
  const definitionIds = new Set(instances.map((instance) => instance.definitionId));
  const definitions = (await db.select().from(reportDefinitions).where(eq(reportDefinitions.tenantId, tenantId))).filter((definition) => definitionIds.has(definition.id));
  return { definitions, instances, sections, validations, deliveries, decisions };
}

export async function persistReport(input: { command: ReportCommand; fromStatus: string; toStatus: string; event: EventEnvelope<Record<string, unknown>>; actor: RequestActor; validation?: ReturnType<typeof validateReport>; definition?: ReportDefinitionState }) {
  const db = getPreviewDb(), c = input.command, now = new Date(input.event.occurredAt);
  const eventWrite = db.insert(previewEvents).values(eventValues(input.event));
  const outboxWrite = db.insert(previewOutbox).values({ id: createId(), tenantId: c.tenantId, eventId: input.event.eventId, topic: "athena.reporting", payload: input.event, attempts: 0, availableAt: now });
  const decisionWrite = db.insert(reportDecisions).values({ id: createId(), tenantId: c.tenantId, matterId: c.matterId, reportInstanceId: c.reportInstanceId, action: c.action, fromStatus: input.fromStatus, toStatus: input.toStatus, reason: "reason" in c ? c.reason : c.action === "materialize_fixture_report" ? "Acknowledged source-linked deterministic report fixture." : "Governed validation completed against the versioned report definition.", actorId: input.actor.userId, eventId: input.event.eventId, idempotencyKey: c.idempotencyKey, createdAt: now });
  if (c.action === "materialize_fixture_report") {
    const requiredSections = ["matter_identity", "current_posture", "medical_status", "authority", "upcoming_events", "legal_spend"];
    const sectionHashes = await Promise.all(c.sections.map((section) => sha256(section.body)));
    await db.batch([
      db.insert(reportDefinitions).values({ id: c.definitionId, tenantId: c.tenantId, clientName: "Summit Claims Services", code: c.definitionCode, version: 1, title: "Summit 90-day status report", reportType: "status", requiredSections, cadence: "P90D", scheduleMode: "local_intent", contentStatus: "synthetic_sandbox", effectiveAt: new Date("2026-08-20T00:00:00.000Z"), reviewBy: new Date("2026-09-30T00:00:00.000Z"), createdBy: input.actor.userId, createdAt: now }).onConflictDoNothing({ target: reportDefinitions.id }),
      db.insert(reportInstances).values({ id: c.reportInstanceId, tenantId: c.tenantId, matterId: c.matterId, definitionId: c.definitionId, definitionCode: c.definitionCode, definitionVersion: 1, title: c.title, status: "draft", dueAt: new Date(c.dueAt), recipientAddresses: c.recipientAddresses, sourceCoverageCount: c.sections.reduce((count, section) => count + section.sourceRecordIds.length, 0), unresolvedConflictCount: 0, scheduleMode: "local_intent", providerMode: "deterministic_sandbox", revision: 1, createdBy: input.actor.userId, createdAt: now, updatedAt: now }),
      ...c.sections.map((section, index) => db.insert(reportSections).values({ id: section.id, tenantId: c.tenantId, matterId: c.matterId, reportInstanceId: c.reportInstanceId, sectionCode: section.sectionCode, title: section.title, position: index + 1, body: section.body, bodySha256: sectionHashes[index], sourceRecordIds: section.sourceRecordIds, providerMode: "deterministic_sandbox", createdAt: now })),
      decisionWrite, eventWrite, outboxWrite,
    ]);
  } else {
    const report = await readReportInstance(c.tenantId, c.matterId, c.reportInstanceId);
    if (!report) throw new Error("Report instance does not exist");
    if (c.action === "validate_report") {
      if (!input.validation) throw new Error("Report validation snapshot is required");
      await db.batch([
        db.insert(reportValidations).values({ id: createId(), tenantId: c.tenantId, matterId: c.matterId, reportInstanceId: c.reportInstanceId, revision: c.expectedRevision, outcome: input.validation.outcome, checks: input.validation.checks, sourceCoverageCount: input.validation.sourceCoverageCount, createdBy: input.actor.userId, createdAt: now }),
        db.update(reportInstances).set({ status: "validated", sourceCoverageCount: input.validation.sourceCoverageCount, revision: report.revision + 1, updatedAt: now }).where(and(eq(reportInstances.tenantId, c.tenantId), eq(reportInstances.matterId, c.matterId), eq(reportInstances.id, c.reportInstanceId), eq(reportInstances.revision, c.expectedRevision))),
        decisionWrite, eventWrite, outboxWrite,
      ]);
    } else if (c.action === "approve_report") {
      await db.batch([db.update(reportInstances).set({ status: "approved", providerMode: "human_authored", approvedBy: input.actor.userId, approvedAt: now, revision: report.revision + 1, updatedAt: now }).where(and(eq(reportInstances.tenantId, c.tenantId), eq(reportInstances.matterId, c.matterId), eq(reportInstances.id, c.reportInstanceId), eq(reportInstances.revision, c.expectedRevision))), decisionWrite, eventWrite, outboxWrite]);
    } else {
      await db.batch([
        db.insert(reportDeliveries).values({ id: c.deliveryId, tenantId: c.tenantId, matterId: c.matterId, reportInstanceId: c.reportInstanceId, provider: "microsoft_365", status: "blocked_not_connected", providerMode: "not_connected", providerDeliveryAttempted: false, recipientAddresses: report.recipientAddresses, reason: c.reason, providerMessageId: null, createdBy: input.actor.userId, createdAt: now }),
        db.update(reportInstances).set({ status: "delivery_blocked", providerMode: "not_connected", revision: report.revision + 1, updatedAt: now }).where(and(eq(reportInstances.tenantId, c.tenantId), eq(reportInstances.matterId, c.matterId), eq(reportInstances.id, c.reportInstanceId), eq(reportInstances.revision, c.expectedRevision))),
        decisionWrite, eventWrite, outboxWrite,
      ]);
    }
  }
  return { replayed: false, eventId: input.event.eventId };
}
function eventValues(event: EventEnvelope<Record<string, unknown>>) { return { eventId: event.eventId, eventType: event.eventType, eventVersion: event.eventVersion, tenantId: event.tenantId, aggregateType: event.aggregateType, aggregateId: event.aggregateId, matterId: event.matterId, actorId: event.actorId, occurredAt: new Date(event.occurredAt), correlationId: event.correlationId, causationId: event.causationId, idempotencyKey: event.idempotencyKey, source: event.source, visibility: event.visibility, retentionPolicy: event.retentionPolicy, payload: event.payload }; }
async function sha256(value: string) { const bytes = new TextEncoder().encode(value), copy = new Uint8Array(bytes.byteLength); copy.set(bytes); const hash = await crypto.subtle.digest("SHA-256", copy.buffer); return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, "0")).join(""); }
