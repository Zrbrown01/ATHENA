import { z } from "zod";
import { createEvent } from "@/platform/events";
import { authorizeMatter, requireRole, type TenantContext } from "@/platform/tenant-context";

export const supportAccessCommand = z.discriminatedUnion("action", [
  z.object({ action: z.literal("grant"), tenantId: z.string().min(1), matterId: z.string().min(1), supportUserId: z.string().min(3).max(160), purpose: z.string().trim().min(12).max(500), ticketReference: z.string().trim().min(4).max(120), durationMinutes: z.number().int().min(15).max(240), idempotencyKey: z.string().min(8).max(200) }),
  z.object({ action: z.literal("revoke"), tenantId: z.string().min(1), matterId: z.string().min(1), supportUserId: z.string().min(3).max(160), reason: z.string().trim().min(12).max(500), expectedRevision: z.number().int().positive(), idempotencyKey: z.string().min(8).max(200) }),
]);
export type SupportAccessCommand = z.infer<typeof supportAccessCommand>;

export function decideSupportAccess(context: TenantContext, raw: unknown, current?: { status: "active" | "revoked"; revision: number; expiresAt: Date } | null, now = new Date()) {
  const command = supportAccessCommand.parse(raw);
  authorizeMatter(context, command.tenantId, command.matterId);
  requireRole(context, ["partner", "firm_admin"]);
  if (command.supportUserId === context.userId) throw new Error("Approvers cannot grant support access to themselves");
  if (command.action === "grant" && current?.status === "active" && current.expiresAt > now) throw new Error("An active support grant already exists");
  if (command.action === "revoke" && (!current || current.status !== "active" || current.expiresAt <= now)) throw new Error("No active support grant exists");
  if (command.action === "revoke" && current?.revision !== command.expectedRevision) throw new Error("Support grant changed; refresh before retrying");
  const expiresAt = command.action === "grant" ? new Date(now.getTime() + command.durationMinutes * 60_000) : null;
  return { command, expiresAt, event: createEvent({ eventType: command.action === "grant" ? "support.access_granted" : "support.access_revoked", tenantId: command.tenantId, aggregateType: "support_access_grant", aggregateId: `${command.matterId}:${command.supportUserId}`, matterId: command.matterId, actorId: context.userId, correlationId: command.idempotencyKey, idempotencyKey: command.idempotencyKey, source: "athena.web", visibility: "restricted", payload: { ...command, expiresAt: expiresAt?.toISOString() ?? null, humanAuthorized: true } }) };
}

export const accessReviewCommand = z.object({ action: z.literal("attest_review"), tenantId: z.string().min(1), periodStartedAt: z.iso.datetime(), periodEndedAt: z.iso.datetime(), outcome: z.enum(["certified", "exceptions_noted"]), notes: z.string().trim().min(12).max(1000), idempotencyKey: z.string().min(8).max(200) });

export function decideAccessReview(context: TenantContext, raw: unknown) {
  const command = accessReviewCommand.parse(raw);
  if (command.tenantId !== context.tenantId) throw new Error("Access review tenant mismatch");
  requireRole(context, ["partner", "firm_admin"]);
  if (new Date(command.periodStartedAt) >= new Date(command.periodEndedAt)) throw new Error("Review period end must follow its start");
  return { command, event: createEvent({ eventType: "access.review_attested", tenantId: command.tenantId, aggregateType: "access_review", aggregateId: command.idempotencyKey, actorId: context.userId, correlationId: command.idempotencyKey, idempotencyKey: command.idempotencyKey, source: "athena.web", visibility: "restricted", payload: { ...command, humanAuthorized: true } }) };
}
