import { createId } from "@paralleldrive/cuid2";
import { and, asc, eq } from "drizzle-orm";
import { getPreviewDb } from "../../db";
import { optimisticWriteClaims, previewEvents, previewOutbox, reportDefinitions, reportInstances, reportRecurrenceDecisions, reportRecurrenceExceptions, reportRecurrenceOccurrences, reportRecurrenceSeries, reportSections } from "../../db/schema";
import type { PlannedReportOccurrence, ReportRecurrenceCommand } from "@/domain/reports/recurrence";
import type { EventEnvelope } from "./events";
import { rethrowOptimisticClaimConflict } from "./optimistic-concurrency";
import type { RequestActor } from "./request-actor";

export async function reportRecurrenceProjection(tenantId: string, matterId: string) {
  const db = getPreviewDb();
  const [series, exceptions, occurrences, decisions] = await Promise.all([
    db.select().from(reportRecurrenceSeries).where(and(eq(reportRecurrenceSeries.tenantId, tenantId), eq(reportRecurrenceSeries.matterId, matterId))).orderBy(asc(reportRecurrenceSeries.createdAt)),
    db.select().from(reportRecurrenceExceptions).where(and(eq(reportRecurrenceExceptions.tenantId, tenantId), eq(reportRecurrenceExceptions.matterId, matterId))).orderBy(asc(reportRecurrenceExceptions.nominalDueOn)),
    db.select().from(reportRecurrenceOccurrences).where(and(eq(reportRecurrenceOccurrences.tenantId, tenantId), eq(reportRecurrenceOccurrences.matterId, matterId))).orderBy(asc(reportRecurrenceOccurrences.sequence)),
    db.select().from(reportRecurrenceDecisions).where(and(eq(reportRecurrenceDecisions.tenantId, tenantId), eq(reportRecurrenceDecisions.matterId, matterId))).orderBy(asc(reportRecurrenceDecisions.createdAt)),
  ]);
  return { series, exceptions, occurrences, decisions };
}
export async function readReportRecurrenceSeries(tenantId: string, matterId: string, seriesId: string) { const [row] = await getPreviewDb().select().from(reportRecurrenceSeries).where(and(eq(reportRecurrenceSeries.tenantId, tenantId), eq(reportRecurrenceSeries.matterId, matterId), eq(reportRecurrenceSeries.id, seriesId))).limit(1); return row ?? null; }
export async function listReportRecurrenceExceptions(tenantId: string, matterId: string, seriesId: string) { return getPreviewDb().select().from(reportRecurrenceExceptions).where(and(eq(reportRecurrenceExceptions.tenantId, tenantId), eq(reportRecurrenceExceptions.matterId, matterId), eq(reportRecurrenceExceptions.seriesId, seriesId))).orderBy(asc(reportRecurrenceExceptions.nominalDueOn)); }
export async function readReportRecurrenceDefinitionStatus(tenantId: string, definitionId: string) { const [row] = await getPreviewDb().select({ contentStatus: reportDefinitions.contentStatus }).from(reportDefinitions).where(and(eq(reportDefinitions.tenantId, tenantId), eq(reportDefinitions.id, definitionId))).limit(1); return row?.contentStatus ?? null; }
export async function readReportRecurrenceEvent(tenantId: string, idempotencyKey: string) { const [row] = await getPreviewDb().select({ eventId: previewEvents.eventId }).from(previewEvents).where(and(eq(previewEvents.tenantId, tenantId), eq(previewEvents.idempotencyKey, idempotencyKey))).limit(1); return row ?? null; }

export async function persistReportRecurrence(input: { command: ReportRecurrenceCommand; fromStatus: string; toStatus: string; occurrences: PlannedReportOccurrence[]; event: EventEnvelope<Record<string, unknown>>; actor: RequestActor }) {
  const db = getPreviewDb(), c = input.command, now = new Date(input.event.occurredAt);
  const prior = await readReportRecurrenceEvent(c.tenantId, c.idempotencyKey); if (prior) return { replayed: true, eventId: prior.eventId };
  const eventWrite = db.insert(previewEvents).values({ eventId: input.event.eventId, eventType: input.event.eventType, eventVersion: input.event.eventVersion, tenantId: input.event.tenantId, aggregateType: input.event.aggregateType, aggregateId: input.event.aggregateId, matterId: input.event.matterId, actorId: input.actor.userId, occurredAt: now, correlationId: input.event.correlationId, causationId: input.event.causationId, idempotencyKey: input.event.idempotencyKey, source: input.event.source, visibility: input.event.visibility, retentionPolicy: input.event.retentionPolicy, payload: input.event.payload });
  const outboxWrite = db.insert(previewOutbox).values({ id: createId(), tenantId: c.tenantId, eventId: input.event.eventId, topic: "athena.reporting-recurrence", payload: input.event, attempts: 0, availableAt: now });
  const detail = c.action === "materialize_window" ? `${input.occurrences.length} report occurrence(s) through ${c.throughDate}` : c.action === "set_exception" ? `${c.exceptionAction} ${c.nominalDueOn}: ${c.reason}` : "approval" in c ? c.approval : "reason" in c ? c.reason : "Synthetic source-linked template acknowledged.";
  const decisionWrite = db.insert(reportRecurrenceDecisions).values({ id: createId(), tenantId: c.tenantId, matterId: c.matterId, seriesId: c.seriesId, action: c.action, fromStatus: input.fromStatus, toStatus: input.toStatus, detail, actorId: input.actor.userId, eventId: input.event.eventId, idempotencyKey: c.idempotencyKey, createdAt: now });
  if (c.action === "create_series") {
    await db.batch([
      db.insert(reportDefinitions).values({ id: c.definitionId, tenantId: c.tenantId, clientName: "Summit Claims Services", code: c.definitionCode, version: 1, title: "Summit recurring status report", reportType: "status", requiredSections: c.sectionTemplates.map(item => item.sectionCode), cadence: c.cadence === "monthly" ? `P${c.interval}M` : `P${c.interval}W`, scheduleMode: "local_intent", contentStatus: "synthetic_sandbox", effectiveAt: new Date(`${c.startsOn}T12:00:00.000Z`), reviewBy: c.endsOn ? new Date(`${c.endsOn}T12:00:00.000Z`) : new Date("2027-12-31T12:00:00.000Z"), createdBy: input.actor.userId, createdAt: now }).onConflictDoNothing({ target: reportDefinitions.id }),
      db.insert(reportRecurrenceSeries).values({ id: c.seriesId, tenantId: c.tenantId, matterId: c.matterId, definitionId: c.definitionId, titlePattern: c.titlePattern, recipientAddresses: c.recipientAddresses, sectionTemplates: c.sectionTemplates, cadence: c.cadence, interval: c.interval, dayOfMonth: c.dayOfMonth, startsOn: new Date(`${c.startsOn}T12:00:00.000Z`), endsOn: c.endsOn ? new Date(`${c.endsOn}T12:00:00.000Z`) : null, occurrenceLimit: c.occurrenceLimit, timezone: c.timezone, status: "draft", materializedCount: 0, revision: 1, createdBy: input.actor.userId, createdAt: now, updatedAt: now }), decisionWrite, eventWrite, outboxWrite,
    ] as never);
    return { replayed: false, eventId: input.event.eventId };
  }
  const current = await readReportRecurrenceSeries(c.tenantId, c.matterId, c.seriesId);
  if (!current || current.revision !== c.expectedRevision) throw new Error("Recurring report series changed; refresh before retrying");
  const claim = db.insert(optimisticWriteClaims).values({ id: createId(), tenantId: c.tenantId, aggregateType: "report_recurrence_series", aggregateId: c.seriesId, expectedRevision: c.expectedRevision, claimedRevision: c.expectedRevision + 1, actorId: input.actor.userId, eventId: input.event.eventId, idempotencyKey: c.idempotencyKey, createdAt: now });
  const patch = { status: input.toStatus as "draft" | "active" | "cancelled", revision: current.revision + 1, updatedAt: now, approvedBy: c.action === "activate_series" ? input.actor.userId : current.approvedBy, approvedAt: c.action === "activate_series" ? now : current.approvedAt, cancelledBy: c.action === "cancel_series" ? input.actor.userId : current.cancelledBy, cancelledAt: c.action === "cancel_series" ? now : current.cancelledAt, cancellationReason: c.action === "cancel_series" ? c.reason : current.cancellationReason, lastMaterializedThrough: c.action === "materialize_window" ? new Date(`${input.occurrences.at(-1)!.nominalDueOn}T12:00:00.000Z`) : current.lastMaterializedThrough, materializedCount: c.action === "materialize_window" ? current.materializedCount + input.occurrences.length : current.materializedCount };
  const writes: unknown[] = [claim, db.update(reportRecurrenceSeries).set(patch).where(and(eq(reportRecurrenceSeries.tenantId, c.tenantId), eq(reportRecurrenceSeries.id, c.seriesId), eq(reportRecurrenceSeries.revision, c.expectedRevision)))];
  if (c.action === "set_exception") writes.push(db.insert(reportRecurrenceExceptions).values({ id: `${c.seriesId}:exception:${c.nominalDueOn}`, tenantId: c.tenantId, matterId: c.matterId, seriesId: c.seriesId, nominalDueOn: new Date(`${c.nominalDueOn}T12:00:00.000Z`), action: c.exceptionAction, movedDueOn: c.movedDueOn ? new Date(`${c.movedDueOn}T12:00:00.000Z`) : null, reason: c.reason, actorId: input.actor.userId, eventId: input.event.eventId, createdAt: now }));
  if (c.action === "materialize_window") {
    const sectionHashes = await Promise.all(current.sectionTemplates.map(section => sha256(section.body)));
    for (const occurrence of input.occurrences) {
      writes.push(db.insert(reportRecurrenceOccurrences).values({ id: occurrence.id, tenantId: c.tenantId, matterId: c.matterId, seriesId: c.seriesId, reportInstanceId: occurrence.reportInstanceId, sequence: occurrence.sequence, nominalDueOn: new Date(`${occurrence.nominalDueOn}T12:00:00.000Z`), effectiveDueOn: occurrence.effectiveDueOn ? new Date(`${occurrence.effectiveDueOn}T12:00:00.000Z`) : null, status: occurrence.status, exceptionAction: occurrence.exceptionAction, eventId: input.event.eventId, createdAt: now }));
      if (!occurrence.reportInstanceId || !occurrence.effectiveDueOn) continue;
      writes.push(db.insert(reportInstances).values({ id: occurrence.reportInstanceId, tenantId: c.tenantId, matterId: c.matterId, definitionId: current.definitionId, definitionCode: "SUMMIT-RECURRING-STATUS", definitionVersion: 1, title: current.titlePattern.replace("{due_date}", occurrence.effectiveDueOn), status: "draft", dueAt: new Date(`${occurrence.effectiveDueOn}T23:59:00.000Z`), recipientAddresses: current.recipientAddresses, sourceCoverageCount: current.sectionTemplates.reduce((count, section) => count + section.sourceRecordIds.length, 0), unresolvedConflictCount: 0, scheduleMode: "local_intent", providerMode: "deterministic_sandbox", revision: 1, createdBy: input.actor.userId, createdAt: now, updatedAt: now }));
      current.sectionTemplates.forEach((section, index) => writes.push(db.insert(reportSections).values({ id: `${occurrence.reportInstanceId}:section:${section.sectionCode}`, tenantId: c.tenantId, matterId: c.matterId, reportInstanceId: occurrence.reportInstanceId!, sectionCode: section.sectionCode, title: section.title, position: index + 1, body: section.body, bodySha256: sectionHashes[index], sourceRecordIds: section.sourceRecordIds, providerMode: "deterministic_sandbox", createdAt: now })));
    }
  }
  writes.push(decisionWrite, eventWrite, outboxWrite);
  try { await db.batch(writes as never); } catch (error) { rethrowOptimisticClaimConflict(error); }
  return { replayed: false, eventId: input.event.eventId };
}
async function sha256(value: string) { const bytes = new TextEncoder().encode(value), copy = new Uint8Array(bytes.byteLength); copy.set(bytes); const hash = await crypto.subtle.digest("SHA-256", copy.buffer); return Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, "0")).join(""); }
