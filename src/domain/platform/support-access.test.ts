import { describe, expect, it } from "vitest";
import type { TenantContext } from "@/platform/tenant-context";
import { decideAccessReview, decideSupportAccess } from "./support-access";

const context: TenantContext = { tenantId: "tenant-a", userId: "partner-1", roles: ["partner"], matterAccess: new Set(["matter-1"]) };
const grant = { action: "grant", tenantId: "tenant-a", matterId: "matter-1", supportUserId: "support-1", purpose: "Investigate failed archive download safely.", ticketReference: "SUP-1042", durationMinutes: 60, idempotencyKey: "support-grant-0001" } as const;
describe("support access policy", () => {
  it("creates a time-boxed restricted grant event", () => {
    const result = decideSupportAccess(context, grant, null, new Date("2026-08-20T12:00:00Z"));
    expect(result.expiresAt?.toISOString()).toBe("2026-08-20T13:00:00.000Z");
    expect(result.event).toMatchObject({ eventType: "support.access_granted", visibility: "restricted" });
  });
  it("limits duration and blocks duplicate, self, stale, and expired operations", () => {
    expect(() => decideSupportAccess(context, { ...grant, durationMinutes: 241 })).toThrow();
    expect(() => decideSupportAccess(context, { ...grant, supportUserId: "partner-1" })).toThrow(/themselves/);
    const current = { status: "active" as const, revision: 2, expiresAt: new Date("2026-08-20T13:00:00Z") };
    expect(() => decideSupportAccess(context, grant, current, new Date("2026-08-20T12:00:00Z"))).toThrow(/already exists/);
    const revoke = { action: "revoke", tenantId: "tenant-a", matterId: "matter-1", supportUserId: "support-1", reason: "Investigation completed and access is no longer needed.", expectedRevision: 1, idempotencyKey: "support-revoke-0001" };
    expect(() => decideSupportAccess(context, revoke, current, new Date("2026-08-20T12:00:00Z"))).toThrow(/refresh/);
    expect(() => decideSupportAccess(context, { ...revoke, expectedRevision: 2 }, current, new Date("2026-08-20T14:00:00Z"))).toThrow(/No active/);
  });
  it("validates access-review periods and emits an attestation", () => {
    const raw = { action: "attest_review", tenantId: "tenant-a", periodStartedAt: "2026-07-01T00:00:00Z", periodEndedAt: "2026-08-01T00:00:00Z", outcome: "certified", notes: "Reviewed active walls and support grants; no exceptions found.", idempotencyKey: "access-review-0001" };
    expect(decideAccessReview(context, raw).event.eventType).toBe("access.review_attested");
    expect(() => decideAccessReview(context, { ...raw, periodStartedAt: raw.periodEndedAt })).toThrow(/end must follow/);
  });
});
