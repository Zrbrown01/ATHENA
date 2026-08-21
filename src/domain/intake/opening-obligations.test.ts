import { describe, expect, it } from "vitest";
import {
  OPENING_RULE_CODES,
  planOpeningObligations,
  type OpeningRule,
} from "./opening-obligations";

const rules: OpeningRule[] = OPENING_RULE_CODES.map((code, index) => ({
  id: `rule-${index + 1}`,
  code,
  version: 1,
  authorityType: "firm_policy",
  authorityCitation: "Synthetic firm workflow; attorney validation required",
  businessDays: index ? 10 : 1,
  effectiveAt: new Date("2026-01-01T12:00:00Z"),
  reviewBy: new Date("2026-12-31T12:00:00Z"),
  contentStatus: "synthetic_sandbox",
  reviewedBy: null,
  reviewedAt: null,
}));
const base = {
  tenantId: "tenant-golden",
  matterId: "matter-golden-001",
  candidateId: "intake-golden-001",
  ownerId: "partner-a",
  triggerDate: "2026-08-20",
  asOfDate: "2026-08-21",
  rules,
  holidays: new Set(["2026-08-24"]),
  syntheticDataAcknowledged: true,
};

describe("intake opening obligations", () => {
  it("plans the complete exact-version opening bundle", () => {
    const result = planOpeningObligations(base);
    expect(result.map((item) => item.dueDate)).toEqual([
      "2026-08-21",
      "2026-09-04",
    ]);
    expect(result.map((item) => item.ruleCode)).toEqual(OPENING_RULE_CODES);
    expect(
      result.every((item) => item.calculation[0].includes(base.candidateId)),
    ).toBe(true);
  });

  it("fails closed on missing, pending, expired, or unacknowledged rules", () => {
    expect(() =>
      planOpeningObligations({ ...base, rules: rules.slice(0, 1) }),
    ).toThrow("missing");
    expect(() =>
      planOpeningObligations({
        ...base,
        rules: rules.map((rule, index) =>
          index ? { ...rule, contentStatus: "pending_attorney_review" } : rule,
        ) as OpeningRule[],
      }),
    ).toThrow("pending attorney review");
    expect(() =>
      planOpeningObligations({
        ...base,
        rules: rules.map((rule) => ({
          ...rule,
          reviewBy: new Date("2026-08-20T12:00:00Z"),
        })),
      }),
    ).toThrow("past its review date");
    expect(() =>
      planOpeningObligations({ ...base, syntheticDataAcknowledged: false }),
    ).toThrow("explicit acknowledgement");
  });

  it("uses deterministic identities so retries cannot duplicate obligations", () => {
    expect(planOpeningObligations(base)).toEqual(planOpeningObligations(base));
  });
});
