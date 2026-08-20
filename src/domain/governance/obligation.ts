import { z } from "zod";
import { createEvent } from "@/platform/events";
import { authorizeMatter, requireRole, type TenantContext } from "@/platform/tenant-context";
import type { DeadlineResult } from "./deadline";

export type ObligationStatus = "open" | "completed" | "cancelled";
export type GovernanceContentStatus = "synthetic_sandbox" | "pending_attorney_review" | "attorney_approved";

export const obligationCommand = z.discriminatedUnion("action", [
  z.object({ action: z.literal("create"), tenantId: z.string().min(1), matterId: z.string().min(1), ruleCode: z.string().min(1), title: z.string().trim().min(5).max(160), requirement: z.string().trim().min(8).max(800), triggerDate: z.iso.date(), triggerSourceType: z.enum(["document", "proceeding", "communication", "firm_workflow"]), triggerSourceId: z.string().min(1).max(160), ownerId: z.string().min(1).max(160), sandboxAcknowledged: z.boolean().default(false), idempotencyKey: z.string().min(8).max(200) }),
  z.object({ action: z.literal("reassign"), tenantId: z.string().min(1), matterId: z.string().min(1), obligationId: z.string().min(1), expectedRevision: z.number().int().positive(), ownerId: z.string().min(1).max(160), reason: z.string().trim().min(8).max(500), idempotencyKey: z.string().min(8).max(200) }),
  z.object({ action: z.literal("complete"), tenantId: z.string().min(1), matterId: z.string().min(1), obligationId: z.string().min(1), expectedRevision: z.number().int().positive(), evidence: z.string().trim().min(8).max(1000), idempotencyKey: z.string().min(8).max(200) }),
  z.object({ action: z.literal("cancel"), tenantId: z.string().min(1), matterId: z.string().min(1), obligationId: z.string().min(1), expectedRevision: z.number().int().positive(), reason: z.string().trim().min(8).max(1000), idempotencyKey: z.string().min(8).max(200) }),
]);

export type ObligationCommand = z.infer<typeof obligationCommand>;

export function decideObligation(input: {
  context: TenantContext;
  raw: unknown;
  current?: { status: ObligationStatus; revision: number; ownerId: string } | null;
  rule?: { code: string; version: number; contentStatus: GovernanceContentStatus } | null;
  deadline?: DeadlineResult;
}) {
  const command = obligationCommand.parse(input.raw);
  authorizeMatter(input.context, command.tenantId, command.matterId);
  requireRole(input.context, command.action === "reassign" ? ["attorney", "partner", "docketing_specialist"] : ["attorney", "partner"]);

  if (command.action === "create") {
    if (!input.rule || !input.deadline || input.rule.code !== command.ruleCode) throw new Error("An active versioned rule is required");
    if (input.rule.contentStatus === "pending_attorney_review") throw new Error("Rule content is pending California attorney review");
    if (input.rule.contentStatus === "synthetic_sandbox" && !command.sandboxAcknowledged) throw new Error("Synthetic sandbox status must be acknowledged");
  } else {
    if (!input.current) throw new Error("Obligation was not found");
    if (input.current.status !== "open") throw new Error("Only open obligations can be changed");
    if (input.current.revision !== command.expectedRevision) throw new Error("Obligation changed; refresh before retrying");
    if (command.action === "reassign" && input.current.ownerId === command.ownerId) throw new Error("Choose a different owner");
  }

  const aggregateId = command.action === "create" ? command.idempotencyKey : command.obligationId;
  return {
    command,
    event: createEvent({
      eventType: `obligation.${command.action === "cancel" ? "cancelled" : command.action === "complete" ? "completed" : command.action === "reassign" ? "reassigned" : "created"}`,
      tenantId: command.tenantId,
      aggregateType: "obligation",
      aggregateId,
      matterId: command.matterId,
      actorId: input.context.userId,
      correlationId: command.idempotencyKey,
      idempotencyKey: command.idempotencyKey,
      source: "athena.web",
      visibility: "internal",
      payload: { ...command, deadline: input.deadline ?? null, humanAuthorized: true },
    }),
  };
}
