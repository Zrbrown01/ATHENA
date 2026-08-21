import { z } from "zod";
import { createEvent } from "@/platform/events";
import { authorizeMatter, requireRole, type TenantContext } from "@/platform/tenant-context";
import { SYNTHETIC_CLIENT_INSTRUCTION_SHA256 } from "./synthetic-client-instruction";
const id = z.string().trim().min(3).max(160), evidence = z.string().trim().min(12).max(1500);
const base = { tenantId: id, matterId: id, instructionId: id, idempotencyKey: z.string().min(8).max(200) };
export const clientInstructionCommand = z.discriminatedUnion("action", [
  z.object({ action: z.literal("materialize_synthetic_source"), ...base, evidenceId: id, clientId: z.literal("client-summit"), code: z.string().regex(/^synthetic-client-status-report-deadline(?:-[a-z0-9-]+)?$/).max(120), version: z.literal(1), title: z.string().min(8).max(240), businessDays: z.number().int().min(0).max(365), authorityCitation: evidence, effectiveDate: z.iso.date(), reviewDate: z.iso.date(), sandboxAcknowledged: z.literal(true) }),
  z.object({ action: z.literal("review_source"), ...base, expectedRevision: z.number().int().positive(), reviewId: id, reviewType: z.enum(["source_integrity", "instruction_scope"]), outcome: z.enum(["approved", "rejected"]), evidence }),
  z.object({ action: z.literal("activate_source"), ...base, expectedRevision: z.number().int().positive(), layerId: id, approval: evidence }),
  z.object({ action: z.literal("deactivate_source"), ...base, expectedRevision: z.number().int().positive(), reason: evidence }),
]);
export type ClientInstructionCommand = z.infer<typeof clientInstructionCommand>;
export type ClientInstructionState = { id: string; clientId: string; evidenceId: string; code: string; version: number; sourceSha256: string; sourceMode: "deterministic_sandbox" | "verified_evidence"; status: "registered" | "under_review" | "ready_for_activation" | "synthetic_active" | "verified_active" | "deactivated"; revision: number; businessDays: number; authorityCitation: string; effectiveAt: Date; reviewBy: Date; activatedLayerId: string | null };
export type ClientInstructionReviewState = { reviewType: "source_integrity" | "instruction_scope"; outcome: "approved" | "rejected"; reviewerId: string; sourceSha256: string };

export function decideClientInstruction(input: { context: TenantContext; raw: unknown; current?: ClientInstructionState | null; reviews?: ClientInstructionReviewState[] }) {
  const command = clientInstructionCommand.parse(input.raw); authorizeMatter(input.context, command.tenantId, command.matterId);
  requireRole(input.context, command.action === "review_source" ? ["attorney", "partner"] : ["partner"]);
  if (command.action === "materialize_synthetic_source") {
    if (input.current) throw new Error("Client instruction identity already exists");
    if (command.reviewDate <= command.effectiveDate) throw new Error("Client instruction review date must follow its effective date");
    return decision(command, "not_created", "registered", input.context.userId, false);
  }
  const current = input.current, reviews = input.reviews ?? [];
  if (!current || current.id !== command.instructionId) throw new Error("Client instruction source does not exist in this matter scope");
  if (current.revision !== command.expectedRevision) throw new Error("Client instruction changed; refresh before retrying");
  if (current.status === "deactivated") throw new Error("Client instruction is deactivated");
  let toStatus: ClientInstructionState["status"] = current.status;
  if (command.action === "review_source") {
    if (!(["registered", "under_review"] as string[]).includes(current.status)) throw new Error("Client instruction is not awaiting review");
    if (current.sourceSha256 !== SYNTHETIC_CLIENT_INSTRUCTION_SHA256 || reviews.some(review => review.sourceSha256 !== current.sourceSha256)) throw new Error("Client instruction checksum identity changed");
    if (reviews.some(review => review.reviewType === command.reviewType)) throw new Error("This review type is already recorded");
    if (reviews.some(review => review.reviewerId === input.context.userId)) throw new Error("Independent client-instruction reviews require distinct reviewers");
    toStatus = command.outcome === "rejected" ? "deactivated" : reviews.length === 1 ? "ready_for_activation" : "under_review";
  } else if (command.action === "activate_source") {
    if (current.status !== "ready_for_activation") throw new Error("Client instruction requires both independent approvals");
    const approved = reviews.filter(review => review.outcome === "approved");
    if (approved.length !== 2 || new Set(approved.map(review => review.reviewType)).size !== 2 || new Set(approved.map(review => review.reviewerId)).size !== 2 || approved.some(review => review.sourceSha256 !== current.sourceSha256)) throw new Error("Client instruction review evidence is incomplete or not independent");
    toStatus = current.sourceMode === "verified_evidence" ? "verified_active" : "synthetic_active";
  } else {
    if (!(["synthetic_active", "verified_active"] as string[]).includes(current.status)) throw new Error("Only an active client instruction can be deactivated");
    toStatus = "deactivated";
  }
  return decision(command, current.status, toStatus, input.context.userId, current.sourceMode === "verified_evidence" && toStatus === "verified_active");
}

function decision(command: ClientInstructionCommand, fromStatus: string, toStatus: string, actorId: string, verifiedActivated: boolean) {
  return { command, fromStatus, toStatus, event: createEvent({ eventType: `client_instruction.${command.action}`, tenantId: command.tenantId, aggregateType: "client_instruction", aggregateId: command.instructionId, matterId: command.matterId, actorId, correlationId: command.idempotencyKey, idempotencyKey: command.idempotencyKey, source: "athena.web", visibility: "restricted", retentionPolicy: "matter-lifecycle-plus-firm-retention", payload: { action: command.action, fromStatus, toStatus, humanAuthorized: true, sourceChecksumPinned: true, independentReviewRequired: true, verifiedClientInstructionActivated: verifiedActivated, syntheticInstructionActivated: toStatus === "synthetic_active" } }) };
}
