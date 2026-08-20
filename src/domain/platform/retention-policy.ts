export interface RetentionPolicyInput {
  code: string;
  version: number;
  retainDays: number;
  disposition: "review_required" | "retain";
}

export type RetentionDecision =
  | { outcome: "retain"; reason: string; policyCode: string; policyVersion: number }
  | { outcome: "held"; reason: string; policyCode: string; policyVersion: number }
  | { outcome: "eligible_for_review"; reason: string; policyCode: string; policyVersion: number };

export function evaluateRetention(input: { createdAt: Date; asOf: Date; policy: RetentionPolicyInput; activeLegalHold: boolean }): RetentionDecision {
  const { policy } = input;
  if (!Number.isInteger(policy.retainDays) || policy.retainDays < 0) throw new Error("Retention days must be a non-negative integer");
  const base = { policyCode: policy.code, policyVersion: policy.version };
  if (input.activeLegalHold) return { ...base, outcome: "held", reason: "An active legal hold prevents disposition." };
  if (policy.disposition === "retain") return { ...base, outcome: "retain", reason: "The effective policy requires indefinite retention." };
  const eligibleAt = input.createdAt.getTime() + policy.retainDays * 86_400_000;
  if (input.asOf.getTime() < eligibleAt) return { ...base, outcome: "retain", reason: "The minimum retention period has not elapsed." };
  return { ...base, outcome: "eligible_for_review", reason: "The retention period elapsed; human review is required before any disposition." };
}
