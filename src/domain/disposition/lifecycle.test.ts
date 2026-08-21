import { describe, expect, it } from "vitest";
import {
  AuthorizationError,
  type TenantContext,
} from "@/platform/tenant-context";
import { decideDisposition, type DispositionState } from "./lifecycle";
const context: TenantContext = {
    tenantId: "tenant-golden",
    userId: "approver-1",
    roles: ["partner"],
    matterAccess: new Set(),
  },
  request: DispositionState = {
    id: "request-1",
    status: "draft",
    revision: 1,
    requestedBy: "requester-1",
    targetId: "target-1",
  },
  base = {
    tenantId: "tenant-golden",
    matterId: "matter-sandbox",
    requestId: "request-1",
    idempotencyKey: "disposition-test-001",
  };
describe("disposition lifecycle", () => {
  it("hard-stops an active legal hold", () =>
    expect(
      decideDisposition({
        context,
        request,
        targetExists: true,
        targetSyntheticDisposable: true,
        legalHoldCount: 1,
        raw: {
          action: "preview_disposition",
          ...base,
          expectedRevision: 1,
          reason: "Preview the synthetic target and preservation exclusions.",
        },
      }).toStatus,
    ).toBe("blocked_by_hold"));
  it("requires a target explicitly marked synthetic disposable", () =>
    expect(() =>
      decideDisposition({
        context,
        request,
        targetExists: true,
        targetSyntheticDisposable: false,
        raw: {
          action: "preview_disposition",
          ...base,
          expectedRevision: 1,
          reason: "Preview the requested deletion scope before approval.",
        },
      }),
    ).toThrow(/synthetic disposable/));
  it("prevents requester self-approval", () =>
    expect(() =>
      decideDisposition({
        context: { ...context, userId: "requester-1" },
        request: { ...request, status: "ready_for_approval", revision: 2 },
        raw: {
          action: "approve_disposition",
          ...base,
          expectedRevision: 2,
          approvalId: "approval-1",
          notes: "Reviewed scope, hold state, and immutable exclusions.",
        },
      }),
    ).toThrow(/requester cannot approve/));
  it("requires distinct dual approval before execution", () => {
    const pending = decideDisposition({
      context,
      request: { ...request, status: "ready_for_approval", revision: 2 },
      approvals: [],
      raw: {
        action: "approve_disposition",
        ...base,
        expectedRevision: 2,
        approvalId: "approval-1",
        notes: "First independent approval after scope review.",
      },
    });
    expect(pending.toStatus).toBe("pending_second_approval");
    expect(() =>
      decideDisposition({
        context,
        request: { ...request, status: "approved", revision: 4 },
        targetExists: true,
        targetSyntheticDisposable: true,
        approvals: [{ approverId: "approver-1", outcome: "approved" }],
        raw: {
          action: "execute_disposition",
          ...base,
          expectedRevision: 4,
          executionId: "execution-1",
          confirmation: "DELETE_SYNTHETIC_DISPOSABLE_RECORD_ONLY",
          reason: "Execute only the approved synthetic disposable target.",
        },
      }),
    ).toThrow(/two approvals/);
  });
  it("blocks foreign tenants", () =>
    expect(() =>
      decideDisposition({
        context,
        raw: {
          action: "materialize_sandbox_candidate",
          ...base,
          tenantId: "other",
          targetId: "target-1",
          payload: "Synthetic disposable payload for lifecycle testing only.",
          syntheticDisposable: true,
        },
      }),
    ).toThrow(AuthorizationError));
});
