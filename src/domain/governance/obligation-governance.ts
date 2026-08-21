import { z } from "zod";
import { createEvent } from "@/platform/events";
import {
  authorizeMatter,
  requireRole,
  type TenantContext,
} from "@/platform/tenant-context";

const id = z.string().min(3).max(160);
const evidence = z.string().trim().min(12).max(1500);
const revision = z.number().int().positive();
const base = {
  tenantId: z.string().min(1),
  matterId: z.string().min(1),
  idempotencyKey: z.string().min(8).max(200),
};

export const obligationGovernanceCommand = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("create_dependent"),
    ...base,
    predecessorObligationId: id,
    expectedPredecessorRevision: revision,
    dependentObligationId: id,
    dependencyId: id,
    relationType: z.enum(["preparation_before", "follow_up_after"]),
    offsetBusinessDays: z.number().int().min(1).max(60),
    title: z.string().trim().min(5).max(160),
    requirement: z.string().trim().min(8).max(800),
    ownerId: id,
    reason: evidence,
  }),
  z
    .object({
      action: z.literal("request_exception"),
      ...base,
      obligationId: id,
      expectedRevision: revision,
      exceptionId: id,
      exceptionType: z.enum(["due_date_exception", "waiver"]),
      proposedDueDate: z.iso.date().nullable(),
      reason: evidence,
      authorityBasis: evidence,
    })
    .superRefine((value, context) => {
      if (
        (value.exceptionType === "due_date_exception") !==
        Boolean(value.proposedDueDate)
      )
        context.addIssue({
          code: "custom",
          path: ["proposedDueDate"],
          message:
            "A due-date exception requires a proposed date; a waiver cannot provide one",
        });
    }),
  z.object({
    action: z.literal("decide_exception"),
    ...base,
    obligationId: id,
    expectedRevision: revision,
    exceptionId: id,
    expectedExceptionRevision: revision,
    outcome: z.enum(["approved", "denied"]),
    decisionReason: evidence,
  }),
  z.object({
    action: z.literal("evaluate_escalation"),
    ...base,
    obligationId: id,
    expectedRevision: revision,
    escalationId: id,
    asOfDate: z.iso.date(),
  }),
  z.object({
    action: z.literal("acknowledge_escalation"),
    ...base,
    obligationId: id,
    escalationId: id,
    expectedEscalationRevision: revision,
    response: evidence,
  }),
]);

export type ObligationGovernanceCommand = z.infer<
  typeof obligationGovernanceCommand
>;

export type GovernedObligationState = {
  id: string;
  status: "open" | "completed" | "cancelled" | "waived";
  revision: number;
  dueAt: Date;
  ruleId: string;
  ruleCode: string;
  ruleVersion: number;
  authorityCitation: string;
  triggerAt: Date;
  triggerSourceType: string;
  triggerSourceId: string;
  calculation: string[];
};

export type ObligationExceptionState = {
  id: string;
  obligationId: string;
  exceptionType: "due_date_exception" | "waiver";
  status: "requested" | "approved" | "denied" | "revoked";
  proposedDueAt: Date | null;
  revision: number;
};

export type ObligationEscalationState = {
  id: string;
  obligationId: string;
  status: "open" | "acknowledged";
  revision: number;
};

export type EscalationEvaluation = {
  level: "attention" | "critical" | "breached";
  businessDaysRemaining: number;
  basis: string;
};

export function decideObligationGovernance(input: {
  context: TenantContext;
  raw: unknown;
  current?: GovernedObligationState | null;
  exception?: ObligationExceptionState | null;
  escalation?: ObligationEscalationState | null;
  pendingExceptionCount?: number;
  evaluation?: EscalationEvaluation | null;
}) {
  const command = obligationGovernanceCommand.parse(input.raw);
  authorizeMatter(input.context, command.tenantId, command.matterId);
  requireRole(
    input.context,
    command.action === "decide_exception"
      ? ["partner"]
      : ["attorney", "partner", "docketing_specialist"],
  );

  if (command.action === "acknowledge_escalation") {
    if (
      !input.escalation ||
      input.escalation.id !== command.escalationId ||
      input.escalation.obligationId !== command.obligationId ||
      input.escalation.revision !== command.expectedEscalationRevision
    )
      throw new Error("Escalation changed; refresh before retrying");
    if (input.escalation.status !== "open")
      throw new Error("Only an open escalation can be acknowledged");
  } else {
    const current = input.current;
    const expectedRevision =
      command.action === "create_dependent"
        ? command.expectedPredecessorRevision
        : command.expectedRevision;
    const expectedId =
      command.action === "create_dependent"
        ? command.predecessorObligationId
        : command.obligationId;
    if (
      !current ||
      current.id !== expectedId ||
      current.revision !== expectedRevision
    )
      throw new Error("Obligation changed; refresh before retrying");
    if (current.status !== "open")
      throw new Error("Only an open obligation can use governance controls");

    if (command.action === "request_exception") {
      if ((input.pendingExceptionCount ?? 0) > 0)
        throw new Error("Resolve the existing exception request first");
      if (
        command.proposedDueDate &&
        command.proposedDueDate <= current.dueAt.toISOString().slice(0, 10)
      )
        throw new Error("A due-date exception must move the deadline later");
    } else if (command.action === "decide_exception") {
      if (
        !input.exception ||
        input.exception.id !== command.exceptionId ||
        input.exception.obligationId !== command.obligationId ||
        input.exception.revision !== command.expectedExceptionRevision
      )
        throw new Error("Exception request changed; refresh before retrying");
      if (input.exception.status !== "requested")
        throw new Error("Only a requested exception can be decided");
    } else if (command.action === "evaluate_escalation") {
      if ((input.pendingExceptionCount ?? 0) > 0)
        throw new Error("Escalation waits for the pending exception decision");
      if (!input.evaluation)
        throw new Error("The obligation is outside the escalation window");
    }
  }

  const aggregateId =
    command.action === "create_dependent"
      ? command.dependentObligationId
      : command.action === "acknowledge_escalation"
        ? command.escalationId
        : command.obligationId;
  return {
    command,
    event: createEvent({
      eventType: `obligation.${command.action}`,
      tenantId: command.tenantId,
      aggregateType: "obligation",
      aggregateId,
      matterId: command.matterId,
      actorId: input.context.userId,
      correlationId: command.idempotencyKey,
      idempotencyKey: command.idempotencyKey,
      source: "athena.web",
      visibility: "internal",
      retentionPolicy: "matter-lifecycle-plus-firm-retention",
      payload: {
        action: command.action,
        humanAuthorized: true,
        contentStatus: "synthetic_sandbox",
        californiaLegalContentApproved: false,
        escalation: input.evaluation ?? null,
      },
    }),
  };
}
