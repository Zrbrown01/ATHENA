import { eq, gt, sql } from "drizzle-orm";
import { getPreviewDb } from "../../db";
import { accessDecisionEvents, rateLimitWindows } from "../../db/schema";

export async function readSecurityControlHealth(tenantId: string, now = new Date()) {
  const db = getPreviewDb();
  const [access] = await db.select({
    allowed: sql<number>`coalesce(sum(case when ${accessDecisionEvents.outcome} = 'allowed' then 1 else 0 end), 0)`,
    denied: sql<number>`coalesce(sum(case when ${accessDecisionEvents.outcome} = 'denied' then 1 else 0 end), 0)`,
  }).from(accessDecisionEvents).where(eq(accessDecisionEvents.tenantId, tenantId));
  const [rate] = await db.select({
    activeWindows: sql<number>`count(*)`,
    throttledRequests: sql<number>`coalesce(sum(case when ${rateLimitWindows.count} > ${rateLimitWindows.limit} then ${rateLimitWindows.count} - ${rateLimitWindows.limit} else 0 end), 0)`,
  }).from(rateLimitWindows).where(gt(rateLimitWindows.expiresAt, now));
  return { access: { allowed: Number(access.allowed), denied: Number(access.denied) }, rateLimit: { activeWindows: Number(rate.activeWindows), throttledRequests: Number(rate.throttledRequests), policy: "Per actor + action; fixed 60-second windows" } };
}
