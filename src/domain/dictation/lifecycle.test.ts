import { describe, expect, it } from "vitest";
import { decideDictation, type DictationState } from "./lifecycle";
import { AuthorizationError, type TenantContext } from "@/platform/tenant-context";

const context: TenantContext = { tenantId: "t", userId: "attorney-1", roles: ["attorney"], matterAccess: new Set(["matter-1"]) };
const base = { tenantId: "t", matterId: "matter-1", sessionId: "session-1", idempotencyKey: "dictation-test-001" };
const current = (status: DictationState["status"], revision = 1): DictationState => ({ id: "session-1", status, revision });

describe("dictation lifecycle", () => {
  it("captures only acknowledged synthetic audio metadata", () => {
    const x = decideDictation({ context, raw: { action: "capture_session", ...base, title: "Rivera client report", workProductType: "client_report", durationSeconds: 183, audioArtifactId: "audio-1", audioSha256: "a".repeat(64), consentEvidence: "Attorney confirmed consent and synthetic-only fixture use.", syntheticDataAcknowledged: true } });
    expect(x.toStatus).toBe("captured");
    expect(x.event.payload).toMatchObject({ providerConnected: false, providerCallAttempted: false, syntheticArtifact: true });
  });
  it("records an honest provider block without a provider attempt", () => {
    const x = decideDictation({ context, current: current("captured"), raw: { action: "attempt_transcription", ...base, expectedRevision: 1, reason: "Verbatim is not connected, so this records a blocked handoff only." } });
    expect(x.toStatus).toBe("provider_blocked");
    expect(x.event.payload).toMatchObject({ providerConnected: false, providerCallAttempted: false });
  });
  it("enforces ordered review and attorney approval", () => {
    expect(() => decideDictation({ context, current: current("templated"), raw: { action: "approve_work_product", ...base, expectedRevision: 1, reason: "Attorney reviewed source and approved the governed work product." } })).toThrow(/not allowed/);
    const staff = { ...context, userId: "staff-1", roles: ["paralegal"] };
    expect(() => decideDictation({ context: staff, current: current("in_review"), raw: { action: "approve_work_product", ...base, expectedRevision: 1, reason: "Staff cannot approve attorney work product under this policy." } })).toThrow(AuthorizationError);
  });
  it("enforces tenant and matter isolation", () => {
    expect(() => decideDictation({ context, current: current("captured"), raw: { action: "attempt_transcription", ...base, tenantId: "other", expectedRevision: 1, reason: "Foreign tenant dictation must always be rejected by authorization." } })).toThrow(AuthorizationError);
    expect(() => decideDictation({ context, current: current("captured"), raw: { action: "attempt_transcription", ...base, matterId: "other", expectedRevision: 1, reason: "Foreign matter dictation must always be rejected by authorization." } })).toThrow(AuthorizationError);
  });
});
