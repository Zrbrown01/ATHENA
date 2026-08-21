import { AuthorizationError, authorizeMatter, type TenantContext } from "./tenant-context";

export const matterDataPlanes = ["api", "object", "export", "job", "event", "search", "ai_retrieval", "cache", "support"] as const;
export type MatterDataPlane = typeof matterDataPlanes[number];

export function authorizeMatterDataPlane(input: {
  context: TenantContext;
  tenantId: string;
  matterId: string;
  plane: MatterDataPlane;
  supportGrant?: { approvedBy: string; expiresAt: Date; matterIds: Set<string> };
  now?: Date;
}) {
  authorizeMatter(input.context, input.tenantId, input.matterId);
  if (input.plane === "support") {
    const grant = input.supportGrant;
    const now = input.now ?? new Date();
    if (!grant || !grant.approvedBy || grant.expiresAt <= now || !grant.matterIds.has(input.matterId)) throw new AuthorizationError("Active matter-scoped support approval is required");
  }
  return { tenantId: input.tenantId, matterId: input.matterId, plane: input.plane };
}
