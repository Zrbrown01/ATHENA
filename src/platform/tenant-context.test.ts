import { describe, expect, it } from "vitest";
import { authorizeMatter, authorizeTenantObjectKey, AuthorizationError, type TenantContext } from "./tenant-context";

const context: TenantContext = { tenantId: "tenant-a", userId: "user-a", roles: ["attorney"], matterAccess: new Set(["matter-1", "matter-wall"]), ethicalWallBlocks: new Set(["matter-wall"]) };

describe("tenant and ethical-wall authorization", () => {
  it.each([
    ["cross tenant event", () => authorizeMatter(context, "tenant-b", "matter-1")],
    ["unassigned job", () => authorizeMatter(context, "tenant-a", "matter-2")],
    ["ethical wall", () => authorizeMatter(context, "tenant-a", "matter-wall")],
    ["cross-tenant object", () => authorizeTenantObjectKey(context, "tenant-a", "matter-1", "tenant-b/exports/matter-1/a.json")],
    ["object traversal", () => authorizeTenantObjectKey(context, "tenant-a", "matter-1", "tenant-a/../tenant-b/a.json")],
  ])("blocks %s", (_name, action) => expect(action).toThrow(AuthorizationError));

  it("allows an assigned, non-walled tenant object", () => {
    expect(() => authorizeTenantObjectKey(context, "tenant-a", "matter-1", "tenant-a/exports/matter-1/a.json")).not.toThrow();
  });
});
