import { describe, expect, it } from "vitest";
import { calculateDeadline, type DeadlineRule } from "./deadline";

const firmPilotRule: DeadlineRule = {
  code: "firm-pilot-qme-review",
  version: 1,
  authorityType: "firm_policy",
  authorityCitation: "Synthetic pilot policy; attorney validation required",
  baseDays: 5,
  dayKind: "business",
  rollConvention: "next_business_day",
  effectiveDate: "2026-01-01",
  reviewDate: "2026-12-31",
};

describe("versioned business-day deadline calculation", () => {
  it("skips weekends and supplied court holidays", () => {
    const result = calculateDeadline("2026-08-20", firmPilotRule, new Set(["2026-08-24"]));
    expect(result.dueDate).toBe("2026-08-28");
    expect(result).toMatchObject({ ruleCode: "firm-pilot-qme-review", ruleVersion: 1 });
  });

  it("rolls a calendar-day result to the next business day", () => {
    const result = calculateDeadline("2026-08-20", { ...firmPilotRule, code: "firm-calendar", baseDays: 2, dayKind: "calendar" }, new Set());
    expect(result.dueDate).toBe("2026-08-24");
    expect(result.trace.at(-1)).toMatch(/Rolled/);
  });
});
