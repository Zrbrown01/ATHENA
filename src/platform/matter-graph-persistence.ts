import { createId } from "@paralleldrive/cuid2";
import { and, asc, eq } from "drizzle-orm";
import { getPreviewDb } from "../../db";
import { adjudicationCases, claims, injuries, matterRelationships, matters, previewEvents, previewOutbox, sourceRecordLinks } from "../../db/schema";
import type { MatterGraphCommand } from "@/domain/matter-graph";
import type { EventEnvelope } from "./events";
import type { RequestActor } from "./request-actor";

export async function readMatterGraph(tenantId: string, matterId: string) {
  const db = getPreviewDb();
  const [matter] = await db.select().from(matters).where(and(eq(matters.tenantId, tenantId), eq(matters.id, matterId))).limit(1);
  if (!matter) return null;
  const [claimRows, injuryRows, adjudicationRows, relationshipRows, sourceRows] = await Promise.all([
    db.select().from(claims).where(and(eq(claims.tenantId, tenantId), eq(claims.matterId, matterId))).orderBy(asc(claims.claimNumber)),
    db.select().from(injuries).where(and(eq(injuries.tenantId, tenantId), eq(injuries.matterId, matterId))).orderBy(asc(injuries.dateFrom)),
    db.select().from(adjudicationCases).where(and(eq(adjudicationCases.tenantId, tenantId), eq(adjudicationCases.matterId, matterId))).orderBy(asc(adjudicationCases.adjNumber)),
    db.select().from(matterRelationships).where(and(eq(matterRelationships.tenantId, tenantId), eq(matterRelationships.matterId, matterId))).orderBy(asc(matterRelationships.id)),
    db.select().from(sourceRecordLinks).where(and(eq(sourceRecordLinks.tenantId, tenantId), eq(sourceRecordLinks.matterId, matterId))).orderBy(asc(sourceRecordLinks.id)),
  ]);
  return { matter, claims: claimRows, injuries: injuryRows, adjudicationCases: adjudicationRows, relationships: relationshipRows, sourceLinks: sourceRows };
}

export async function persistMatterGraph(input: { command: MatterGraphCommand; event: EventEnvelope<Record<string, unknown>>; actor: RequestActor }) {
  const db = getPreviewDb();
  const [prior] = await db.select({ eventId: previewEvents.eventId }).from(previewEvents).where(and(eq(previewEvents.tenantId, input.event.tenantId), eq(previewEvents.idempotencyKey, input.event.idempotencyKey))).limit(1);
  if (prior) return { replayed: true, eventId: prior.eventId };
  const now = new Date(input.event.occurredAt), { command } = input, { graph } = command;
  const eventWrite = db.insert(previewEvents).values({ eventId: input.event.eventId, eventType: input.event.eventType, eventVersion: input.event.eventVersion, tenantId: input.event.tenantId, aggregateType: input.event.aggregateType, aggregateId: input.event.aggregateId, matterId: input.event.matterId, actorId: input.actor.userId, occurredAt: now, correlationId: input.event.correlationId, causationId: input.event.causationId, idempotencyKey: input.event.idempotencyKey, source: input.event.source, visibility: input.event.visibility, retentionPolicy: input.event.retentionPolicy, payload: input.event.payload });
  const outboxWrite = db.insert(previewOutbox).values({ id: createId(), tenantId: command.tenantId, eventId: input.event.eventId, topic: "athena.matter_graph", payload: input.event, attempts: 0, availableAt: now });
  const writes = [
    db.insert(matters).values({ ...graph.matter, tenantId: command.tenantId, revision: 1, createdAt: now, updatedAt: now }).onConflictDoUpdate({ target: matters.id, set: { matterNumber: graph.matter.matterNumber, caption: graph.matter.caption, status: graph.matter.status, clientName: graph.matter.clientName, employerName: graph.matter.employerName, applicantName: graph.matter.applicantName, assignedAttorneyId: graph.matter.assignedAttorneyId, updatedAt: now } }),
    ...graph.claims.map((claim) => db.insert(claims).values({ ...claim, tenantId: command.tenantId, matterId: command.matterId, createdAt: now, updatedAt: now }).onConflictDoUpdate({ target: claims.id, set: { claimNumber: claim.claimNumber, carrierName: claim.carrierName, administratorName: claim.administratorName, updatedAt: now } })),
    ...graph.injuries.map((injury) => db.insert(injuries).values({ ...injury, tenantId: command.tenantId, matterId: command.matterId, dateFrom: asDate(injury.dateFrom), dateTo: injury.dateTo ? asDate(injury.dateTo) : undefined, createdAt: now, updatedAt: now }).onConflictDoUpdate({ target: injuries.id, set: { claimId: injury.claimId, injuryType: injury.injuryType, dateFrom: asDate(injury.dateFrom), dateTo: injury.dateTo ? asDate(injury.dateTo) : null, bodyParts: injury.bodyParts, updatedAt: now } })),
    ...graph.adjudicationCases.map((item) => db.insert(adjudicationCases).values({ ...item, tenantId: command.tenantId, matterId: command.matterId, createdAt: now, updatedAt: now }).onConflictDoUpdate({ target: adjudicationCases.id, set: { adjNumber: item.adjNumber, venue: item.venue, districtOffice: item.districtOffice, status: item.status, updatedAt: now } })),
    ...graph.sourceLinks.map((link) => db.insert(sourceRecordLinks).values({ ...link, tenantId: command.tenantId, matterId: command.matterId, importedAt: now }).onConflictDoUpdate({ target: sourceRecordLinks.id, set: { entityType: link.entityType, entityId: link.entityId, sourceSystem: link.sourceSystem, sourceRecordId: link.sourceRecordId, providerMode: link.providerMode, importedAt: now } })),
    ...graph.relationships.map((relationship) => db.insert(matterRelationships).values({ ...relationship, tenantId: command.tenantId, matterId: command.matterId, createdAt: now }).onConflictDoNothing({ target: matterRelationships.id })),
    eventWrite,
    outboxWrite,
  ];
  await db.batch(writes as [typeof writes[number], ...typeof writes[number][]]);
  return { replayed: false, eventId: input.event.eventId };
}

function asDate(value: string) { return new Date(`${value}T12:00:00.000Z`); }
