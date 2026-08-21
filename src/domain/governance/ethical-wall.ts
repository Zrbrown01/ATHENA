import { z } from "zod";
import { createEvent } from "@/platform/events";
import { authorizeMatter, requireRole, type TenantContext } from "@/platform/tenant-context";

export const ethicalWallCommand = z.discriminatedUnion("action", [
  z.object({ action: z.literal("place"), tenantId: z.string().min(1), matterId: z.string().min(1), targetUserId: z.string().min(3).max(160), reason: z.string().trim().min(12).max(1000), expiresAt: z.iso.datetime().optional(), idempotencyKey: z.string().min(8).max(200) }),
  z.object({ action: z.literal("release"), tenantId: z.string().min(1), matterId: z.string().min(1), targetUserId: z.string().min(3).max(160), reason: z.string().trim().min(12).max(1000), expectedRevision: z.number().int().positive(), idempotencyKey: z.string().min(8).max(200) }),
]);

export type EthicalWallCommand = z.infer<typeof ethicalWallCommand>;

export function decideEthicalWall(context: TenantContext, raw: unknown, current?: { status: "active" | "released"; revision: number } | null) {
  const command = ethicalWallCommand.parse(raw);
  authorizeMatter(context, command.tenantId, command.matterId);
  requireRole(context, ["partner", "firm_admin"]);
  if (command.targetUserId === context.userId) throw new Error("Administrators cannot place a wall against their own active session");
  if (command.action === "place" && current?.status === "active") throw new Error("An active ethical wall already exists");
  if (command.action === "release" && (!current || current.status !== "active")) throw new Error("No active ethical wall exists");
  if (command.action === "release" && current?.revision !== command.expectedRevision) throw new Error("Ethical wall changed; refresh before retrying");
  if (command.action === "place" && command.expiresAt && new Date(command.expiresAt) <= new Date()) throw new Error("Expiry must be in the future");
  return {
    command,
    event: createEvent({
      eventType: command.action === "place" ? "matter.ethical_wall_placed" : "matter.ethical_wall_released",
      tenantId: command.tenantId, aggregateType: "matter_access_policy", aggregateId: `${command.matterId}:${command.targetUserId}`,
      matterId: command.matterId, actorId: context.userId, correlationId: command.idempotencyKey, idempotencyKey: command.idempotencyKey,
      source: "athena.web", visibility: "restricted",
      payload: { action: command.action, targetUserId: command.targetUserId, reason: command.reason, expiresAt: command.action === "place" ? command.expiresAt ?? null : null, humanAuthorized: true },
    }),
  };
}
