import { describe, expect, it } from "vitest";
import { AuthorizationError, type TenantContext } from "./tenant-context";
import { authorizeMatterDataPlane, matterDataPlanes } from "./isolation-boundary";

const allowed: TenantContext = { tenantId: "tenant-a", userId: "user-1", roles: ["attorney"], matterAccess: new Set(["matter-1"]) };

describe("matter isolation boundary", () => {
  it.each(matterDataPlanes.filter((plane) => plane !== "support"))("denies an ethical wall on the %s plane", (plane) => {
    expect(() => authorizeMatterDataPlane({ context: { ...allowed, ethicalWallBlocks: new Set(["matter-1"]) }, tenantId: "tenant-a", matterId: "matter-1", plane })).toThrow(AuthorizationError);
  });
  it("requires a current matter-scoped support grant in addition to ordinary access", () => {
    expect(() => authorizeMatterDataPlane({ context: allowed, tenantId: "tenant-a", matterId: "matter-1", plane: "support" })).toThrow(/support approval/);
    expect(authorizeMatterDataPlane({ context: allowed, tenantId: "tenant-a", matterId: "matter-1", plane: "support", supportGrant: { approvedBy: "partner-1", expiresAt: new Date("2027-01-01"), matterIds: new Set(["matter-1"]) }, now: new Date("2026-08-20") }).plane).toBe("support");
  });
  it("denies cross-tenant cache and job keys before lookup", () => {
    for (const plane of ["cache", "job"] as const) expect(() => authorizeMatterDataPlane({ context: allowed, tenantId: "tenant-b", matterId: "matter-1", plane })).toThrow(AuthorizationError);
  });
});
