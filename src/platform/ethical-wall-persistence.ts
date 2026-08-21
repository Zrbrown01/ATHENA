import { createId } from "@paralleldrive/cuid2";
import { and, desc, eq } from "drizzle-orm";
import { getPreviewDb } from "../../db";
import { matterAccessPolicies, previewEvents, previewOutbox } from "../../db/schema";
import type { EthicalWallCommand } from "@/domain/governance/ethical-wall";
import type { EventEnvelope } from "./events";
import type { RequestActor } from "./request-actor";

const SOURCE = "ethical_wall_admin";

export async function readEthicalWall(tenantId: string, matterId: string, userId: string) {
  const [row] = await getPreviewDb().select().from(matterAccessPolicies).where(and(eq(matterAccessPolicies.tenantId, tenantId), eq(matterAccessPolicies.matterId, matterId), eq(matterAccessPolicies.userId, userId), eq(matterAccessPolicies.source, SOURCE))).limit(1);
  return row ?? null;
}

export async function listEthicalWalls(tenantId: string, matterId: string) {
  return getPreviewDb().select().from(matterAccessPolicies).where(and(eq(matterAccessPolicies.tenantId, tenantId), eq(matterAccessPolicies.matterId, matterId), eq(matterAccessPolicies.source, SOURCE))).orderBy(desc(matterAccessPolicies.effectiveAt));
}

export async function persistEthicalWall(input: { command: EthicalWallCommand; event: EventEnvelope<Record<string, unknown>>; actor: RequestActor }) {
  const db = getPreviewDb();
  const [prior] = await db.select({ eventId: previewEvents.eventId }).from(previewEvents).where(and(eq(previewEvents.tenantId, input.event.tenantId), eq(previewEvents.idempotencyKey, input.event.idempotencyKey))).limit(1);
  if (prior) return { replayed: true };
  const now = new Date(input.event.occurredAt);
  const current = await readEthicalWall(input.command.tenantId, input.command.matterId, input.command.targetUserId);
  const revision = (current?.revision ?? 0) + 1;
  const eventWrite = db.insert(previewEvents).values({
    eventId: input.event.eventId, eventType: input.event.eventType, eventVersion: input.event.eventVersion,
    tenantId: input.event.tenantId, aggregateType: input.event.aggregateType, aggregateId: input.event.aggregateId,
    matterId: input.event.matterId, actorId: input.actor.userId, occurredAt: now,
    correlationId: input.event.correlationId, causationId: input.event.causationId, idempotencyKey: input.event.idempotencyKey,
    source: input.event.source, visibility: input.event.visibility, retentionPolicy: input.event.retentionPolicy, payload: input.event.payload,
  });
  const outboxWrite = db.insert(previewOutbox).values({ id: createId(), tenantId: input.event.tenantId, eventId: input.event.eventId, topic: "athena.access", payload: input.event, attempts: 0, availableAt: now });
  if (input.command.action === "place") {
    await db.batch([
      db.insert(matterAccessPolicies).values({
        id: current?.id ?? createId(), tenantId: input.command.tenantId, matterId: input.command.matterId, userId: input.command.targetUserId,
        effect: "deny", status: "active", reason: input.command.reason, source: SOURCE, placedBy: input.actor.userId, effectiveAt: now,
        expiresAt: input.command.expiresAt ? new Date(input.command.expiresAt) : null, releasedBy: null, releasedAt: null, releaseReason: null, revision,
      }).onConflictDoUpdate({ target: [matterAccessPolicies.tenantId, matterAccessPolicies.matterId, matterAccessPolicies.userId, matterAccessPolicies.source], set: { effect: "deny", status: "active", reason: input.command.reason, placedBy: input.actor.userId, effectiveAt: now, expiresAt: input.command.expiresAt ? new Date(input.command.expiresAt) : null, releasedBy: null, releasedAt: null, releaseReason: null, revision } }),
      eventWrite, outboxWrite,
    ]);
  } else {
    if (!current || current.status !== "active" || current.revision !== input.command.expectedRevision) throw new Error("Ethical wall changed; refresh before retrying");
    await db.batch([
      db.update(matterAccessPolicies).set({ status: "released", expiresAt: now, releasedBy: input.actor.userId, releasedAt: now, releaseReason: input.command.reason, revision }).where(and(eq(matterAccessPolicies.id, current.id), eq(matterAccessPolicies.status, "active"), eq(matterAccessPolicies.revision, input.command.expectedRevision))),
      eventWrite, outboxWrite,
    ]);
  }
  return { replayed: false };
}
