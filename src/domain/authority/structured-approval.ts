import { z } from "zod";
import { createEvent } from "@/platform/events";
import { AuthorizationError, authorizeMatter, requireRole, type TenantContext } from "@/platform/tenant-context";
const id = z.string().min(3).max(160), detail = z.string().trim().min(12).max(2500), revision = z.number().int().positive();
const base = { tenantId: z.string().min(1), matterId: id, requestId: id, idempotencyKey: z.string().min(8).max(200) };
export const structuredAuthorityCommand = z.discriminatedUnion("action", [
  z.object({ action: z.literal("create_request"), ...base, requestedAmountCents: z.number().int().positive(), currency: z.literal("USD"), settlementStructure: z.enum(["C&R", "stipulations", "either"]), scope: detail, includes: z.array(z.string().min(2).max(160)).max(30), excludes: z.array(z.string().min(2).max(160)).max(30), conditions: z.array(z.string().min(3).max(500)).max(30), examinerName: z.string().min(3).max(200), examinerEmail: z.string().email(), examinerOrganization: z.string().min(3).max(200), requestedExpiresAt: z.string().datetime(), sandboxAcknowledged: z.literal(true) }),
  z.object({ action: z.literal("approve_request"), ...base, expectedRevision: revision, reason: detail }),
  z.object({ action: z.literal("attempt_delivery"), ...base, expectedRevision: revision, reason: detail }),
  z.object({ action: z.literal("record_human_response"), ...base, expectedRevision: revision, responseId: id, outcome: z.enum(["approved", "modified", "declined"]), amountCents: z.number().int().positive().optional(), currency: z.literal("USD"), settlementStructure: z.enum(["C&R", "stipulations", "either"]).optional(), scope: detail.optional(), includes: z.array(z.string().min(2).max(160)).max(30).default([]), excludes: z.array(z.string().min(2).max(160)).max(30).default([]), conditions: z.array(z.string().min(3).max(500)).max(30).default([]), negotiationThresholdCents: z.number().int().positive().optional(), responderName: z.string().min(3).max(200), responderRole: z.string().min(3).max(120), responderOrganization: z.string().min(3).max(200), effectiveAt: z.string().datetime().optional(), expiresAt: z.string().datetime().optional(), evidence: detail }),
  z.object({ action: z.literal("confirm_response"), ...base, expectedRevision: revision, responseId: id, ledgerId: id, candidateId: id, expirationTaskId: id, reason: detail }),
]);
export type StructuredAuthorityCommand = z.infer<typeof structuredAuthorityCommand>;
export type StructuredAuthorityStatus = "draft" | "approved_for_delivery" | "delivery_blocked" | "response_recorded" | "declined" | "confirmed";
export type StructuredAuthorityState = { id: string; status: StructuredAuthorityStatus; revision: number; requestedExpiresAt: Date };
export type StructuredAuthorityResponseState = { id: string; outcome: "approved" | "modified" | "declined"; amountCents: number | null; settlementStructure: string | null; scope: string | null; effectiveAt: Date | null; expiresAt: Date | null; negotiationThresholdCents: number | null };
export function decideStructuredAuthority(input: { context: TenantContext; raw: unknown; current?: StructuredAuthorityState | null; response?: StructuredAuthorityResponseState | null; now?: Date }) {
  const command = structuredAuthorityCommand.parse(input.raw), now = input.now ?? new Date();
  if (command.tenantId !== input.context.tenantId) throw new AuthorizationError(); authorizeMatter(input.context, command.tenantId, command.matterId); requireRole(input.context, ["attorney", "partner"]);
  let fromStatus = "not_created", toStatus: StructuredAuthorityStatus = "draft";
  if (command.action === "create_request") { if (input.current) throw new Error("Authority approval request identity already exists"); if (new Date(command.requestedExpiresAt) <= now) throw new Error("Authority request expiry must be in the future"); }
  else {
    const current = input.current; if (!current || current.revision !== command.expectedRevision) throw new Error("Authority approval request changed; refresh before retrying"); if (current.requestedExpiresAt <= now) throw new Error("Authority approval request has expired"); fromStatus = current.status;
    if (command.action === "approve_request") { if (current.status !== "draft") throw new Error(`approve_request is not allowed from ${current.status}`); toStatus = "approved_for_delivery"; }
    else if (command.action === "attempt_delivery") { if (current.status !== "approved_for_delivery") throw new Error(`attempt_delivery is not allowed from ${current.status}`); toStatus = "delivery_blocked"; }
    else if (command.action === "record_human_response") {
      if (current.status !== "delivery_blocked") throw new Error(`record_human_response is not allowed from ${current.status}`);
      if (command.outcome !== "declined") {
        if (!command.amountCents || !command.settlementStructure || !command.scope || !command.effectiveAt) throw new Error("Approved or modified response requires complete authority terms");
        if (command.negotiationThresholdCents && command.negotiationThresholdCents > command.amountCents) throw new Error("Negotiation threshold cannot exceed approved authority");
        if (command.expiresAt && command.expiresAt < command.effectiveAt) throw new Error("Authority expiration cannot precede its effective date");
      }
      toStatus = command.outcome === "declined" ? "declined" : "response_recorded";
    } else {
      if (current.status !== "response_recorded") throw new Error(`confirm_response is not allowed from ${current.status}`);
      const response = input.response; if (!response || response.id !== command.responseId || response.outcome === "declined" || !response.amountCents || !response.settlementStructure || !response.scope || !response.effectiveAt) throw new Error("Complete verified approval response is required");
      toStatus = "confirmed";
    }
  }
  return { command, fromStatus, toStatus, event: createEvent({
    eventType: `authority_approval.${command.action}`, tenantId: command.tenantId, aggregateType: "authority_approval_request", aggregateId: command.requestId,
    matterId: command.matterId, actorId: input.context.userId, correlationId: command.requestId, causationId: command.idempotencyKey, idempotencyKey: command.idempotencyKey,
    source: "athena.web", visibility: "restricted", retentionPolicy: "matter-lifecycle-plus-firm-retention",
    payload: { action: command.action, fromStatus, toStatus, secureApprovalPageEnabled: false, deliveryAttempted: false, humanVerifiedExternalResponse: command.action === "record_human_response", humanAuthorized: true, recalculatesSettlementReadiness: command.action === "confirm_response" },
  }) };
}
