import { describe, expect, it } from "vitest";
import { summitSyntheticBillingProfile, validateBillingEntry } from "./validate-entry";

const valid = { minutes: 72, narrative: "Review QME report and analyze impairment, apportionment, restrictions, and client reporting impact.", taskCode: "L120", activityCode: "A104" };

describe("validateBillingEntry", () => {
  it("passes a compliant entry against a versioned client rule", () => {
    const result = validateBillingEntry(valid, summitSyntheticBillingProfile);
    expect(result.outcome).toBe("pass");
    expect(result.ruleVersion).toBe("2026.1");
  });

  it("warns on a vague narrative", () => {
    expect(validateBillingEntry({ ...valid, narrative: "Review file" }, summitSyntheticBillingProfile).outcome).toBe("warning");
  });

  it("hard-stops disallowed codes", () => {
    const result = validateBillingEntry({ ...valid, taskCode: "X999" }, summitSyntheticBillingProfile);
    expect(result.outcome).toBe("hard_stop");
    expect(result.explanation).toContain("not allowed");
  });
});
