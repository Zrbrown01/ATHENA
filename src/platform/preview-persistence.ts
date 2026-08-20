import { createId } from "@paralleldrive/cuid2";
import { getPreviewDb } from "../../db";
import { documentIntakes, factReviews, previewEvents, previewOutbox, workflowDecisions } from "../../db/schema";
import type { EventEnvelope } from "./events";
import type { RequestActor } from "./request-actor";

export async function persistFactReview(
  event: EventEnvelope<Record<string, unknown>>,
  actor: RequestActor,
  command: { factId: string; decision: "verified" | "rejected"; editedValue?: string; reason?: string },
) {
  const db = getPreviewDb();
  const now = new Date(event.occurredAt);
  await db.batch([
    db.insert(factReviews).values({
      id: createId(), tenantId: event.tenantId, matterId: event.matterId!, factId: command.factId,
      decision: command.decision, editedValue: command.editedValue, reason: command.reason,
      actorId: actor.userId, actorEmail: actor.email, eventId: event.eventId,
      idempotencyKey: event.idempotencyKey, createdAt: now,
    }).onConflictDoNothing(),
    db.insert(previewEvents).values({
      eventId: event.eventId, eventType: event.eventType, eventVersion: event.eventVersion,
      tenantId: event.tenantId, aggregateType: event.aggregateType, aggregateId: event.aggregateId,
      matterId: event.matterId, actorId: actor.userId, occurredAt: now,
      correlationId: event.correlationId, idempotencyKey: event.idempotencyKey,
      visibility: event.visibility, payload: event.payload,
    }).onConflictDoNothing(),
    db.insert(previewOutbox).values({
      id: createId(), tenantId: event.tenantId, eventId: event.eventId,
      topic: "athena.facts", payload: event, attempts: 0, availableAt: now,
    }).onConflictDoNothing(),
  ]);
}

export async function persistDocumentIntake(input: {
  id: string; tenantId: string; matterId?: string; title: string; objectKey: string;
  sha256: string; byteSize: number; mimeType: string; classification: string;
  actor: RequestActor; event: EventEnvelope<Record<string, unknown>>;
}) {
  const db = getPreviewDb();
  const now = new Date(input.event.occurredAt);
  await db.batch([
    db.insert(documentIntakes).values({
      id: input.id, tenantId: input.tenantId, matterId: input.matterId, title: input.title,
      objectKey: input.objectKey, sha256: input.sha256, byteSize: input.byteSize,
      mimeType: input.mimeType, classification: input.classification,
      status: "awaiting_scan", actorId: input.actor.userId, actorEmail: input.actor.email,
      createdAt: now,
    }),
    db.insert(previewEvents).values({
      eventId: input.event.eventId, eventType: input.event.eventType,
      eventVersion: input.event.eventVersion, tenantId: input.event.tenantId,
      aggregateType: input.event.aggregateType, aggregateId: input.event.aggregateId,
      matterId: input.event.matterId, actorId: input.actor.userId, occurredAt: now,
      correlationId: input.event.correlationId, idempotencyKey: input.event.idempotencyKey,
      visibility: input.event.visibility, payload: input.event.payload,
    }),
    db.insert(previewOutbox).values({
      id: createId(), tenantId: input.tenantId, eventId: input.event.eventId,
      topic: "athena.documents", payload: input.event, attempts: 0, availableAt: now,
    }),
  ]);
}

export async function persistWorkflowDecision(input: {
  workflowType: string; aggregateId: string; action: string; reason?: string;
  actor: RequestActor; event: EventEnvelope<Record<string, unknown>>;
}) {
  const db = getPreviewDb();
  const now = new Date(input.event.occurredAt);
  await db.batch([
    db.insert(workflowDecisions).values({
      id: createId(), tenantId: input.event.tenantId, workflowType: input.workflowType,
      aggregateId: input.aggregateId, action: input.action, reason: input.reason,
      actorId: input.actor.userId, actorEmail: input.actor.email,
      eventId: input.event.eventId, idempotencyKey: input.event.idempotencyKey, createdAt: now,
    }).onConflictDoNothing(),
    db.insert(previewEvents).values({
      eventId: input.event.eventId, eventType: input.event.eventType,
      eventVersion: input.event.eventVersion, tenantId: input.event.tenantId,
      aggregateType: input.event.aggregateType, aggregateId: input.event.aggregateId,
      matterId: input.event.matterId, actorId: input.actor.userId, occurredAt: now,
      correlationId: input.event.correlationId, idempotencyKey: input.event.idempotencyKey,
      visibility: input.event.visibility, payload: input.event.payload,
    }).onConflictDoNothing(),
    db.insert(previewOutbox).values({
      id: createId(), tenantId: input.event.tenantId, eventId: input.event.eventId,
      topic: `athena.${input.workflowType}`, payload: input.event, attempts: 0, availableAt: now,
    }).onConflictDoNothing(),
  ]);
}
