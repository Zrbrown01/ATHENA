import { describe, expect, it } from "vitest";
import { assertTrustedWriteOrigin, RequestSecurityError } from "./request-security";

describe("assertTrustedWriteOrigin", () => {
  it("accepts same-origin browser writes", () => {
    expect(() => assertTrustedWriteOrigin(new Request("https://www.athenacms.app/api/test", { headers: { origin: "https://www.athenacms.app", "sec-fetch-site": "same-origin" } }))).not.toThrow();
  });
  it("rejects a cross-site origin", () => {
    expect(() => assertTrustedWriteOrigin(new Request("https://www.athenacms.app/api/test", { headers: { origin: "https://attacker.invalid", "sec-fetch-site": "cross-site" } }))).toThrow(RequestSecurityError);
  });
  it("allows non-browser server calls without browser origin headers", () => {
    expect(() => assertTrustedWriteOrigin(new Request("https://www.athenacms.app/api/test"))).not.toThrow();
  });
});
