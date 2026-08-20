import { describe, expect, it } from "vitest";
import { evaluateRetention } from "./retention-policy";

const policy = { code: "firm-default", version: 1, retainDays: 30, disposition: "review_required" as const };

describe("retention policy", () => {
  it("never makes a held record eligible", () => {
    expect(evaluateRetention({ createdAt: new Date("2026-01-01"), asOf: new Date("2027-01-01"), policy, activeLegalHold: true }).outcome).toBe("held");
  });

  it("requires human review after the retention window", () => {
    expect(evaluateRetention({ createdAt: new Date("2026-01-01"), asOf: new Date("2026-01-15"), policy, activeLegalHold: false }).outcome).toBe("retain");
    expect(evaluateRetention({ createdAt: new Date("2026-01-01"), asOf: new Date("2026-02-01"), policy, activeLegalHold: false })).toMatchObject({ outcome: "eligible_for_review", policyVersion: 1 });
  });
});
