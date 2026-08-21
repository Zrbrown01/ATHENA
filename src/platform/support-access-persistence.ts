import { createId } from "@paralleldrive/cuid2";
import { and, count, desc, eq, gt } from "drizzle-orm";
import { getPreviewDb } from "../../db";
import { accessReviewAttestations, matterAccessPolicies, previewEvents, previewOutbox, supportAccessGrants } from "../../db/schema";
import type { SupportAccessCommand } from "@/domain/platform/support-access";
import type { EventEnvelope } from "./events";
import { authorizePersistedMatter } from "./access-policy-persistence";
import { authorizeMatterDataPlane } from "./isolation-boundary";
import { scopedSupportContext } from "./pilot-context";
import type { RequestActor } from "./request-actor";
import { readSecurityControlHealth } from "./security-control-persistence";

export async function readSupportGrant(tenantId: string, matterId: string, supportUserId: string) {
  const [row] = await getPreviewDb().select().from(supportAccessGrants).where(and(eq(supportAccessGrants.tenantId, tenantId), eq(supportAccessGrants.matterId, matterId), eq(supportAccessGrants.supportUserId, supportUserId))).limit(1);
  return row ?? null;
}
export async function listSupportGrants(tenantId: string) { return getPreviewDb().select().from(supportAccessGrants).where(eq(supportAccessGrants.tenantId, tenantId)).orderBy(desc(supportAccessGrants.approvedAt)); }
export async function listAccessReviews(tenantId: string) { return getPreviewDb().select().from(accessReviewAttestations).where(eq(accessReviewAttestations.tenantId, tenantId)).orderBy(desc(accessReviewAttestations.reviewedAt)).limit(12); }

export async function persistSupportAccess(input: { command: SupportAccessCommand; expiresAt: Date | null; event: EventEnvelope<Record<string, unknown>>; actor: RequestActor }) {
  const db = getPreviewDb();
  const [prior] = await db.select({ eventId: previewEvents.eventId }).from(previewEvents).where(and(eq(previewEvents.tenantId, input.event.tenantId), eq(previewEvents.idempotencyKey, input.event.idempotencyKey))).limit(1);
  if (prior) return { replayed: true };
  const current = await readSupportGrant(input.command.tenantId, input.command.matterId, input.command.supportUserId);
  const now = new Date(input.event.occurredAt), revision = (current?.revision ?? 0) + 1;
  const eventWrite = eventInsert(input.event, input.actor.userId, now);
  const outboxWrite = db.insert(previewOutbox).values({ id: createId(), tenantId: input.event.tenantId, eventId: input.event.eventId, topic: "athena.access", payload: input.event, attempts: 0, availableAt: now });
  if (input.command.action === "grant") {
    if (!input.expiresAt) throw new Error("Grant expiry is required");
    await db.batch([db.insert(supportAccessGrants).values({ id: current?.id ?? createId(), tenantId: input.command.tenantId, matterId: input.command.matterId, supportUserId: input.command.supportUserId, purpose: input.command.purpose, ticketReference: input.command.ticketReference, status: "active", approvedBy: input.actor.userId, approvedAt: now, expiresAt: input.expiresAt, revokedBy: null, revokedAt: null, revocationReason: null, revision }).onConflictDoUpdate({ target: [supportAccessGrants.tenantId, supportAccessGrants.matterId, supportAccessGrants.supportUserId], set: { purpose: input.command.purpose, ticketReference: input.command.ticketReference, status: "active", approvedBy: input.actor.userId, approvedAt: now, expiresAt: input.expiresAt, revokedBy: null, revokedAt: null, revocationReason: null, revision } }), eventWrite, outboxWrite]);
  } else {
    if (!current || current.status !== "active" || current.revision !== input.command.expectedRevision) throw new Error("Support grant changed; refresh before retrying");
    await db.batch([db.update(supportAccessGrants).set({ status: "revoked", revokedBy: input.actor.userId, revokedAt: now, revocationReason: input.command.reason, revision }).where(and(eq(supportAccessGrants.id, current.id), eq(supportAccessGrants.status, "active"), eq(supportAccessGrants.revision, input.command.expectedRevision))), eventWrite, outboxWrite]);
  }
  return { replayed: false };
}

export async function persistAccessReview(input: { command: { tenantId: string; periodStartedAt: string; periodEndedAt: string; outcome: "certified" | "exceptions_noted"; notes: string }; event: EventEnvelope<Record<string, unknown>>; actor: RequestActor }) {
  const db = getPreviewDb(), now = new Date(input.event.occurredAt);
  const [prior] = await db.select({ eventId: previewEvents.eventId }).from(previewEvents).where(and(eq(previewEvents.tenantId, input.event.tenantId), eq(previewEvents.idempotencyKey, input.event.idempotencyKey))).limit(1);
  if (prior) return { replayed: true };
  const [walls] = await db.select({ value: count() }).from(matterAccessPolicies).where(and(eq(matterAccessPolicies.tenantId, input.command.tenantId), eq(matterAccessPolicies.status, "active"), eq(matterAccessPolicies.effect, "deny")));
  const [grants] = await db.select({ value: count() }).from(supportAccessGrants).where(and(eq(supportAccessGrants.tenantId, input.command.tenantId), eq(supportAccessGrants.status, "active"), gt(supportAccessGrants.expiresAt, now)));
  const security = await readSecurityControlHealth(input.command.tenantId, now);
  const snapshot = { activeEthicalWalls: walls.value, activeSupportGrants: grants.value, allowedAccessDecisions: security.access.allowed, deniedAccessDecisions: security.access.denied };
  await db.batch([db.insert(accessReviewAttestations).values({ id: input.event.aggregateId, tenantId: input.command.tenantId, periodStartedAt: new Date(input.command.periodStartedAt), periodEndedAt: new Date(input.command.periodEndedAt), outcome: input.command.outcome, notes: input.command.notes, snapshot, reviewerId: input.actor.userId, reviewedAt: now }), eventInsert(input.event, input.actor.userId, now), db.insert(previewOutbox).values({ id: createId(), tenantId: input.event.tenantId, eventId: input.event.eventId, topic: "athena.access", payload: input.event, attempts: 0, availableAt: now })]);
  return { replayed: false, snapshot };
}

export async function authorizeSupportActor(actor: RequestActor, tenantId: string, matterId: string, now = new Date()) {
  if (actor.userId !== "user-support-sandbox") throw new Error("Support identity is not recognized");
  const grant = await readSupportGrant(tenantId, matterId, actor.userId);
  if (!grant || grant.status !== "active" || grant.expiresAt <= now) throw new Error("Active matter-scoped support approval is required");
  const context = scopedSupportContext(actor, matterId);
  await authorizePersistedMatter(context, tenantId, matterId, now, "support");
  authorizeMatterDataPlane({ context, tenantId, matterId, plane: "support", supportGrant: { approvedBy: grant.approvedBy, expiresAt: grant.expiresAt, matterIds: new Set([grant.matterId]) }, now });
  return grant;
}

function eventInsert(event: EventEnvelope<Record<string, unknown>>, actorId: string, occurredAt: Date) {
  return getPreviewDb().insert(previewEvents).values({ eventId: event.eventId, eventType: event.eventType, eventVersion: event.eventVersion, tenantId: event.tenantId, aggregateType: event.aggregateType, aggregateId: event.aggregateId, matterId: event.matterId, actorId, occurredAt, correlationId: event.correlationId, causationId: event.causationId, idempotencyKey: event.idempotencyKey, source: event.source, visibility: event.visibility, retentionPolicy: event.retentionPolicy, payload: event.payload });
}
