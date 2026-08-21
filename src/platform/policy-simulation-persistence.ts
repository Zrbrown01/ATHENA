import { createId } from "@paralleldrive/cuid2";
import { and, asc, desc, eq } from "drizzle-orm";
import { getPreviewDb } from "../../db";
import {
  governancePolicyLayers,
  governancePolicySimulations,
  optimisticWriteClaims,
  previewEvents,
  previewOutbox,
} from "../../db/schema";
import {
  diffGovernanceLayers,
  type GovernancePolicyLayerState,
  type PolicyResolution,
  type PolicySimulationCommand,
} from "@/domain/governance/policy-simulation";
import type { EventEnvelope } from "./events";
import {
  OptimisticConcurrencyError,
  rethrowOptimisticClaimConflict,
} from "./optimistic-concurrency";
import type { RequestActor } from "./request-actor";

export async function readPolicySimulationEvent(
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

export async function readGovernancePolicyLayer(tenantId: string, id: string) {
  const [row] = await getPreviewDb()
    .select()
    .from(governancePolicyLayers)
    .where(
      and(
        eq(governancePolicyLayers.tenantId, tenantId),
        eq(governancePolicyLayers.id, id),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function readActiveGovernanceScopeLayer(input: {
  tenantId: string;
  code: string;
  scopeType: "firm" | "client" | "matter_type" | "matter";
  scopeId: string;
}) {
  const [row] = await getPreviewDb()
    .select()
    .from(governancePolicyLayers)
    .where(
      and(
        eq(governancePolicyLayers.tenantId, input.tenantId),
        eq(governancePolicyLayers.code, input.code),
        eq(governancePolicyLayers.scopeType, input.scopeType),
        eq(governancePolicyLayers.scopeId, input.scopeId),
        eq(governancePolicyLayers.status, "active"),
      ),
    )
    .orderBy(desc(governancePolicyLayers.version))
    .limit(1);
  return row ?? null;
}

export async function readApplicableGovernancePolicyLayers(
  tenantId: string,
  code: string,
) {
  return getPreviewDb()
    .select()
    .from(governancePolicyLayers)
    .where(
      and(
        eq(governancePolicyLayers.tenantId, tenantId),
        eq(governancePolicyLayers.code, code),
        eq(governancePolicyLayers.status, "active"),
      ),
    )
    .orderBy(asc(governancePolicyLayers.createdAt));
}

export async function policySimulationProjection(
  tenantId: string,
  matterId: string,
) {
  const db = getPreviewDb();
  const [layers, simulations] = await Promise.all([
    db
      .select()
      .from(governancePolicyLayers)
      .where(eq(governancePolicyLayers.tenantId, tenantId))
      .orderBy(
        asc(governancePolicyLayers.code),
        asc(governancePolicyLayers.scopeType),
        asc(governancePolicyLayers.version),
      ),
    db
      .select()
      .from(governancePolicySimulations)
      .where(
        and(
          eq(governancePolicySimulations.tenantId, tenantId),
          eq(governancePolicySimulations.matterId, matterId),
        ),
      )
      .orderBy(desc(governancePolicySimulations.createdAt)),
  ]);
  const byId = new Map(layers.map((layer) => [layer.id, layer]));
  const diffs = layers.flatMap((layer) => {
    if (!layer.supersedesLayerId) return [];
    const prior = byId.get(layer.supersedesLayerId);
    return prior
      ? [
          {
            ...diffGovernanceLayers(
              prior as GovernancePolicyLayerState,
              layer as GovernancePolicyLayerState,
            ),
            code: layer.code,
          },
        ]
      : [];
  });
  return { layers, simulations, diffs };
}

export async function persistPolicySimulation(input: {
  command: PolicySimulationCommand;
  event: EventEnvelope<Record<string, unknown>>;
  actor: RequestActor;
  resolution?: PolicyResolution | null;
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
    matterId: input.event.matterId,
    actorId: input.actor.userId,
    occurredAt: now,
    correlationId: input.event.correlationId,
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
    topic: "athena.governance_policy",
    payload: input.event,
    attempts: 0,
    availableAt: now,
  });

  try {
    if (c.action === "create_layer") {
      const writes = [];
      if (c.supersedesLayerId && c.expectedSupersededRevision) {
        writes.push(
          db.insert(optimisticWriteClaims).values({
            id: createId(),
            tenantId: c.tenantId,
            aggregateType: "governance_policy_layer",
            aggregateId: c.supersedesLayerId,
            expectedRevision: c.expectedSupersededRevision,
            claimedRevision: c.expectedSupersededRevision + 1,
            actorId: input.actor.userId,
            eventId: input.event.eventId,
            idempotencyKey: c.idempotencyKey,
            createdAt: now,
          }),
          db
            .update(governancePolicyLayers)
            .set({
              status: "superseded",
              revision: c.expectedSupersededRevision + 1,
              updatedAt: now,
            })
            .where(
              and(
                eq(governancePolicyLayers.tenantId, c.tenantId),
                eq(governancePolicyLayers.id, c.supersedesLayerId),
                eq(
                  governancePolicyLayers.revision,
                  c.expectedSupersededRevision,
                ),
                eq(governancePolicyLayers.status, "active"),
              ),
            ),
        );
      }
      writes.push(
        db.insert(governancePolicyLayers).values({
          id: c.layerId,
          tenantId: c.tenantId,
          matterId: c.matterId,
          code: c.code,
          version: c.version,
          scopeType: c.scopeType,
          scopeId: c.scopeId,
          businessDays: c.businessDays,
          dayKind: "business",
          rollConvention: "next_business_day",
          authorityCitation: c.authorityCitation,
          effectiveAt: dateOnly(c.effectiveDate),
          reviewBy: dateOnly(c.reviewDate),
          contentStatus: c.contentStatus,
          status: "active",
          revision: 1,
          supersedesLayerId: c.supersedesLayerId,
          reason: c.reason,
          createdBy: input.actor.userId,
          eventId: input.event.eventId,
          createdAt: now,
          updatedAt: now,
        }),
        eventWrite,
        outboxWrite,
      );
      await runOptimisticBatch(db, writes as never);
    } else {
      if (!input.resolution)
        throw new Error("Policy resolution is required for persistence");
      const selected = input.resolution.selected;
      await db.batch([
        db.insert(governancePolicySimulations).values({
          id: c.simulationId,
          tenantId: c.tenantId,
          matterId: c.matterId,
          code: c.code,
          triggerAt: dateOnly(c.triggerDate),
          asOf: dateOnly(c.asOfDate),
          clientId: c.clientId,
          matterType: c.matterType,
          selectedLayerId: selected.id,
          selectedScopeType: selected.scopeType,
          selectedVersion: selected.version,
          dueAt: dateOnly(input.resolution.deadline.dueDate),
          applicableLayerIds: input.resolution.applicable.map(
            (layer) => layer.id,
          ),
          selectedLayerSnapshot: {
            id: selected.id,
            code: selected.code,
            version: selected.version,
            scopeType: selected.scopeType,
            scopeId: selected.scopeId,
            businessDays: selected.businessDays,
            authorityCitation: selected.authorityCitation,
            contentStatus: selected.contentStatus,
          },
          calculation: input.resolution.trace,
          createdBy: input.actor.userId,
          eventId: input.event.eventId,
          createdAt: now,
        }),
        eventWrite,
        outboxWrite,
      ] as never);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("idx_governance_policy_layer_version"))
      throw new OptimisticConcurrencyError();
    rethrowOptimisticClaimConflict(error);
  }
  return { replayed: false, eventId: input.event.eventId };
}

function dateOnly(value: string) {
  return new Date(`${value}T12:00:00.000Z`);
}

async function runOptimisticBatch(
  db: ReturnType<typeof getPreviewDb>,
  statements: Parameters<typeof db.batch>[0],
) {
  try {
    return await db.batch(statements);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes("SQLITE_BUSY")) throw error;
    await new Promise((resolve) => setTimeout(resolve, 10));
    return db.batch(statements);
  }
}
