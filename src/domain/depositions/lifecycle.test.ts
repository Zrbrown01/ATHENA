import { describe, expect, it } from "vitest";
import { decideDeposition, type DepositionState } from "./lifecycle";
import {
  AuthorizationError,
  type TenantContext,
} from "@/platform/tenant-context";
const context: TenantContext = {
  tenantId: "t",
  userId: "attorney-1",
  roles: ["attorney"],
  matterAccess: new Set(["matter-1"]),
};
const base = {
  tenantId: "t",
  matterId: "matter-1",
  depositionId: "dep-1",
  idempotencyKey: "deposition-test-001",
};
const current = (
  status: DepositionState["status"],
  revision = 1,
): DepositionState => ({
  id: "dep-1",
  status,
  revision,
  clientApprovalRequired: true,
});
describe("deposition lifecycle", () => {
  it("requires approval when client governance requires it", () =>
    expect(
      decideDeposition({
        context,
        raw: {
          action: "request_deposition",
          ...base,
          deponentName: "Alex Rivera",
          depositionType: "applicant",
          requestedStartsAt: "2026-09-10T17:00:00.000Z",
          timezone: "America/Los_Angeles",
          locationMode: "remote",
          reporterRequired: true,
          videoRequired: false,
          interpreterRequired: false,
          realtimeRequired: false,
          clientApprovalRequired: true,
          syntheticDataAcknowledged: true,
        },
      }).toStatus,
    ).toBe("pending_approval"));
  it("blocks Noted handoff without claiming a provider attempt", () => {
    const x = decideDeposition({
      context,
      current: current("ready_for_handoff"),
      raw: {
        action: "attempt_noted_booking",
        ...base,
        expectedRevision: 1,
        reason:
          "Noted connection is unavailable and booking must remain blocked.",
      },
    });
    expect(x.toStatus).toBe("handoff_blocked");
    expect(x.event.payload).toMatchObject({
      notedConnected: false,
      providerBookingAttempted: false,
    });
  });
  it("requires ordered scheduling, completion, transcript, and close states", () => {
    expect(() =>
      decideDeposition({
        context,
        current: current("handoff_blocked"),
        raw: {
          action: "complete_deposition",
          ...base,
          expectedRevision: 1,
          completionEvidence:
            "Attorney verified attendance and completion evidence.",
        },
      }),
    ).toThrow(/not allowed/);
    expect(
      decideDeposition({
        context,
        current: current("completed"),
        raw: {
          action: "materialize_synthetic_transcript",
          ...base,
          expectedRevision: 1,
          artifactId: "artifact-1",
          title: "Synthetic applicant deposition transcript",
          content:
            "Synthetic transcript fixture with no production testimony or personal information.",
          syntheticDataAcknowledged: true,
        },
      }).toStatus,
    ).toBe("transcript_received");
  });
  it("enforces tenant and matter isolation", () => {
    expect(() =>
      decideDeposition({
        context,
        raw: {
          action: "attempt_noted_booking",
          ...base,
          tenantId: "other",
          expectedRevision: 1,
          reason: "Forbidden foreign tenant operation must be rejected.",
        },
        current: current("ready_for_handoff"),
      }),
    ).toThrow(AuthorizationError);
    expect(() =>
      decideDeposition({
        context,
        raw: {
          action: "attempt_noted_booking",
          ...base,
          matterId: "other",
          expectedRevision: 1,
          reason: "Forbidden foreign matter operation must be rejected.",
        },
        current: current("ready_for_handoff"),
      }),
    ).toThrow(AuthorizationError);
  });
});
