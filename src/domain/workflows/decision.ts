import { z } from "zod";
import { createEvent } from "@/platform/events";
import { AuthorizationError, authorizeMatter, requireRole, type TenantContext } from "@/platform/tenant-context";

const allowedActions = {
  intake: ["approve_open", "request_information", "reject"],
  authority: ["confirm", "edit_confirm", "not_authority"],
  time: ["confirm", "edit", "reject"],
  report: ["approve", "return_for_revision"],
  filing: ["approve_packet", "return_for_correction"],
} as const;

export const workflowDecisionCommand = z.object({
  tenantId: z.string().min(1).max(120),
  workflowType: z.enum(["intake", "authority", "time", "report", "filing"]),
  aggregateId: z.string().min(1).max(120),
  matterId: z.string().min(1).max(120).optional(),
  action: z.string().min(1).max(60),
  reason: z.string().trim().min(3).max(500).optional(),
  idempotencyKey: z.string().min(8).max(200),
});

const workflowRoles: Record<keyof typeof allowedActions, string[]> = {
  intake: ["attorney", "partner", "paralegal"],
  authority: ["attorney", "partner"],
  time: ["attorney", "partner"],
  report: ["attorney", "partner"],
  filing: ["attorney", "partner", "docketing_specialist"],
};

export function decideWorkflow(context: TenantContext, raw: unknown) {
  const command = workflowDecisionCommand.parse(raw);
  if (command.tenantId !== context.tenantId) throw new AuthorizationError();
  if (command.matterId) authorizeMatter(context, command.tenantId, command.matterId);
  requireRole(context, workflowRoles[command.workflowType]);
  const permitted = allowedActions[command.workflowType] as readonly string[];
  if (!permitted.includes(command.action)) throw new Error("Action is not valid for this workflow");
  return {
    command,
    event: createEvent({
      eventType: `${command.workflowType}.${command.action}`,
      tenantId: command.tenantId, aggregateType: `${command.workflowType}_workflow`,
      aggregateId: command.aggregateId, matterId: command.matterId,
      actorId: context.userId, correlationId: command.idempotencyKey, idempotencyKey: command.idempotencyKey,
      source: "athena.web", visibility: "internal",
      payload: { action: command.action, reason: command.reason ?? null, humanAuthorized: true },
    }),
  };
}
