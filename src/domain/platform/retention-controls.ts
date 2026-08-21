import { z } from "zod";
import { createEvent } from "@/platform/events";
import { authorizeMatter, requireRole, type TenantContext } from "@/platform/tenant-context";
import type { RetentionDecision } from "./retention-policy";

export const retentionControlCommand = z.discriminatedUnion("action", [
  z.object({ action: z.literal("place_hold"), tenantId: z.string().min(1), matterId: z.string().min(1), name: z.string().trim().min(5).max(160), reason: z.string().trim().min(12).max(1000), idempotencyKey: z.string().min(8).max(200) }),
  z.object({ action: z.literal("release_hold"), tenantId: z.string().min(1), matterId: z.string().min(1), holdId: z.string().min(1), expectedRevision: z.number().int().positive(), reason: z.string().trim().min(12).max(1000), idempotencyKey: z.string().min(8).max(200) }),
  z.object({ action: z.literal("record_review"), tenantId: z.string().min(1), matterId: z.string().min(1), conclusion: z.enum(["continue_retention", "escalate_for_disposition_review"]), notes: z.string().trim().min(12).max(1000), idempotencyKey: z.string().min(8).max(200) }),
]);
export type RetentionControlCommand = z.infer<typeof retentionControlCommand>;

export function decideRetentionControl(input: { context: TenantContext; raw: unknown; currentHold?: { id: string; status: "active" | "released"; revision: number } | null; evaluation?: RetentionDecision }) {
  const command = retentionControlCommand.parse(input.raw);
  authorizeMatter(input.context, command.tenantId, command.matterId); requireRole(input.context, ["partner", "firm_admin"]);
  if (command.action === "release_hold") {
    if (!input.currentHold || input.currentHold.id !== command.holdId || input.currentHold.status !== "active") throw new Error("No active legal hold exists");
    if (input.currentHold.revision !== command.expectedRevision) throw new Error("Legal hold changed; refresh before retrying");
  }
  if (command.action === "record_review") {
    if (!input.evaluation) throw new Error("Retention evaluation is required");
    if (command.conclusion === "escalate_for_disposition_review" && input.evaluation.outcome !== "eligible_for_review") throw new Error("Disposition cannot be escalated before eligibility or while held");
  }
  const eventType = command.action === "place_hold" ? "retention.legal_hold_placed" : command.action === "release_hold" ? "retention.legal_hold_released" : "retention.review_recorded";
  const aggregateId = command.action === "release_hold" ? command.holdId : command.idempotencyKey;
  return { command, event: createEvent({ eventType, tenantId: command.tenantId, aggregateType: command.action === "record_review" ? "retention_review" : "legal_hold", aggregateId, matterId: command.matterId, actorId: input.context.userId, correlationId: command.idempotencyKey, idempotencyKey: command.idempotencyKey, source: "athena.web", visibility: "restricted", payload: { ...command, evaluation: input.evaluation ?? null, humanAuthorized: true, automaticDeletion: false } }) };
}
