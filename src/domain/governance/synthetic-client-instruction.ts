const encoder = new TextEncoder();
export const SYNTHETIC_CLIENT_INSTRUCTION_SHA256 = "de1eeca720928434efd1dd329447d2eae7653221ea18c15226cf576320ed7e09";
export const SYNTHETIC_CLIENT_INSTRUCTION_BYTE_SIZE = 873;
export function buildSyntheticClientInstructionPdf() {
  const pageContent = "BT\n/F1 16 Tf\n72 720 Td\n(ATHENA SYNTHETIC CLIENT INSTRUCTION) Tj\n0 -28 Td\n/F1 10 Tf\n(Not a real Summit instruction. Workflow and checksum fixture only.) Tj\n0 -18 Td\n(Status reports: six business days from the synthetic trigger.) Tj\n0 -18 Td\n(Effective 2026-01-01. Review by 2026-12-31.) Tj\nET\n";
  const objects = ["1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n", "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n", "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n", "4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n", `5 0 obj\n<< /Length ${encoder.encode(pageContent).byteLength} >>\nstream\n${pageContent}endstream\nendobj\n`];
  let pdf = "%PDF-1.4\n%ATHENA-SYNTHETIC-CLIENT-INSTRUCTION\n"; const offsets = [0];
  for (const object of objects) { offsets.push(encoder.encode(pdf).byteLength); pdf += object; }
  const xrefOffset = encoder.encode(pdf).byteLength; pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets.slice(1)) pdf += `${offset.toString().padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`; return encoder.encode(pdf);
}
