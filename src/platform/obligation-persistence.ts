import { createId } from "@paralleldrive/cuid2";
import { and, desc, eq } from "drizzle-orm";
import { getPreviewDb } from "../../db";
import { governanceRules, obligations, previewEvents, previewOutbox } from "../../db/schema";
import type { ObligationCommand, ObligationStatus } from "@/domain/governance/obligation";
import type { DeadlineResult, DeadlineRule } from "@/domain/governance/deadline";
import type { EventEnvelope } from "./events";
import type { RequestActor } from "./request-actor";

export async function readObligationRule(tenantId: string, code: string) {
  const db = getPreviewDb();
  const [rule] = await db.select().from(governanceRules).where(and(eq(governanceRules.tenantId, tenantId), eq(governanceRules.code, code))).orderBy(desc(governanceRules.version)).limit(1);
  if (!rule) return null;
  const deadlineRule: DeadlineRule = {
    code: rule.code, version: rule.version, authorityType: rule.authorityType as DeadlineRule["authorityType"],
    authorityCitation: rule.authorityCitation, baseDays: rule.businessDays, dayKind: "business",
    rollConvention: "next_business_day", effectiveDate: rule.effectiveAt.toISOString().slice(0, 10), reviewDate: rule.reviewBy.toISOString().slice(0, 10),
  };
  return { ...rule, deadlineRule };
}

export async function readObligation(tenantId: string, matterId: string, obligationId: string) {
  const db = getPreviewDb();
  const [row] = await db.select().from(obligations).where(and(eq(obligations.tenantId, tenantId), eq(obligations.matterId, matterId), eq(obligations.id, obligationId))).limit(1);
  return row ?? null;
}

export async function listObligations(tenantId: string, matterId: string) {
  return getPreviewDb().select().from(obligations).where(and(eq(obligations.tenantId, tenantId), eq(obligations.matterId, matterId))).orderBy(desc(obligations.updatedAt));
}

export async function persistObligationDecision(input: {
  command: ObligationCommand;
  event: EventEnvelope<Record<string, unknown>>;
  actor: RequestActor;
  deadline?: DeadlineResult;
  rule?: NonNullable<Awaited<ReturnType<typeof readObligationRule>>>;
}) {
  const db = getPreviewDb();
  const [prior] = await db.select({ eventId: previewEvents.eventId }).from(previewEvents).where(and(eq(previewEvents.tenantId, input.event.tenantId), eq(previewEvents.idempotencyKey, input.event.idempotencyKey))).limit(1);
  if (prior) return { replayed: true };
  const now = new Date(input.event.occurredAt);
  const command = input.command;
  const eventWrite = db.insert(previewEvents).values({
    eventId: input.event.eventId, eventType: input.event.eventType, eventVersion: input.event.eventVersion,
    tenantId: input.event.tenantId, aggregateType: input.event.aggregateType, aggregateId: input.event.aggregateId,
    matterId: input.event.matterId, actorId: input.actor.userId, occurredAt: now,
    correlationId: input.event.correlationId, causationId: input.event.causationId, idempotencyKey: input.event.idempotencyKey,
    source: input.event.source, visibility: input.event.visibility, retentionPolicy: input.event.retentionPolicy, payload: input.event.payload,
  });
  const outboxWrite = db.insert(previewOutbox).values({ id: createId(), tenantId: input.event.tenantId, eventId: input.event.eventId, topic: "athena.obligations", payload: input.event, attempts: 0, availableAt: now });

  if (command.action === "create") {
    if (!input.deadline || !input.rule) throw new Error("Rule calculation is required");
    await db.batch([
      db.insert(obligations).values({
        id: input.event.aggregateId, tenantId: command.tenantId, matterId: command.matterId, ruleId: input.rule.id,
        ruleCode: input.rule.code, ruleVersion: input.rule.version, authorityCitation: input.rule.authorityCitation,
        title: command.title, requirement: command.requirement, triggerAt: dateOnly(command.triggerDate), triggerSourceType: command.triggerSourceType,
        triggerSourceId: command.triggerSourceId, dueAt: dateOnly(input.deadline.dueDate), ownerId: command.ownerId, status: "open",
        calculation: input.deadline.trace, revision: 1, createdAt: now, updatedAt: now,
      }), eventWrite, outboxWrite,
    ]);
  } else {
    const current = await readObligation(command.tenantId, command.matterId, command.obligationId);
    if (!current || current.status !== "open" || current.revision !== command.expectedRevision) throw new Error("Obligation changed; refresh before retrying");
    const patch = transitionPatch(command, input.actor.userId, now, current.revision + 1);
    await db.batch([
      db.update(obligations).set(patch).where(and(eq(obligations.tenantId, command.tenantId), eq(obligations.matterId, command.matterId), eq(obligations.id, command.obligationId), eq(obligations.status, "open"), eq(obligations.revision, command.expectedRevision))),
      eventWrite, outboxWrite,
    ]);
  }
  return { replayed: false };
}

function transitionPatch(command: Exclude<ObligationCommand, { action: "create" }>, actorId: string, now: Date, revision: number) {
  if (command.action === "reassign") return { ownerId: command.ownerId, revision, updatedAt: now };
  if (command.action === "complete") return { status: "completed" as ObligationStatus, completedBy: actorId, completedAt: now, completionEvidence: command.evidence, revision, updatedAt: now };
  return { status: "cancelled" as ObligationStatus, cancelledBy: actorId, cancelledAt: now, cancellationReason: command.reason, revision, updatedAt: now };
}

function dateOnly(value: string) { return new Date(`${value}T17:00:00.000Z`); }
