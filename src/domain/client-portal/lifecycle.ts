import { z } from "zod";
import { classificationLabel, evaluateClassification } from "@/domain/classification/policy";
import { createEvent } from "@/platform/events";
import { AuthorizationError, authorizeMatter, requireRole, type TenantContext } from "@/platform/tenant-context";

const id = z.string().min(3).max(160), detail = z.string().trim().min(12).max(2000), revision = z.number().int().positive();
const base = { tenantId: z.string().min(1), matterId: id, accessRequestId: id, idempotencyKey: z.string().min(8).max(200) };
export const clientPortalCommand = z.discriminatedUnion("action", [
  z.object({ action: z.literal("request_access"), ...base, clientOrganizationId: id, contactName: z.string().trim().min(3).max(200), contactEmail: z.string().email(), purpose: detail, requestedExpiresAt: z.string().datetime(), sandboxAcknowledged: z.literal(true) }),
  z.object({ action: z.literal("verify_identity"), ...base, expectedRevision: revision, evidence: detail }),
  z.object({ action: z.literal("approve_access"), ...base, expectedRevision: revision, reason: detail }),
  z.object({ action: z.literal("evaluate_share_item"), ...base, expectedRevision: revision, shareItemId: id, resourceType: z.string().min(3).max(80), resourceId: id, title: z.string().trim().min(4).max(240), labels: z.array(classificationLabel).min(1).max(12), reason: detail }),
  z.object({ action: z.literal("attempt_activation"), ...base, expectedRevision: revision, reason: detail }),
  z.object({ action: z.literal("revoke_access"), ...base, expectedRevision: revision, reason: detail }),
]);
export type ClientPortalCommand = z.infer<typeof clientPortalCommand>;
export type ClientPortalStatus = "requested" | "identity_verified" | "approved" | "activation_blocked" | "revoked";
export type ClientPortalState = { id: string; status: ClientPortalStatus; revision: number; requestedExpiresAt: Date };

export function decideClientPortal(input: { context: TenantContext; raw: unknown; current?: ClientPortalState | null; now?: Date }) {
  const command = clientPortalCommand.parse(input.raw), now = input.now ?? new Date();
  if (command.tenantId !== input.context.tenantId) throw new AuthorizationError();
  authorizeMatter(input.context, command.tenantId, command.matterId);
  let fromStatus = "not_created", toStatus: ClientPortalStatus = "requested";
  let shareDecision: ReturnType<typeof evaluateClassification> | null = null;
  if (command.action === "request_access") {
    if (input.current) throw new Error("Portal access request identity already exists");
    if (new Date(command.requestedExpiresAt) <= now) throw new Error("Portal access expiry must be in the future");
  } else {
    const current = input.current;
    if (!current || current.revision !== command.expectedRevision) throw new Error("Portal access request changed; refresh before retrying");
    if (current.requestedExpiresAt <= now) throw new Error("Portal access request has expired");
    fromStatus = current.status;
    if (command.action === "verify_identity") {
      if (current.status !== "requested") throw new Error(`verify_identity is not allowed from ${current.status}`);
      toStatus = "identity_verified";
    } else if (command.action === "approve_access") {
      requireRole(input.context, ["attorney", "partner"]);
      if (current.status !== "identity_verified") throw new Error(`approve_access is not allowed from ${current.status}`);
      toStatus = "approved";
    } else if (command.action === "evaluate_share_item") {
      requireRole(input.context, ["attorney", "partner"]);
      if (current.status !== "approved") throw new Error(`evaluate_share_item is not allowed from ${current.status}`);
      shareDecision = evaluateClassification({ context: input.context, tenantId: command.tenantId, matterId: command.matterId, plane: "sharing", labels: command.labels, now });
      toStatus = "approved";
    } else if (command.action === "attempt_activation") {
      requireRole(input.context, ["attorney", "partner"]);
      if (current.status !== "approved") throw new Error(`attempt_activation is not allowed from ${current.status}`);
      toStatus = "activation_blocked";
    } else {
      requireRole(input.context, ["attorney", "partner"]);
      if (!["approved", "activation_blocked"].includes(current.status)) throw new Error(`revoke_access is not allowed from ${current.status}`);
      toStatus = "revoked";
    }
  }
  return { command, fromStatus, toStatus, shareDecision, event: createEvent({
    eventType: `client_portal.${command.action}`, tenantId: command.tenantId, aggregateType: "client_portal_access", aggregateId: command.accessRequestId,
    matterId: command.matterId, actorId: input.context.userId, correlationId: command.accessRequestId, causationId: command.idempotencyKey,
    idempotencyKey: command.idempotencyKey, source: "athena.web", visibility: "restricted", retentionPolicy: "matter-lifecycle-plus-firm-retention",
    payload: { action: command.action, fromStatus, toStatus, externalLoginEnabled: false, identityProviderConnected: false, invitationSent: false, shareOutcome: shareDecision?.outcome ?? null, humanAuthorized: ["approve_access", "evaluate_share_item", "attempt_activation", "revoke_access"].includes(command.action) },
  }) };
}
