import { describe, expect, it } from "vitest";
import { DocumentValidationError, MAX_DOCUMENT_BYTES, safeDocumentName, validatePdfUpload } from "./validate-upload";

describe("validatePdfUpload", () => {
  it("accepts a bounded PDF with a matching signature", () => {
    expect(() => validatePdfUpload({ size: 1024, mimeType: "application/pdf", signature: "%PDF-" })).not.toThrow();
  });

  it("rejects oversized content before storage", () => {
    expect(() => validatePdfUpload({ size: MAX_DOCUMENT_BYTES + 1, mimeType: "application/pdf", signature: "%PDF-" })).toThrow(DocumentValidationError);
  });

  it("rejects MIME spoofing", () => {
    expect(() => validatePdfUpload({ size: 1024, mimeType: "image/png", signature: "%PDF-" })).toThrow(/Only PDF/);
  });

  it("rejects content without a PDF signature", () => {
    expect(() => validatePdfUpload({ size: 1024, mimeType: "application/pdf", signature: "<html" })).toThrow(/signature/);
  });

  it("removes path and control characters from object metadata", () => {
    expect(safeDocumentName("../records\\qme\u0000.pdf")).toBe(".._records_qme_.pdf");
  });
});
