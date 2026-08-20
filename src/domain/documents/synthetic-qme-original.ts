const encoder = new TextEncoder();
export const SYNTHETIC_QME_SHA256 = "8c89d4d1d074e36b766e524b54db100a47234476a128c697336d814923678fda";
export const SYNTHETIC_QME_BYTE_SIZE = 777;

export function buildSyntheticQmePdf() {
  const pageContent = "BT\n/F1 16 Tf\n72 720 Td\n(ATHENA SYNTHETIC QME FIXTURE) Tj\n0 -28 Td\n/F1 10 Tf\n(No production PHI. Deterministic evidence used for archive verification.) Tj\n0 -18 Td\n(Pages cited by extracted facts: 27, 29, 31.) Tj\nET\n";
  const objects = [
    "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
    "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n",
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n",
    "4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n",
    `5 0 obj\n<< /Length ${encoder.encode(pageContent).byteLength} >>\nstream\n${pageContent}endstream\nendobj\n`,
  ];
  let pdf = "%PDF-1.4\n%ATHENA-SYNTHETIC\n";
  const offsets = [0];
  for (const object of objects) { offsets.push(encoder.encode(pdf).byteLength); pdf += object; }
  const xrefOffset = encoder.encode(pdf).byteLength;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets.slice(1)) pdf += `${offset.toString().padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return encoder.encode(pdf);
}
