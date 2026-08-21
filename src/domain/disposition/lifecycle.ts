import { z } from "zod";
import { createEvent } from "@/platform/events";
import {
  AuthorizationError,
  requireRole,
  type TenantContext,
} from "@/platform/tenant-context";
const id = z.string().min(3).max(160),
  detail = z.string().trim().min(12).max(2000),
  base = {
    tenantId: z.string().min(1),
    matterId: id,
    requestId: id,
    idempotencyKey: z.string().min(8).max(200),
  },
  rev = z.number().int().positive();
export const dispositionCommand = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("materialize_sandbox_candidate"),
    ...base,
    targetId: id,
    payload: detail,
    syntheticDisposable: z.literal(true),
  }),
  z.object({
    action: z.literal("preview_disposition"),
    ...base,
    expectedRevision: rev,
    reason: detail,
  }),
  z.object({
    action: z.literal("approve_disposition"),
    ...base,
    expectedRevision: rev,
    approvalId: id,
    notes: detail,
  }),
  z.object({
    action: z.literal("execute_disposition"),
    ...base,
    expectedRevision: rev,
    executionId: id,
    confirmation: z.literal("DELETE_SYNTHETIC_DISPOSABLE_RECORD_ONLY"),
    reason: detail,
  }),
]);
export type DispositionCommand = z.infer<typeof dispositionCommand>;
export type DispositionState = {
  id: string;
  status:
    | "draft"
    | "blocked_by_hold"
    | "ready_for_approval"
    | "pending_second_approval"
    | "approved"
    | "executed"
    | "cancelled";
  revision: number;
  requestedBy: string;
  targetId: string;
};
export type ApprovalState = {
  approverId: string;
  outcome: "approved" | "rejected";
};
export function decideDisposition(input: {
  context: TenantContext;
  raw: unknown;
  request?: DispositionState | null;
  targetExists?: boolean;
  targetSyntheticDisposable?: boolean;
  legalHoldCount?: number;
  approvals?: ApprovalState[];
}) {
  const c = dispositionCommand.parse(input.raw);
  if (c.tenantId !== input.context.tenantId) throw new AuthorizationError();
  requireRole(input.context, ["partner", "security_admin"]);
  let fromStatus = "not_created",
    toStatus = "draft";
  if (c.action === "materialize_sandbox_candidate") {
    if (input.targetExists || input.request)
      throw new Error("Disposition candidate identity already exists");
  } else {
    const r = input.request;
    if (!r || r.id !== c.requestId || r.revision !== c.expectedRevision)
      throw new Error("Disposition request changed; refresh before retrying");
    fromStatus = r.status;
    if (c.action === "preview_disposition") {
      if (r.status !== "draft")
        throw new Error(`preview_disposition is not allowed from ${r.status}`);
      if (!input.targetExists || !input.targetSyntheticDisposable)
        throw new Error(
          "Only an existing synthetic disposable target may enter this proof",
        );
      toStatus =
        (input.legalHoldCount ?? 0) > 0
          ? "blocked_by_hold"
          : "ready_for_approval";
    } else if (c.action === "approve_disposition") {
      if (!["ready_for_approval", "pending_second_approval"].includes(r.status))
        throw new Error(`approve_disposition is not allowed from ${r.status}`);
      if (input.context.userId === r.requestedBy)
        throw new Error("The requester cannot approve disposition");
      const approvals = input.approvals ?? [];
      if (approvals.some((x) => x.approverId === input.context.userId))
        throw new Error("Two distinct approvers are required");
      toStatus =
        approvals.filter((x) => x.outcome === "approved").length === 0
          ? "pending_second_approval"
          : "approved";
    } else {
      if (r.status !== "approved")
        throw new Error(`execute_disposition is not allowed from ${r.status}`);
      if (
        (input.approvals ?? []).filter((x) => x.outcome === "approved")
          .length !== 2
      )
        throw new Error("Exactly two approvals are required before execution");
      if (!input.targetExists || !input.targetSyntheticDisposable)
        throw new Error(
          "Execution target is missing or not synthetic disposable",
        );
      toStatus = "executed";
    }
  }
  return {
    command: c,
    fromStatus,
    toStatus,
    event: createEvent({
      eventType: `disposition.${c.action}`,
      tenantId: c.tenantId,
      aggregateType: "disposition_request",
      aggregateId: c.requestId,
      matterId: c.matterId,
      actorId: input.context.userId,
      correlationId: c.idempotencyKey,
      idempotencyKey: c.idempotencyKey,
      source: "athena.web",
      visibility: "restricted",
      retentionPolicy: "security-permanent",
      payload: {
        action: c.action,
        fromStatus,
        toStatus,
        humanAuthorized: true,
        syntheticDisposableOnly: true,
        auditAndEventsPreserved: true,
      },
    }),
  };
}
