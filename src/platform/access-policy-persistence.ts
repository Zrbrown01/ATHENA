import { and, eq, gt, isNull, or } from "drizzle-orm";
import { getPreviewDb } from "../../db";
import { matterAccessPolicies } from "../../db/schema";
import { authorizeMatter, authorizeTenantObjectKey, AuthorizationError, type TenantContext } from "./tenant-context";

export async function authorizePersistedMatter(context: TenantContext, tenantId: string, matterId: string, now = new Date()) {
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
  if (deny) throw new AuthorizationError();
}

export async function authorizePersistedTenantObject(context: TenantContext, tenantId: string, matterId: string, objectKey: string) {
  authorizeTenantObjectKey(context, tenantId, matterId, objectKey);
  await authorizePersistedMatter(context, tenantId, matterId);
}
