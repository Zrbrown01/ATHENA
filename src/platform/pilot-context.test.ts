import { afterEach, describe, expect, it, vi } from "vitest";
import type { RequestActor } from "./request-actor";
import { GOLDEN_MATTER_ID, pilotContext } from "./pilot-context";

const actor = (userId: string): RequestActor => ({
  userId,
  email: `${userId}@example.test`,
  displayName: userId,
});

afterEach(() => vi.unstubAllEnvs());

describe("pilot identity mapping", () => {
  it("does not infer production roles or matter access from authentication alone", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ATHENA_PILOT_PARTNER_USER_IDS", "configured-owner");

    expect(pilotContext(actor("unknown-user"))).toMatchObject({
      roles: [],
      matterAccess: new Set(),
    });
  });

  it("grants the configured pilot partner only the golden matter", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ATHENA_PILOT_PARTNER_USER_IDS", "configured-owner, second-owner");

    expect(pilotContext(actor("configured-owner"))).toMatchObject({
      roles: ["attorney", "partner"],
      matterAccess: new Set([GOLDEN_MATTER_ID]),
    });
  });

  it("keeps a configured support principal out of ordinary matter access", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ATHENA_PILOT_SUPPORT_USER_IDS", "support-user");
    vi.stubEnv("ATHENA_PILOT_PARTNER_USER_IDS", "configured-owner");

    expect(pilotContext(actor("support-user"))).toMatchObject({
      roles: ["support"],
      matterAccess: new Set(),
    });
  });

  it("retains the deterministic local-development review identities", () => {
    vi.stubEnv("NODE_ENV", "test");
    expect(pilotContext(actor("user-maya-chen")).roles).toEqual([
      "attorney",
      "partner",
    ]);
    expect(pilotContext(actor("user-client-reviewer")).roles).toEqual([
      "attorney",
      "partner",
    ]);
  });
});
