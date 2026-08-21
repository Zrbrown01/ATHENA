import { createId } from "@paralleldrive/cuid2";
import { and, asc, desc, eq } from "drizzle-orm";
import { getPreviewDb } from "../../db";
import {
  classificationDecisions,
  classificationOverrides,
  classificationPolicyVersions,
  previewEvents,
  previewOutbox,
  resourceClassifications,
} from "../../db/schema";
import type {
  ClassificationCommand,
  ClassificationState,
  OverrideState,
} from "@/domain/classification/policy";
import type { EventEnvelope } from "./events";
import type { RequestActor } from "./request-actor";

export async function readClassification(
  tenantId: string,
  resourceType: string,
  resourceId: string,
) {
  const [row] = await getPreviewDb()
    .select()
    .from(resourceClassifications)
    .where(
      and(
        eq(resourceClassifications.tenantId, tenantId),
        eq(resourceClassifications.resourceType, resourceType),
        eq(resourceClassifications.resourceId, resourceId),
        eq(resourceClassifications.status, "active"),
      ),
    )
    .orderBy(desc(resourceClassifications.revision))
    .limit(1);
  return row ?? null;
}

export async function readClassificationOverride(
  tenantId: string,
  resourceType: string,
  resourceId: string,
  plane: string,
) {
  const [row] = await getPreviewDb()
    .select()
    .from(classificationOverrides)
    .where(
      and(
        eq(classificationOverrides.tenantId, tenantId),
        eq(classificationOverrides.resourceType, resourceType),
        eq(classificationOverrides.resourceId, resourceId),
        eq(classificationOverrides.plane, plane),
        eq(classificationOverrides.status, "active"),
      ),
    )
    .orderBy(desc(classificationOverrides.createdAt))
    .limit(1);
  return row ?? null;
}

export async function readClassificationEvent(
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

export async function classificationProjection(tenantId: string) {
  const db = getPreviewDb();
  const [policies, resources, overrides, decisions] = await Promise.all([
    db
      .select()
      .from(classificationPolicyVersions)
      .where(eq(classificationPolicyVersions.tenantId, tenantId))
      .orderBy(desc(classificationPolicyVersions.version)),
    db
      .select()
      .from(resourceClassifications)
      .where(eq(resourceClassifications.tenantId, tenantId))
      .orderBy(desc(resourceClassifications.classifiedAt)),
    db
      .select()
      .from(classificationOverrides)
      .where(eq(classificationOverrides.tenantId, tenantId))
      .orderBy(desc(classificationOverrides.createdAt)),
    db
      .select()
      .from(classificationDecisions)
      .where(eq(classificationDecisions.tenantId, tenantId))
      .orderBy(asc(classificationDecisions.decidedAt)),
  ]);
  return { policies, resources, overrides, decisions };
}

export async function persistClassification(input: {
  command: ClassificationCommand;
  event: EventEnvelope<Record<string, unknown>>;
  actor: RequestActor;
  classification?: ClassificationState | null;
  override?: OverrideState | null;
  result?: {
    outcome: "allow" | "deny" | "redact" | "retain";
    reasonCodes: string[];
    overrideId: string | null;
  };
}) {
  const db = getPreviewDb();
  const c = input.command;
  const now = new Date(input.event.occurredAt);
  const eventWrite = db.insert(previewEvents).values({
    eventId: input.event.eventId,
    eventType: input.event.eventType,
    eventVersion: input.event.eventVersion,
    tenantId: c.tenantId,
    aggregateType: input.event.aggregateType,
    aggregateId: input.event.aggregateId,
    matterId: c.matterId,
    actorId: input.actor.userId,
    occurredAt: now,
    correlationId: input.event.correlationId,
    causationId: input.event.causationId,
    idempotencyKey: input.event.idempotencyKey,
    source: input.event.source,
    visibility: input.event.visibility,
    retentionPolicy: input.event.retentionPolicy,
    payload: input.event.payload,
  });
  const outboxWrite = db.insert(previewOutbox).values({
    id: createId(),
    tenantId: c.tenantId,
    eventId: input.event.eventId,
    topic: "athena.classification",
    payload: input.event,
    attempts: 0,
    availableAt: now,
  });
  const writes: unknown[] = [];

  if (c.action === "register_fixture_classification") {
    writes.push(
      db
        .insert(classificationPolicyVersions)
        .values({
          id: c.policyId,
          tenantId: c.tenantId,
          version: 1,
          status: "approved",
          labels: c.labels,
          planes: [
            "access",
            "search",
            "ai",
            "sharing",
            "download",
            "printing",
            "retention",
            "export",
            "logging",
          ],
          denyOverridesAllow: true,
          approvedBy: input.actor.userId,
          approvedAt: now,
          createdAt: now,
        })
        .onConflictDoNothing(),
      db.insert(resourceClassifications).values({
        id: c.classificationId,
        tenantId: c.tenantId,
        matterId: c.matterId,
        resourceType: c.resourceType,
        resourceId: c.resourceId,
        labels: c.labels,
        policyVersion: 1,
        source: c.source,
        status: "active",
        revision: 1,
        classifiedBy: input.actor.userId,
        classifiedAt: now,
      }),
    );
  } else if (c.action === "approve_override") {
    writes.push(
      db.insert(classificationOverrides).values({
        id: c.overrideId,
        tenantId: c.tenantId,
        resourceType: c.resourceType,
        resourceId: c.resourceId,
        plane: c.plane,
        reason: c.reason,
        approvedBy: input.actor.userId,
        expiresAt: new Date(c.expiresAt),
        status: "active",
        createdAt: now,
      }),
    );
  } else {
    if (!input.classification || !input.result)
      throw new Error("Classification decision evidence is incomplete");
    writes.push(
      db.insert(classificationDecisions).values({
        id: createId(),
        tenantId: c.tenantId,
        matterId: c.matterId,
        resourceType: c.resourceType,
        resourceId: c.resourceId,
        plane: c.plane,
        outcome: input.result.outcome,
        labels: input.classification.labels,
        reasonCodes: input.result.reasonCodes,
        policyVersion: input.classification.policyVersion,
        overrideId: input.result.overrideId,
        actorId: input.actor.userId,
        eventId: input.event.eventId,
        idempotencyKey: c.idempotencyKey,
        decidedAt: now,
      }),
    );
  }

  await db.batch([...(writes as never[]), eventWrite, outboxWrite] as never);
  return { replayed: false, eventId: input.event.eventId };
}
