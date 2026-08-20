import { createId } from "@paralleldrive/cuid2";
import { desc, eq } from "drizzle-orm";
import { getDocumentBucket, getPreviewDb } from "../../../../../db";
import { documentIntakes } from "../../../../../db/schema";
import { createEvent } from "@/platform/events";
import { persistDocumentIntake } from "@/platform/preview-persistence";
import { requestActor } from "@/platform/request-actor";
import { DocumentValidationError, safeDocumentName, validatePdfUpload } from "@/domain/documents/validate-upload";
import { pilotContext } from "@/platform/pilot-context";
import { AuthorizationError, authorizeMatter, requireRole } from "@/platform/tenant-context";
import { assertTrustedWriteOrigin, RequestSecurityError } from "@/platform/request-security";

const TENANT_ID = "tenant-golden";

export async function GET(request: Request) {
  const actor = requestActor(request);
  if (!actor) return Response.json({ error: "Authentication required" }, { status: 401 });
  try { requireRole(pilotContext(actor), ["attorney", "partner", "paralegal", "records_specialist"]); }
  catch { return Response.json({ error: "Access denied" }, { status: 403 }); }
  const db = getPreviewDb();
  const rows = await db.select({
    id: documentIntakes.id, title: documentIntakes.title, byteSize: documentIntakes.byteSize,
    mimeType: documentIntakes.mimeType, classification: documentIntakes.classification,
    status: documentIntakes.status, createdAt: documentIntakes.createdAt,
  }).from(documentIntakes).where(eq(documentIntakes.tenantId, TENANT_ID))
    .orderBy(desc(documentIntakes.createdAt)).limit(25);
  return Response.json({ documents: rows });
}

export async function POST(request: Request) {
  try { assertTrustedWriteOrigin(request); }
  catch (error) { if (error instanceof RequestSecurityError) return Response.json({ error: "Untrusted request origin" }, { status: 403 }); throw error; }
  const actor = requestActor(request);
  if (!actor) return Response.json({ error: "Authentication required" }, { status: 401 });

  const form = await request.formData();
  const file = form.get("file");
  const matterId = textValue(form.get("matterId"));
  const requestedClassification = textValue(form.get("classification")) ?? "unclassified";
  const classification = ["medical_qme", "medical_report", "hearing_notice", "unclassified"].includes(requestedClassification) ? requestedClassification : "unclassified";
  try {
    const context = pilotContext(actor);
    requireRole(context, ["attorney", "partner", "paralegal", "records_specialist"]);
    if (matterId) authorizeMatter(context, TENANT_ID, matterId);
  } catch (error) {
    if (error instanceof AuthorizationError) return Response.json({ error: "Access denied" }, { status: 403 });
    throw error;
  }
  if (!(file instanceof File)) return Response.json({ error: "A PDF file is required" }, { status: 400 });
  const bytes = await file.arrayBuffer();
  const signature = new TextDecoder().decode(bytes.slice(0, 5));
  try {
    validatePdfUpload({ size: file.size, mimeType: file.type, signature });
  } catch (error) {
    if (error instanceof DocumentValidationError) return Response.json({ error: error.message }, { status: error.status });
    throw error;
  }

  const id = createId();
  const sha256 = await digestHex(bytes);
  const objectKey = `${TENANT_ID}/${matterId ?? "unassigned"}/${id}/original.pdf`;
  const bucket = getDocumentBucket();
  await bucket.put(objectKey, bytes, {
    httpMetadata: { contentType: "application/pdf" },
    customMetadata: { tenantId: TENANT_ID, documentId: id, sha256, scanStatus: "awaiting_scan" },
  });

  const event = createEvent({
    eventType: "document.intake_received", tenantId: TENANT_ID,
    aggregateType: "document", aggregateId: id, matterId,
    actorId: actor.userId, correlationId: crypto.randomUUID(),
    idempotencyKey: `document-intake-${id}`, source: "athena.web",
    visibility: "restricted",
    payload: { title: safeDocumentName(file.name), byteSize: file.size, mimeType: file.type, sha256, classification, status: "awaiting_scan" },
  });

  try {
    await persistDocumentIntake({ id, tenantId: TENANT_ID, matterId, title: safeDocumentName(file.name), objectKey, sha256, byteSize: file.size, mimeType: file.type, classification, actor, event });
  } catch (error) {
    await bucket.delete(objectKey);
    throw error;
  }

  return Response.json({ document: { id, title: safeDocumentName(file.name), status: "awaiting_scan", sha256 } }, { status: 202 });
}

function textValue(value: FormDataEntryValue | null) {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, 120) : undefined;
}

async function digestHex(bytes: ArrayBuffer) {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
