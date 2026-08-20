import { describe, expect, it } from "vitest";
import { buildSyntheticQmePdf, SYNTHETIC_QME_BYTE_SIZE, SYNTHETIC_QME_SHA256 } from "./synthetic-qme-original";

describe("synthetic QME original", () => {
  it("builds stable valid-PDF structure without production data", () => {
    const first = buildSyntheticQmePdf();
    const second = buildSyntheticQmePdf();
    const text = new TextDecoder().decode(first);
    expect(first).toEqual(second);
    expect(text.startsWith("%PDF-1.4")).toBe(true);
    expect(text).toContain("ATHENA SYNTHETIC QME FIXTURE");
    expect(text).toContain("No production PHI");
    expect(text.endsWith("%%EOF\n")).toBe(true);
  });

  it("matches the recorded byte size and checksum", async () => {
    const bytes = buildSyntheticQmePdf();
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    const sha256 = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
    expect(bytes.byteLength).toBe(SYNTHETIC_QME_BYTE_SIZE);
    expect(sha256).toBe(SYNTHETIC_QME_SHA256);
  });
});
