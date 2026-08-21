import type { RequestActor } from "./request-actor";
import type { TenantContext } from "./tenant-context";

export const PILOT_TENANT_ID = "tenant-golden";
export const GOLDEN_MATTER_ID = "matter-golden-001";

export function pilotContext(actor: RequestActor): TenantContext {
  if (configuredUserIds("ATHENA_PILOT_SUPPORT_USER_IDS").has(actor.userId)) {
    return { tenantId: PILOT_TENANT_ID, userId: actor.userId, roles: ["support"], matterAccess: new Set() };
  }

  const partnerUserIds = configuredUserIds("ATHENA_PILOT_PARTNER_USER_IDS");
  if (process.env.NODE_ENV !== "production") {
    partnerUserIds.add("user-maya-chen");
    partnerUserIds.add("user-client-reviewer");
  }

  if (!partnerUserIds.has(actor.userId)) {
    return {
      tenantId: PILOT_TENANT_ID,
      userId: actor.userId,
      roles: [],
      matterAccess: new Set(),
    };
  }

  return {
    tenantId: PILOT_TENANT_ID,
    userId: actor.userId,
    roles: ["attorney", "partner"],
    matterAccess: new Set([GOLDEN_MATTER_ID]),
  };
}

export function scopedSupportContext(actor: RequestActor, matterId: string): TenantContext {
  return { tenantId: PILOT_TENANT_ID, userId: actor.userId, roles: ["support"], matterAccess: new Set([matterId]) };
}

function configuredUserIds(key: string): Set<string> {
  return new Set(
    (process.env[key] ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  );
}
