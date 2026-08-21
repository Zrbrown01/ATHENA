import { describe, expect, it } from "vitest";
import {
  rebuildMatterObligations,
  type RebuildObligation,
  type RebuildRule,
} from "./obligation-rebuild";

const rule: RebuildRule = {
  id: "rule-1",
  code: "synthetic",
  version: 1,
  authorityType: "firm_policy",
  authorityCitation: "Synthetic only",
  businessDays: 3,
  effectiveAt: new Date("2026-01-01T12:00:00Z"),
  reviewBy: new Date("2026-12-31T12:00:00Z"),
  contentStatus: "synthetic_sandbox",
  reviewedBy: null,
  reviewedAt: null,
};
const obligation = (
  patch: Partial<RebuildObligation> = {},
): RebuildObligation => ({
  id: "root",
  ruleId: rule.id,
  ruleCode: rule.code,
  ruleVersion: 1,
  authorityCitation: rule.authorityCitation,
  triggerAt: new Date("2026-08-20T12:00:00Z"),
    dueAt: new Date("2026-08-26T12:00:00Z"),
  status: "open",
  ...patch,
});
const run = (
  input: Partial<Parameters<typeof rebuildMatterObligations>[0]> = {},
) =>
  rebuildMatterObligations({
    obligations: [obligation()],
    rules: [rule],
    dependencies: [],
    exceptions: [],
    asOfDate: "2026-08-21",
    holidays: new Set(["2026-08-24"]),
    ...input,
  });

describe("obligation rebuild", () => {
  it("matches exact rule history and approved exception state", () => {
    const result = run({
      obligations: [obligation({ dueAt: new Date("2026-08-27T12:00:00Z") })],
      exceptions: [
        {
          id: "ex-1",
          obligationId: "root",
          exceptionType: "due_date_exception",
          status: "approved",
          proposedDueAt: new Date("2026-08-27T12:00:00Z"),
        },
      ],
    });
    expect(result).toMatchObject({
      outcome: "matched",
      matchedCount: 1,
      driftedCount: 0,
      blockedCount: 0,
    });
  });
  it("records drift without changing the stored obligation", () => {
    const current = obligation({ dueAt: new Date("2026-08-28T12:00:00Z") });
    const result = run({ obligations: [current] });
    expect(result.findings[0]).toMatchObject({
      result: "drifted",
      actualDueDate: "2026-08-28",
      expectedDueDate: "2026-08-26",
    });
    expect(current.dueAt.toISOString().slice(0, 10)).toBe("2026-08-28");
  });
  it("rebuilds dependency chains from predecessor expected dates", () => {
    const result = run({
      obligations: [
        obligation(),
        obligation({
          id: "child",
          triggerAt: new Date("2026-08-20T12:00:00Z"),
          dueAt: new Date("2026-08-21T12:00:00Z"),
        }),
      ],
      dependencies: [
        {
          id: "dep",
          predecessorObligationId: "root",
          successorObligationId: "child",
          relationType: "preparation_before",
          offsetBusinessDays: 2,
        },
      ],
    });
    expect(
      result.findings.find((item) => item.obligationId === "child"),
    ).toMatchObject({
      result: "matched",
      expectedDueDate: "2026-08-21",
      dependencyId: "dep",
    });
  });
  it.each([
    ["missing exact rule", { rules: [] }],
    [
      "pending exception",
      {
        exceptions: [
          {
            id: "ex-1",
            obligationId: "root",
            exceptionType: "waiver" as const,
            status: "requested" as const,
            proposedDueAt: null,
          },
        ],
      },
    ],
    [
      "dependency cycle",
      {
        obligations: [obligation(), obligation({ id: "child" })],
        dependencies: [
          {
            id: "a",
            predecessorObligationId: "child",
            successorObligationId: "root",
            relationType: "preparation_before" as const,
            offsetBusinessDays: 1,
          },
          {
            id: "b",
            predecessorObligationId: "root",
            successorObligationId: "child",
            relationType: "preparation_before" as const,
            offsetBusinessDays: 1,
          },
        ],
      },
    ],
  ])("blocks %s", (_label, patch) =>
    expect(run(patch).outcome).toBe("blocked"),
  );
});
