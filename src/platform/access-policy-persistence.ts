import { createId } from "@paralleldrive/cuid2";
import { and, eq, gt, isNull, or } from "drizzle-orm";
import { getPreviewDb } from "../../db";
import { accessDecisionEvents, matterAccessPolicies } from "../../db/schema";
import { authorizeMatter, authorizeTenantObjectKey, AuthorizationError, type TenantContext } from "./tenant-context";
import type { MatterDataPlane } from "./isolation-boundary";

export async function authorizePersistedMatter(context: TenantContext, tenantId: string, matterId: string, now = new Date(), plane: MatterDataPlane = "api", requestId = crypto.randomUUID()) {
  authorizeMatter(context, tenantId, matterId);
  const db = getPreviewDb();
  const [deny] = await db.select({ id: matterAccessPolicies.id }).from(matterAccessPolicies).where(and(
    eq(matterAccessPolicies.tenantId, tenantId),
    eq(matterAccessPolicies.matterId, matterId),
    eq(matterAccessPolicies.userId, context.userId),
    eq(matterAccessPolicies.effect, "deny"),
    eq(matterAccessPolicies.status, "active"),
    or(isNull(matterAccessPolicies.expiresAt), gt(matterAccessPolicies.expiresAt, now)),
  )).limit(1);
  await db.insert(accessDecisionEvents).values({ id: createId(), tenantId, actorId: context.userId, matterId, plane, outcome: deny ? "denied" : "allowed", reasonCode: deny ? "active_matter_deny" : "matter_access_granted", requestId, createdAt: now }).onConflictDoNothing();
  if (deny) throw new AuthorizationError();
}

export async function authorizePersistedTenantObject(context: TenantContext, tenantId: string, matterId: string, objectKey: string, plane: MatterDataPlane = "object") {
  authorizeTenantObjectKey(context, tenantId, matterId, objectKey);
  await authorizePersistedMatter(context, tenantId, matterId, new Date(), plane);
}
