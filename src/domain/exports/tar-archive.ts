const encoder = new TextEncoder();
const decoder = new TextDecoder();
const BLOCK = 512;

export interface TarEntry { path: string; bytes: Uint8Array; modifiedAt?: Date }

export function buildTarArchive(entries: TarEntry[]) {
  const paths = new Set<string>();
  const chunks: Uint8Array[] = [];
  for (const entry of entries) {
    validatePath(entry.path);
    if (paths.has(entry.path)) throw new Error(`Duplicate archive path: ${entry.path}`);
    paths.add(entry.path);
    const header = new Uint8Array(BLOCK);
    writeText(header, 0, 100, entry.path);
    writeOctal(header, 100, 8, 0o644);
    writeOctal(header, 108, 8, 0);
    writeOctal(header, 116, 8, 0);
    writeOctal(header, 124, 12, entry.bytes.byteLength);
    writeOctal(header, 136, 12, Math.floor((entry.modifiedAt ?? new Date(0)).getTime() / 1000));
    header.fill(32, 148, 156);
    header[156] = 48;
    writeText(header, 257, 6, "ustar\0");
    writeText(header, 263, 2, "00");
    const checksum = header.reduce((sum, byte) => sum + byte, 0);
    writeChecksum(header, checksum);
    chunks.push(header, entry.bytes);
    const padding = (BLOCK - (entry.bytes.byteLength % BLOCK)) % BLOCK;
    if (padding) chunks.push(new Uint8Array(padding));
  }
  chunks.push(new Uint8Array(BLOCK * 2));
  return concatenate(chunks);
}

export function readTarArchive(archive: Uint8Array) {
  const entries: TarEntry[] = [];
  let offset = 0;
  while (offset + BLOCK <= archive.byteLength) {
    const header = archive.slice(offset, offset + BLOCK);
    if (header.every((byte) => byte === 0)) break;
    verifyHeaderChecksum(header);
    const path = readText(header, 0, 100);
    validatePath(path);
    const size = readOctal(header, 124, 12);
    const start = offset + BLOCK;
    const end = start + size;
    if (end > archive.byteLength) throw new Error("Archive entry exceeds archive length");
    entries.push({ path, bytes: archive.slice(start, end) });
    offset = start + Math.ceil(size / BLOCK) * BLOCK;
  }
  return entries;
}

export async function verifyMatterArchive(archive: Uint8Array, expectedDocuments: Array<{ path: string; sha256: string }>) {
  const entries = readTarArchive(archive);
  const byPath = new Map(entries.map((entry) => [entry.path, entry.bytes]));
  const manifestBytes = byPath.get("manifest.json");
  if (!manifestBytes) throw new Error("Archive manifest is missing");
  const manifest = JSON.parse(decoder.decode(manifestBytes)) as { completeness?: string; missingItems?: string[] };
  for (const document of expectedDocuments) {
    const bytes = byPath.get(document.path);
    if (!bytes) throw new Error(`Archive original is missing: ${document.path}`);
    if (await sha256Hex(bytes) !== document.sha256) throw new Error(`Archive checksum mismatch: ${document.path}`);
  }
  if (manifest.completeness !== "complete" || manifest.missingItems?.length) throw new Error("Archive manifest does not prove completeness");
  return { entryCount: entries.length, manifest, verifiedDocumentCount: expectedDocuments.length };
}

function validatePath(path: string) {
  if (!path || path.length > 100 || path.startsWith("/") || path.split("/").includes("..") || path.includes("\\")) throw new Error(`Unsafe archive path: ${path}`);
}
function writeText(target: Uint8Array, offset: number, length: number, value: string) { const bytes = encoder.encode(value); if (bytes.length > length) throw new Error("TAR field overflow"); target.set(bytes, offset); }
function readText(source: Uint8Array, offset: number, length: number) { return decoder.decode(source.slice(offset, offset + length)).replace(/\0.*$/, ""); }
function writeOctal(target: Uint8Array, offset: number, length: number, value: number) { writeText(target, offset, length, `${value.toString(8).padStart(length - 2, "0")}\0 `); }
function readOctal(source: Uint8Array, offset: number, length: number) { const value = readText(source, offset, length).trim(); const parsed = Number.parseInt(value, 8); if (!Number.isFinite(parsed)) throw new Error("Invalid TAR numeric field"); return parsed; }
function writeChecksum(header: Uint8Array, value: number) { writeText(header, 148, 8, `${value.toString(8).padStart(6, "0")}\0 `); }
function verifyHeaderChecksum(header: Uint8Array) { const expected = readOctal(header, 148, 8); const copy = header.slice(); copy.fill(32, 148, 156); const actual = copy.reduce((sum, byte) => sum + byte, 0); if (actual !== expected) throw new Error("Invalid TAR header checksum"); }
function concatenate(chunks: Uint8Array[]) { const total = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0); const result = new Uint8Array(total); let offset = 0; for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.byteLength; } return result; }
async function sha256Hex(bytes: Uint8Array) { const digest = await crypto.subtle.digest("SHA-256", bytes.buffer as ArrayBuffer); return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join(""); }
