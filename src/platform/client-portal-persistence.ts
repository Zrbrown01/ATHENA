import { createId } from "@paralleldrive/cuid2";
import { and, asc, eq } from "drizzle-orm";
import { getPreviewDb } from "../../db";
import { clientPortalAccessRequests, clientPortalDecisions, clientPortalShareItems, integrationHandoffs, previewEvents, previewOutbox } from "../../db/schema";
import type { ClientPortalCommand, ClientPortalStatus } from "@/domain/client-portal/lifecycle";
import type { EventEnvelope } from "./events";
import type { RequestActor } from "./request-actor";

export async function readClientPortalAccess(t: string, m: string, id: string) {
  const [row] = await getPreviewDb().select().from(clientPortalAccessRequests).where(and(eq(clientPortalAccessRequests.tenantId, t), eq(clientPortalAccessRequests.matterId, m), eq(clientPortalAccessRequests.id, id))).limit(1);
  return row ?? null;
}
export async function readClientPortalEvent(t: string, key: string) {
  const [row] = await getPreviewDb().select({ eventId: previewEvents.eventId }).from(previewEvents).where(and(eq(previewEvents.tenantId, t), eq(previewEvents.idempotencyKey, key))).limit(1);
  return row ?? null;
}
export async function clientPortalProjection(t: string, m: string) {
  const db = getPreviewDb();
  const [requests, shareItems, decisions] = await Promise.all([
    db.select().from(clientPortalAccessRequests).where(and(eq(clientPortalAccessRequests.tenantId, t), eq(clientPortalAccessRequests.matterId, m))),
    db.select().from(clientPortalShareItems).where(and(eq(clientPortalShareItems.tenantId, t), eq(clientPortalShareItems.matterId, m))).orderBy(asc(clientPortalShareItems.createdAt)),
    db.select().from(clientPortalDecisions).where(and(eq(clientPortalDecisions.tenantId, t), eq(clientPortalDecisions.matterId, m))).orderBy(asc(clientPortalDecisions.createdAt)),
  ]);
  return { requests, shareItems, decisions };
}
export async function persistClientPortal(input: {
  command: ClientPortalCommand; fromStatus: string; toStatus: ClientPortalStatus;
  shareDecision: { outcome: "allow" | "deny" | "redact" | "retain"; reasonCodes: string[] } | null;
  event: EventEnvelope<Record<string, unknown>>; actor: RequestActor;
}) {
  const db = getPreviewDb(), c = input.command, now = new Date(input.event.occurredAt);
  const eventWrite = db.insert(previewEvents).values({ eventId: input.event.eventId, eventType: input.event.eventType, eventVersion: input.event.eventVersion, tenantId: c.tenantId, aggregateType: input.event.aggregateType, aggregateId: c.accessRequestId, matterId: c.matterId, actorId: input.actor.userId, occurredAt: now, correlationId: input.event.correlationId, causationId: input.event.causationId, idempotencyKey: input.event.idempotencyKey, source: input.event.source, visibility: input.event.visibility, retentionPolicy: input.event.retentionPolicy, payload: input.event.payload });
  const outboxWrite = db.insert(previewOutbox).values({ id: createId(), tenantId: c.tenantId, eventId: input.event.eventId, topic: "athena.client_portal", payload: input.event, attempts: 0, availableAt: now });
  const decisionWrite = db.insert(clientPortalDecisions).values({ id: createId(), tenantId: c.tenantId, matterId: c.matterId, accessRequestId: c.accessRequestId, action: c.action, fromStatus: input.fromStatus, toStatus: input.toStatus, reason: reason(c), actorId: input.actor.userId, eventId: input.event.eventId, idempotencyKey: c.idempotencyKey, createdAt: now });
  const writes: unknown[] = [];
  if (c.action === "request_access") writes.push(db.insert(clientPortalAccessRequests).values({
    id: c.accessRequestId, tenantId: c.tenantId, matterId: c.matterId, clientOrganizationId: c.clientOrganizationId,
    contactName: c.contactName, contactEmail: c.contactEmail, purpose: c.purpose, requestedExpiresAt: new Date(c.requestedExpiresAt),
    status: "requested", identityProviderMode: "not_connected", identityEvidence: null, approvedBy: null, approvedAt: null,
    revokedBy: null, revokedAt: null, revocationReason: null, revision: 1, createdBy: input.actor.userId, createdAt: now, updatedAt: now,
  })); else {
    const current = await readClientPortalAccess(c.tenantId, c.matterId, c.accessRequestId);
    if (!current || current.revision !== c.expectedRevision) throw new Error("Portal access request changed; refresh before retrying");
    const patch: Record<string, unknown> = { status: input.toStatus, revision: current.revision + 1, updatedAt: now };
    if (c.action === "verify_identity") Object.assign(patch, { identityProviderMode: "human_verified_sandbox", identityEvidence: c.evidence });
    if (c.action === "approve_access") Object.assign(patch, { approvedBy: input.actor.userId, approvedAt: now });
    if (c.action === "evaluate_share_item") {
      if (!input.shareDecision) throw new Error("Share policy decision is required");
      const outcome = input.shareDecision.outcome === "allow" ? "allow" : input.shareDecision.outcome === "redact" ? "redact" : "deny";
      writes.push(db.insert(clientPortalShareItems).values({ id: c.shareItemId, tenantId: c.tenantId, matterId: c.matterId, accessRequestId: c.accessRequestId, resourceType: c.resourceType, resourceId: c.resourceId, title: c.title, labels: c.labels, outcome, reasonCodes: input.shareDecision.reasonCodes, policyVersion: 1, status: outcome === "allow" ? "approved_for_share" : "blocked", approvedBy: outcome === "allow" ? input.actor.userId : null, createdAt: now }));
    }
    if (c.action === "attempt_activation") writes.push(db.insert(integrationHandoffs).values({ id: createId(), tenantId: c.tenantId, matterId: c.matterId, runId: c.accessRequestId, provider: "client_portal_identity", operation: "activate_external_client_access", status: "blocked_not_connected", providerMode: "not_connected", retryable: true, activationRequirement: "Approved external identity architecture, MFA/session policy, verified client roster, field-level authorization, secure notification delivery, revocation, and access reconciliation are required.", createdAt: now }));
    if (c.action === "revoke_access") {
      Object.assign(patch, { revokedBy: input.actor.userId, revokedAt: now, revocationReason: c.reason });
      writes.push(db.update(clientPortalShareItems).set({ status: "revoked" }).where(and(eq(clientPortalShareItems.tenantId, c.tenantId), eq(clientPortalShareItems.accessRequestId, c.accessRequestId), eq(clientPortalShareItems.status, "approved_for_share"))));
    }
    writes.push(db.update(clientPortalAccessRequests).set(patch).where(and(eq(clientPortalAccessRequests.tenantId, c.tenantId), eq(clientPortalAccessRequests.id, c.accessRequestId), eq(clientPortalAccessRequests.revision, c.expectedRevision))));
  }
  await db.batch([...(writes as never[]), decisionWrite, eventWrite, outboxWrite] as never);
  return { replayed: false, eventId: input.event.eventId };
}
function reason(c: ClientPortalCommand) {
  if ("reason" in c) return c.reason;
  if (c.action === "verify_identity") return c.evidence;
  return c.purpose;
}
