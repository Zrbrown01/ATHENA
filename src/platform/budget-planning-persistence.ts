import { createId } from "@paralleldrive/cuid2";
import { and, asc, eq } from "drizzle-orm";
import { getPreviewDb } from "../../db";
import {
  accrualSnapshots,
  budgetDecisions,
  budgetPhases,
  matterBudgets,
  optimisticWriteClaims,
  previewEvents,
  previewOutbox,
  profitabilitySnapshots,
} from "../../db/schema";
import {
  calculatePlanning,
  type BudgetPlanningCommand,
} from "@/domain/billing/planning";
import type { EventEnvelope } from "./events";
import { rethrowOptimisticClaimConflict } from "./optimistic-concurrency";
import type { RequestActor } from "./request-actor";
export async function readBudget(t: string, m: string, id: string) {
  const [x] = await getPreviewDb()
    .select()
    .from(matterBudgets)
    .where(
      and(
        eq(matterBudgets.tenantId, t),
        eq(matterBudgets.matterId, m),
        eq(matterBudgets.id, id),
      ),
    )
    .limit(1);
  return x ?? null;
}
export async function readBudgetEvent(t: string, key: string) {
  const [x] = await getPreviewDb()
    .select({ eventId: previewEvents.eventId })
    .from(previewEvents)
    .where(
      and(eq(previewEvents.tenantId, t), eq(previewEvents.idempotencyKey, key)),
    )
    .limit(1);
  return x ?? null;
}
export async function budgetProjection(t: string, m: string) {
  const db = getPreviewDb(),
    [budgets, phases, accruals, profitability, decisions] = await Promise.all([
      db
        .select()
        .from(matterBudgets)
        .where(
          and(eq(matterBudgets.tenantId, t), eq(matterBudgets.matterId, m)),
        )
        .orderBy(asc(matterBudgets.createdAt)),
      db
        .select()
        .from(budgetPhases)
        .where(and(eq(budgetPhases.tenantId, t), eq(budgetPhases.matterId, m)))
        .orderBy(asc(budgetPhases.position)),
      db
        .select()
        .from(accrualSnapshots)
        .where(
          and(
            eq(accrualSnapshots.tenantId, t),
            eq(accrualSnapshots.matterId, m),
          ),
        )
        .orderBy(asc(accrualSnapshots.createdAt)),
      db
        .select()
        .from(profitabilitySnapshots)
        .where(
          and(
            eq(profitabilitySnapshots.tenantId, t),
            eq(profitabilitySnapshots.matterId, m),
          ),
        )
        .orderBy(asc(profitabilitySnapshots.createdAt)),
      db
        .select()
        .from(budgetDecisions)
        .where(
          and(eq(budgetDecisions.tenantId, t), eq(budgetDecisions.matterId, m)),
        )
        .orderBy(asc(budgetDecisions.createdAt)),
    ]);
  return { budgets, phases, accruals, profitability, decisions };
}
export async function persistBudgetPlanning(input: {
  command: BudgetPlanningCommand;
  fromStatus: string;
  toStatus: string;
  event: EventEnvelope<Record<string, unknown>>;
  actor: RequestActor;
}) {
  const db = getPreviewDb(),
    c = input.command,
    now = new Date(input.event.occurredAt),
    eventWrite = db.insert(previewEvents).values(eventValues(input.event)),
    outboxWrite = db
      .insert(previewOutbox)
      .values({
        id: createId(),
        tenantId: c.tenantId,
        eventId: input.event.eventId,
        topic: "athena.billing_planning",
        payload: input.event,
        attempts: 0,
        availableAt: now,
      }),
    decisionWrite = db
      .insert(budgetDecisions)
      .values({
        id: createId(),
        tenantId: c.tenantId,
        matterId: c.matterId,
        budgetId: c.budgetId,
        action: c.action,
        fromStatus: input.fromStatus,
        toStatus: input.toStatus,
        reason:
          "reason" in c
            ? c.reason
            : c.action === "materialize_fixture_budget"
              ? "Acknowledged deterministic synthetic matter budget."
              : "Recorded source-linked integer-cent planning snapshot.",
        actorId: input.actor.userId,
        eventId: input.event.eventId,
        idempotencyKey: c.idempotencyKey,
        createdAt: now,
      });
  if (c.action === "materialize_fixture_budget")
    await db.batch([
      db
        .insert(matterBudgets)
        .values({
          id: c.budgetId,
          tenantId: c.tenantId,
          matterId: c.matterId,
          title: c.title,
          currency: "USD",
          totalBudgetCents: c.totalBudgetCents,
          status: "draft",
          contentStatus: "synthetic_sandbox",
          effectiveDate: dateOnly(c.effectiveDate),
          revision: 1,
          createdBy: input.actor.userId,
          createdAt: now,
          updatedAt: now,
        }),
      ...c.phases.map((phase, index) =>
        db
          .insert(budgetPhases)
          .values({
            id: phase.id,
            tenantId: c.tenantId,
            matterId: c.matterId,
            budgetId: c.budgetId,
            phaseCode: phase.phaseCode,
            title: phase.title,
            position: index + 1,
            budgetCents: phase.budgetCents,
            incurredCents: 0,
            remainingCents: phase.budgetCents,
            createdAt: now,
            updatedAt: now,
          }),
      ),
      decisionWrite,
      eventWrite,
      outboxWrite,
    ]);
  else {
    const budget = await readBudget(c.tenantId, c.matterId, c.budgetId);
    if (!budget) throw new Error("Budget does not exist");
    if (c.action === "approve_budget") {
      try {
        await db.batch([
          db.insert(optimisticWriteClaims).values({
            id: createId(),
            tenantId: c.tenantId,
            aggregateType: "matter_budget",
            aggregateId: c.budgetId,
            expectedRevision: c.expectedRevision,
            claimedRevision: c.expectedRevision + 1,
            actorId: input.actor.userId,
            eventId: input.event.eventId,
            idempotencyKey: c.idempotencyKey,
            createdAt: now,
          }),
          db
            .update(matterBudgets)
            .set({
              status: "approved",
              approvedBy: input.actor.userId,
              approvedAt: now,
              revision: c.expectedRevision + 1,
              updatedAt: now,
            })
            .where(
              and(
                eq(matterBudgets.tenantId, c.tenantId),
                eq(matterBudgets.id, c.budgetId),
                eq(matterBudgets.revision, c.expectedRevision),
              ),
            ),
          decisionWrite,
          eventWrite,
          outboxWrite,
        ]);
      } catch (error) {
        rethrowOptimisticClaimConflict(error);
      }
    }
    else if (c.action === "record_accrual") {
      const math = calculatePlanning({
        totalBudgetCents: budget.totalBudgetCents,
        feesCents: c.feesCents,
        expensesCents: c.expensesCents,
        billedCents: 0,
        collectedCents: 0,
        workedValueCents: 1,
        directCostCents: 0,
      });
      await db.batch([
        db
          .insert(accrualSnapshots)
          .values({
            id: c.accrualId,
            tenantId: c.tenantId,
            matterId: c.matterId,
            budgetId: c.budgetId,
            period: c.period,
            feesCents: c.feesCents,
            expensesCents: c.expensesCents,
            totalAccruedCents: math.totalAccruedCents,
            budgetVarianceCents: math.budgetVarianceCents,
            sourceRecordIds: c.sourceRecordIds,
            recordedBy: input.actor.userId,
            createdAt: now,
          }),
        decisionWrite,
        eventWrite,
        outboxWrite,
      ]);
    } else {
      const math = calculatePlanning({
        totalBudgetCents: budget.totalBudgetCents,
        feesCents: 0,
        expensesCents: 0,
        billedCents: c.billedCents,
        collectedCents: c.collectedCents,
        workedValueCents: c.workedValueCents,
        directCostCents: c.directCostCents,
      });
      await db.batch([
        db
          .insert(profitabilitySnapshots)
          .values({
            id: c.snapshotId,
            tenantId: c.tenantId,
            matterId: c.matterId,
            budgetId: c.budgetId,
            asOfDate: dateOnly(c.asOfDate),
            billedCents: c.billedCents,
            collectedCents: c.collectedCents,
            workedValueCents: c.workedValueCents,
            directCostCents: c.directCostCents,
            realizationBasisPoints: math.realizationBasisPoints,
            contributionCents: math.contributionCents,
            projectionMode: "deterministic_sandbox",
            sourceRecordIds: c.sourceRecordIds,
            createdBy: input.actor.userId,
            createdAt: now,
          }),
        decisionWrite,
        eventWrite,
        outboxWrite,
      ]);
    }
  }
  return { replayed: false, eventId: input.event.eventId };
}
function eventValues(e: EventEnvelope<Record<string, unknown>>) {
  return {
    eventId: e.eventId,
    eventType: e.eventType,
    eventVersion: e.eventVersion,
    tenantId: e.tenantId,
    aggregateType: e.aggregateType,
    aggregateId: e.aggregateId,
    matterId: e.matterId,
    actorId: e.actorId,
    occurredAt: new Date(e.occurredAt),
    correlationId: e.correlationId,
    causationId: e.causationId,
    idempotencyKey: e.idempotencyKey,
    source: e.source,
    visibility: e.visibility,
    retentionPolicy: e.retentionPolicy,
    payload: e.payload,
  };
}
function dateOnly(v: string) {
  return new Date(`${v}T17:00:00.000Z`);
}
