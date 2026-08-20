import { describe, expect, it } from "vitest";
import { buildTarArchive, readTarArchive, verifyMatterArchive } from "./tar-archive";

const encoder = new TextEncoder();

describe("matter TAR archive", () => {
  it("round-trips deterministic entries and rejects unsafe paths", () => {
    const archive = buildTarArchive([{ path: "manifest.json", bytes: encoder.encode("{}") }, { path: "documents/doc-1/original.pdf", bytes: encoder.encode("%PDF") }]);
    expect(readTarArchive(archive).map((entry) => entry.path)).toEqual(["manifest.json", "documents/doc-1/original.pdf"]);
    expect(() => buildTarArchive([{ path: "../escape", bytes: new Uint8Array() }])).toThrow(/Unsafe/);
  });

  it("verifies document checksums and manifest completeness", async () => {
    const bytes = encoder.encode("%PDF fixture");
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    const sha256 = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
    const manifest = encoder.encode(JSON.stringify({ completeness: "complete", missingItems: [] }));
    const archive = buildTarArchive([{ path: "manifest.json", bytes: manifest }, { path: "documents/doc-1/original.pdf", bytes }]);
    await expect(verifyMatterArchive(archive, [{ path: "documents/doc-1/original.pdf", sha256 }])).resolves.toMatchObject({ entryCount: 2, verifiedDocumentCount: 1 });
    const partial = buildTarArchive([{ path: "manifest.json", bytes: encoder.encode(JSON.stringify({ completeness: "partial", missingItems: ["original_document_bytes"] })) }, { path: "documents/doc-1/original.pdf", bytes }]);
    await expect(verifyMatterArchive(partial, [{ path: "documents/doc-1/original.pdf", sha256 }])).rejects.toThrow(/does not prove completeness/);
  });
});
