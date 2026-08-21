import { describe, expect, it } from "vitest";
import { decideIntakeCandidate, type IntakeCandidateState } from "./candidate";
const context = {
  tenantId: "tenant-golden",
  userId: "partner-a",
  roles: ["partner" as const],
  matterAccess: new Set(["matter-golden-001"]),
};
const current: IntakeCandidateState = {
  id: "intake-golden-001",
  proposedMatterId: "matter-golden-001",
  status: "conflict_review",
  revision: 1,
  missingFields: ["claims_professional_email"],
};
const base = {
  tenantId: "tenant-golden",
  candidateId: current.id,
  matterId: current.proposedMatterId,
  idempotencyKey: "intake-test-command-001",
};
const opening = {
  openingTriggerDate: "2026-08-20",
  syntheticDataAcknowledged: true as const,
};
describe("intake candidate lifecycle", () => {
  it("moves conflict clearance to missing information when required data remains", () => {
    expect(
      decideIntakeCandidate({
        context,
        current,
        openConflictCount: 1,
        raw: {
          ...base,
          action: "clear_conflict",
          conflictId: "conflict-001",
          expectedRevision: 1,
          reason: "Prior representation was unrelated after partner review.",
        },
      }).toStatus,
    ).toBe("missing_information");
  });
  it("cannot open while a conflict, duplicate match, or missing field remains", () => {
    expect(() =>
      decideIntakeCandidate({
        context,
        current: { ...current, status: "ready_to_open" },
        openConflictCount: 0,
        unresolvedMatchCount: 1,
        openingPlanCount: 2,
        raw: {
          ...base,
          ...opening,
          action: "approve_open",
          expectedRevision: 1,
          reason: "Open after the complete authorized review.",
        },
      }),
    ).toThrow("cannot open");
  });
  it("rejects stale review revisions", () => {
    expect(() =>
      decideIntakeCandidate({
        context,
        current,
        raw: {
          ...base,
          action: "reject",
          expectedRevision: 2,
          reason: "Referral is outside the authorized engagement scope.",
        },
      }),
    ).toThrow("changed");
  });
  it("opens only with the complete governed obligation bundle", () => {
    const ready = {
      ...current,
      status: "ready_to_open" as const,
      missingFields: [],
    };
    expect(() =>
      decideIntakeCandidate({
        context,
        current: ready,
        openConflictCount: 0,
        openingPlanCount: 1,
        raw: {
          ...base,
          ...opening,
          action: "approve_open",
          expectedRevision: 1,
          reason: "Conflict and completeness review are documented and clear.",
        },
      }),
    ).toThrow("complete governed");
    const result = decideIntakeCandidate({
      context,
      current: ready,
      openConflictCount: 0,
      openingPlanCount: 2,
      raw: {
        ...base,
        ...opening,
        action: "approve_open",
        expectedRevision: 1,
        reason: "Conflict and completeness review are documented and clear.",
      },
    });
    expect(result.toStatus).toBe("opened");
    expect(result.event.eventType).toBe("intake.matter_opened");
  });
  it("allows a one-time governed migration only for an opened candidate", () => {
    const result = decideIntakeCandidate({
      context,
      current: { ...current, status: "opened", missingFields: [] },
      openingPlanCount: 2,
      raw: {
        ...base,
        ...opening,
        action: "materialize_initial_obligations",
        expectedRevision: 1,
        reason:
          "Migrate the already-open pilot matter to governed opening obligations.",
      },
    });
    expect(result.event.eventType).toBe(
      "intake.initial_obligations_materialized",
    );
    expect(result.toStatus).toBe("opened");
  });
  it("denies cross-tenant commands", () => {
    expect(() =>
      decideIntakeCandidate({
        context,
        raw: { ...base, tenantId: "tenant-other", action: "create_candidate" },
      }),
    ).toThrow("Access denied");
  });
});
