import { describe, expect, it } from "vitest";
import { decideEthicalWall } from "./ethical-wall";
import type { TenantContext } from "@/platform/tenant-context";

const context: TenantContext = { tenantId: "tenant-a", userId: "admin-1", roles: ["partner"], matterAccess: new Set(["matter-1"]) };
const place = { action: "place", tenantId: "tenant-a", matterId: "matter-1", targetUserId: "reviewer-2", reason: "Conflict screen requires restricted matter access.", idempotencyKey: "wall-place-0001" } as const;

describe("ethical wall administration", () => {
  it("creates a restricted immutable placement event", () => {
    expect(decideEthicalWall(context, place).event).toMatchObject({ eventType: "matter.ethical_wall_placed", visibility: "restricted", payload: { targetUserId: "reviewer-2" } });
  });
  it("blocks self-wall, duplicate placement, and stale release", () => {
    expect(() => decideEthicalWall(context, { ...place, targetUserId: "admin-1" })).toThrow(/own active session/);
    expect(() => decideEthicalWall(context, place, { status: "active", revision: 1 })).toThrow(/already exists/);
    const release = { action: "release", tenantId: "tenant-a", matterId: "matter-1", targetUserId: "reviewer-2", reason: "Conflict cleared after documented partner review.", expectedRevision: 1, idempotencyKey: "wall-release-0001" };
    expect(() => decideEthicalWall(context, release, { status: "active", revision: 2 })).toThrow(/refresh/);
  });
  it("requires a partner or firm administrator", () => {
    expect(() => decideEthicalWall({ ...context, roles: ["attorney"] }, place)).toThrow(/authorized legal reviewer/);
  });
});
