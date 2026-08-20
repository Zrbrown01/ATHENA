import { buildTarArchive, readTarArchive, verifyMatterArchive } from "./tar-archive";

export interface MatterArchiveOriginal { path: string; bytes: Uint8Array; sha256: string }

export async function buildVerifiedMatterArchive(manifest: { completeness: "complete" | "partial"; missingItems: string[] } & Record<string, unknown>, originals: MatterArchiveOriginal[]) {
  const manifestBytes = new TextEncoder().encode(JSON.stringify(manifest, null, 2));
  const archive = buildTarArchive([{ path: "manifest.json", bytes: manifestBytes }, ...originals.map((original) => ({ path: original.path, bytes: original.bytes }))]);
  const entryCount = readTarArchive(archive).length;
  let restorationVerified = false;
  if (manifest.completeness === "complete") {
    await verifyMatterArchive(archive, originals.map(({ path, sha256 }) => ({ path, sha256 })));
    restorationVerified = true;
  }
  return { archive, entryCount, restorationVerified };
}
