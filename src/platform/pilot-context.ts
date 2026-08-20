import type { RequestActor } from "./request-actor";
import type { TenantContext } from "./tenant-context";

export const PILOT_TENANT_ID = "tenant-golden";
export const GOLDEN_MATTER_ID = "matter-golden-001";

export function pilotContext(actor: RequestActor): TenantContext {
  return {
    tenantId: PILOT_TENANT_ID,
    userId: actor.userId,
    roles: ["attorney", "partner"],
    matterAccess: new Set([GOLDEN_MATTER_ID]),
  };
}
