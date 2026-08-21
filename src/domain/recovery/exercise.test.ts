import { describe, expect, it } from "vitest";
import {
  AuthorizationError,
  type TenantContext,
} from "@/platform/tenant-context";
import { decideRecovery } from "./exercise";
const context: TenantContext = {
  tenantId: "tenant-golden",
  userId: "partner-1",
  roles: ["partner"],
  matterAccess: new Set(),
};
const base = {
  action: "verify_restore" as const,
  tenantId: "tenant-golden",
  exerciseId: "exercise-001",
  expectedRevision: 2 as const,
  idempotencyKey: "recovery-test-001",
  reason: "Verify the disposable local restore against the snapshot manifest.",
};
const checks = [
  "table_count",
  "event_count",
  "outbox_count",
  "snapshot_checksum",
  "tenant_scope",
].map((code) => ({
  code,
  expectedValue: "5",
  actualValue: "5",
  outcome: "pass",
  evidenceRef: `local-restore:${code}`,
}));
describe("recovery exercise decisions", () => {
  it("verifies only an exact five-check match", () =>
    expect(
      decideRecovery({
        context,
        raw: { ...base, checks },
        exercise: { id: "exercise-001", status: "restored", revision: 2 },
      }).toStatus,
    ).toBe("verified"));
  it("fails a mismatched restore", () =>
    expect(
      decideRecovery({
        context,
        raw: {
          ...base,
          checks: checks.map((x, i) =>
            i ? x : { ...x, actualValue: "4", outcome: "fail" },
          ),
        },
        exercise: { id: "exercise-001", status: "restored", revision: 2 },
      }).toStatus,
    ).toBe("failed"));
  it("blocks missing check categories", () =>
    expect(() =>
      decideRecovery({
        context,
        raw: {
          ...base,
          checks: checks.map((x) => ({ ...x, code: "table_count" })),
        },
        exercise: { id: "exercise-001", status: "restored", revision: 2 },
      }),
    ).toThrow(/exactly once/));
  it("blocks approval before verification", () =>
    expect(() =>
      decideRecovery({
        context,
        raw: {
          action: "approve_exercise",
          tenantId: "tenant-golden",
          exerciseId: "exercise-001",
          expectedRevision: 3,
          approvalId: "approval-001",
          idempotencyKey: "recovery-test-002",
          scopeLimitation:
            "Local D1 export only; no provider restore is represented.",
          notes:
            "Counts, checksums, event/outbox identity, and tenant scope matched.",
        },
        exercise: { id: "exercise-001", status: "restored", revision: 3 },
      }),
    ).toThrow(/not allowed/));
  it("blocks foreign tenants", () =>
    expect(() =>
      decideRecovery({
        context,
        raw: { ...base, tenantId: "other", checks },
        exercise: { id: "exercise-001", status: "restored", revision: 2 },
      }),
    ).toThrow(AuthorizationError));
});
