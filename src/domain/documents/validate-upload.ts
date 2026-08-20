export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;

export class DocumentValidationError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "DocumentValidationError";
  }
}

export function validatePdfUpload(input: { size: number; mimeType: string; signature: string }) {
  if (input.size < 5 || input.size > MAX_DOCUMENT_BYTES) {
    throw new DocumentValidationError("PDF must be between 5 bytes and 10 MB", 400);
  }
  if (input.mimeType !== "application/pdf") {
    throw new DocumentValidationError("Only PDF files are accepted in this intake slice", 415);
  }
  if (input.signature !== "%PDF-") {
    throw new DocumentValidationError("File content is not a valid PDF signature", 415);
  }
}

export function safeDocumentName(value: string) {
  return value.replace(/[\\/\u0000-\u001f]/g, "_").slice(0, 180) || "document.pdf";
}
