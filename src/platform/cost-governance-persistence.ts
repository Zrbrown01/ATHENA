import { createId } from "@paralleldrive/cuid2";
import { and, asc, eq } from "drizzle-orm";
import { getPreviewDb } from "../../db";
import { costGovernanceDecisions, costRateCards, costRateItems, optimisticWriteClaims, previewEvents, previewOutbox, usageCostEntries } from "../../db/schema";
import type { CostGovernanceCommand } from "@/domain/platform/cost-governance";
import type { EventEnvelope } from "./events";
import type { RequestActor } from "./request-actor";
import { rethrowOptimisticClaimConflict } from "./optimistic-concurrency";

export async function readCostRateCard(tenantId: string, id: string) { const [row] = await getPreviewDb().select().from(costRateCards).where(and(eq(costRateCards.tenantId, tenantId), eq(costRateCards.id, id))).limit(1); return row ?? null; }
export async function readCostRateItems(tenantId: string, rateCardId: string) { return getPreviewDb().select().from(costRateItems).where(and(eq(costRateItems.tenantId, tenantId), eq(costRateItems.rateCardId, rateCardId))); }
export async function readUsageCostEntry(tenantId: string, id: string) { const [row] = await getPreviewDb().select({ id: usageCostEntries.id }).from(usageCostEntries).where(and(eq(usageCostEntries.tenantId, tenantId), eq(usageCostEntries.id, id))).limit(1); return row ?? null; }
export async function readCostEvent(tenantId: string, key: string) { const [row] = await getPreviewDb().select({ eventId: previewEvents.eventId }).from(previewEvents).where(and(eq(previewEvents.tenantId, tenantId), eq(previewEvents.idempotencyKey, key))).limit(1); return row ?? null; }

export async function costGovernanceProjection(tenantId: string) {
  const db = getPreviewDb(), [rateCards, rateItems, usage, decisions] = await Promise.all([
    db.select().from(costRateCards).where(eq(costRateCards.tenantId, tenantId)).orderBy(asc(costRateCards.createdAt)),
    db.select().from(costRateItems).where(eq(costRateItems.tenantId, tenantId)),
    db.select().from(usageCostEntries).where(eq(usageCostEntries.tenantId, tenantId)).orderBy(asc(usageCostEntries.occurredAt)),
    db.select().from(costGovernanceDecisions).where(eq(costGovernanceDecisions.tenantId, tenantId)).orderBy(asc(costGovernanceDecisions.createdAt)),
  ]);
  const byCategory = Object.values(usage.reduce<Record<string, { category: string; quantity: number; costMicros: number; entryCount: number }>>((result, entry) => { const item = result[entry.category] ?? { category: entry.category, quantity: 0, costMicros: 0, entryCount: 0 }; item.quantity += entry.quantity; item.costMicros += entry.costMicros; item.entryCount += 1; result[entry.category] = item; return result; }, {}));
  const byWorkflow = Object.values(usage.reduce<Record<string, { workflowId: string; costMicros: number; entryCount: number }>>((result, entry) => { const item = result[entry.workflowId] ?? { workflowId: entry.workflowId, costMicros: 0, entryCount: 0 }; item.costMicros += entry.costMicros; item.entryCount += 1; result[entry.workflowId] = item; return result; }, {}));
  return { rateCards, rateItems, usage, decisions, summary: { totalCostMicros: usage.reduce((sum, entry) => sum + entry.costMicros, 0), estimatedEntryCount: usage.filter((entry) => entry.pricingState === "estimated").length, providerVerifiedEntryCount: usage.filter((entry) => entry.pricingState === "provider_verified").length, byCategory, byWorkflow } };
}

export async function persistCostGovernance(input: { command: CostGovernanceCommand; fromStatus: string; toStatus: string; unitRateMicros: number | null; costMicros: number | null; event: EventEnvelope<Record<string, unknown>>; actor: RequestActor }) {
  const db = getPreviewDb(), c = input.command, now = new Date(input.event.occurredAt);
  const eventWrite = db.insert(previewEvents).values({ eventId: input.event.eventId, eventType: input.event.eventType, eventVersion: input.event.eventVersion, tenantId: c.tenantId, aggregateType: input.event.aggregateType, aggregateId: input.event.aggregateId, matterId: input.event.matterId, actorId: input.actor.userId, occurredAt: now, correlationId: input.event.correlationId, causationId: input.event.causationId, idempotencyKey: input.event.idempotencyKey, source: input.event.source, visibility: input.event.visibility, retentionPolicy: input.event.retentionPolicy, payload: input.event.payload });
  const outboxWrite = db.insert(previewOutbox).values({ id: createId(), tenantId: c.tenantId, eventId: input.event.eventId, topic: "athena.cost_governance", payload: input.event, attempts: 0, availableAt: now });
  const decisionWrite = db.insert(costGovernanceDecisions).values({ id: createId(), tenantId: c.tenantId, rateCardId: c.rateCardId, usageEntryId: c.action === "record_usage" ? c.usageEntryId : null, action: c.action, fromStatus: input.fromStatus, toStatus: input.toStatus, reason: c.action === "approve_rate_card" ? c.reason : c.action === "record_usage" ? c.evidence : c.sourceRef, actorId: input.actor.userId, eventId: input.event.eventId, idempotencyKey: c.idempotencyKey, createdAt: now });
  if (c.action === "create_rate_card") await db.batch([db.insert(costRateCards).values({ id: c.rateCardId, tenantId: c.tenantId, name: c.name, currency: c.currency, sourceType: c.sourceType, sourceRef: c.sourceRef, status: "draft", effectiveAt: new Date(c.effectiveAt), revision: 1, createdBy: input.actor.userId, createdAt: now, updatedAt: now }), ...c.rates.map((rate) => db.insert(costRateItems).values({ id: createId(), tenantId: c.tenantId, rateCardId: c.rateCardId, category: rate.category, unit: rate.unit, unitRateMicros: rate.unitRateMicros, createdAt: now })), decisionWrite, eventWrite, outboxWrite] as never);
  else if (c.action === "approve_rate_card") {
    try {
      await db.batch([
        db.insert(optimisticWriteClaims).values({ id: createId(), tenantId: c.tenantId, aggregateType: "cost_rate_card", aggregateId: c.rateCardId, expectedRevision: c.expectedRevision, claimedRevision: c.expectedRevision + 1, actorId: input.actor.userId, eventId: input.event.eventId, idempotencyKey: c.idempotencyKey, createdAt: now }),
        db.update(costRateCards).set({ status: "approved", revision: c.expectedRevision + 1, approvedBy: input.actor.userId, approvedAt: now, updatedAt: now }).where(and(eq(costRateCards.tenantId, c.tenantId), eq(costRateCards.id, c.rateCardId), eq(costRateCards.revision, c.expectedRevision))),
        decisionWrite, eventWrite, outboxWrite,
      ]);
    } catch (error) { rethrowOptimisticClaimConflict(error); }
  }
  else await db.batch([db.insert(usageCostEntries).values({ id: c.usageEntryId, tenantId: c.tenantId, matterId: c.matterId, workflowId: c.workflowId, category: c.category, unit: c.unit, quantity: c.quantity, unitRateMicros: input.unitRateMicros!, costMicros: input.costMicros!, pricingState: c.pricingState, rateCardId: c.rateCardId, providerName: c.providerName, sourceType: c.sourceType, sourceId: c.sourceId, evidence: c.evidence, occurredAt: new Date(c.occurredAt), recordedBy: input.actor.userId, createdAt: now }), decisionWrite, eventWrite, outboxWrite]);
  return { replayed: false, eventId: input.event.eventId };
}
