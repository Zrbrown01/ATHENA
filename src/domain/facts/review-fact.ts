import { z } from "zod";
import { authorizeMatter, requireRole, type TenantContext } from "@/platform/tenant-context";
import { createEvent } from "@/platform/events";

export const reviewFactCommand = z.object({
  tenantId: z.string().min(1),
  matterId: z.string().min(1),
  factId: z.string().min(1),
  decision: z.enum(["verified", "rejected"]),
  editedValue: z.string().trim().min(1).optional(),
  reason: z.string().trim().min(1).optional(),
  idempotencyKey: z.string().min(8).max(200),
});

export type ReviewFactCommand = z.infer<typeof reviewFactCommand>;

export function reviewFact(context: TenantContext, rawCommand: unknown) {
  const command = reviewFactCommand.parse(rawCommand);
  authorizeMatter(context, command.tenantId, command.matterId);
  requireRole(context, ["attorney", "partner", "paralegal"]);

  return createEvent({
    eventType: command.decision === "verified" ? "fact.verified" : "fact.rejected",
    tenantId: command.tenantId,
    aggregateType: "fact_observation",
    aggregateId: command.factId,
    matterId: command.matterId,
    actorId: context.userId,
    correlationId: command.idempotencyKey,
    idempotencyKey: command.idempotencyKey,
    source: "athena.web",
    visibility: "internal",
    payload: {
      decision: command.decision,
      editedValue: command.editedValue ?? null,
      reason: command.reason ?? null,
      humanAuthorized: true,
    },
  });
}
