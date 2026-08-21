import { describe, expect, it } from "vitest";
import {
  calculateDependentDeadline,
  evaluateDeadlineEscalation,
} from "./deadline";
import { decideObligationGovernance } from "./obligation-governance";

const partner = {
  tenantId: "tenant-a",
  userId: "partner-1",
  roles: ["partner"],
  matterAccess: new Set(["matter-a"]),
};
const obligation = {
  id: "obligation-1",
  status: "open" as const,
  revision: 2,
  dueAt: new Date("2026-08-28T17:00:00.000Z"),
  ruleId: "rule-1",
  ruleCode: "synthetic-rule",
  ruleVersion: 1,
  authorityCitation: "Synthetic firm policy",
  triggerAt: new Date("2026-08-20T17:00:00.000Z"),
  triggerSourceType: "document",
  triggerSourceId: "document-1",
  calculation: ["Synthetic calculation"],
};

describe("obligation governance", () => {
  it("calculates a business-day preparation chain", () => {
    expect(
      calculateDependentDeadline(
        "2026-08-28",
        2,
        "preparation_before",
        new Set(),
      ),
    ).toMatchObject({ dueDate: "2026-08-26" });
  });

  it("classifies critical and breached escalation windows", () => {
    expect(
      evaluateDeadlineEscalation("2026-08-28", "2026-08-27", new Set()),
    ).toMatchObject({ level: "critical", businessDaysRemaining: 1 });
    expect(
      evaluateDeadlineEscalation("2026-08-28", "2026-08-31", new Set()),
    ).toMatchObject({ level: "breached" });
  });

  it("requires a later proposed date and one pending request at a time", () => {
    const raw = {
      action: "request_exception",
      tenantId: "tenant-a",
      matterId: "matter-a",
      obligationId: obligation.id,
      expectedRevision: 2,
      exceptionId: "exception-1",
      exceptionType: "due_date_exception",
      proposedDueDate: "2026-08-29",
      reason: "Source packet review needs an additional controlled day.",
      authorityBasis:
        "Synthetic firm-workflow exception; no court extension is claimed.",
      idempotencyKey: "exception-request-1",
    } as const;
    expect(
      decideObligationGovernance({ context: partner, raw, current: obligation })
        .event.eventType,
    ).toBe("obligation.request_exception");
    expect(() =>
      decideObligationGovernance({
        context: partner,
        raw,
        current: obligation,
        pendingExceptionCount: 1,
      }),
    ).toThrow(/existing exception/);
    expect(() =>
      decideObligationGovernance({
        context: partner,
        raw: { ...raw, proposedDueDate: "2026-08-28" },
        current: obligation,
      }),
    ).toThrow(/move the deadline later/);
  });

  it("reserves exception decisions for partners", () => {
    const raw = {
      action: "decide_exception",
      tenantId: "tenant-a",
      matterId: "matter-a",
      obligationId: obligation.id,
      expectedRevision: 2,
      exceptionId: "exception-1",
      expectedExceptionRevision: 1,
      outcome: "approved",
      decisionReason:
        "Approved as synthetic firm workflow only with all source dates preserved.",
      idempotencyKey: "exception-decision-1",
    } as const;
    expect(() =>
      decideObligationGovernance({
        context: { ...partner, roles: ["attorney"] },
        raw,
        current: obligation,
        exception: {
          id: "exception-1",
          obligationId: obligation.id,
          exceptionType: "due_date_exception",
          status: "requested",
          proposedDueAt: new Date("2026-08-29T17:00:00.000Z"),
          revision: 1,
        },
      }),
    ).toThrow(/authorized legal reviewer/);
  });

  it("blocks escalation until the exception decision is resolved", () => {
    expect(() =>
      decideObligationGovernance({
        context: partner,
        current: obligation,
        pendingExceptionCount: 1,
        evaluation: {
          level: "critical",
          businessDaysRemaining: 1,
          basis: "Synthetic critical window.",
        },
        raw: {
          action: "evaluate_escalation",
          tenantId: "tenant-a",
          matterId: "matter-a",
          obligationId: obligation.id,
          expectedRevision: 2,
          escalationId: "escalation-1",
          asOfDate: "2026-08-27",
          idempotencyKey: "escalation-evaluate-1",
        },
      }),
    ).toThrow(/pending exception/);
  });
});
