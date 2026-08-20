import { and, desc, eq } from "drizzle-orm";
import { getPreviewDb } from "../../db";
import { governanceRules, legalHolds, retentionPolicies } from "../../db/schema";
import type { DeadlineRule } from "@/domain/governance/deadline";

export async function readPlatformPolicies(tenantId: string, matterId: string) {
  const db = getPreviewDb();
  const [retention] = await db.select().from(retentionPolicies)
    .where(and(eq(retentionPolicies.tenantId, tenantId), eq(retentionPolicies.code, "firm-default")))
    .orderBy(desc(retentionPolicies.version)).limit(1);
  const [rule] = await db.select().from(governanceRules)
    .where(and(eq(governanceRules.tenantId, tenantId), eq(governanceRules.code, "firm-pilot-qme-review")))
    .orderBy(desc(governanceRules.version)).limit(1);
  const [hold] = await db.select({ id: legalHolds.id }).from(legalHolds)
    .where(and(eq(legalHolds.tenantId, tenantId), eq(legalHolds.matterId, matterId), eq(legalHolds.status, "active"))).limit(1);
  if (!retention || !rule) throw new Error("Platform policy seeds are missing");
  const deadlineRule: DeadlineRule = {
    code: rule.code,
    version: rule.version,
    authorityType: rule.authorityType as DeadlineRule["authorityType"],
    authorityCitation: rule.authorityCitation,
    baseDays: rule.businessDays,
    dayKind: "business",
    rollConvention: "next_business_day",
    effectiveDate: rule.effectiveAt.toISOString().slice(0, 10),
    reviewDate: rule.reviewBy.toISOString().slice(0, 10),
  };
  return { retention: { code: retention.code, version: retention.version, retainDays: retention.retainDays, disposition: retention.disposition }, deadlineRule, activeLegalHold: Boolean(hold) };
}
