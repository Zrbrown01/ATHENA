import { createId } from "@paralleldrive/cuid2";
import { and, asc, desc, eq } from "drizzle-orm";
import { getDocumentBucket, getPreviewDb } from "../../db";
import {
  batesAssignments,
  documentDerivatives,
  documentEvidenceDecisions,
  documentEvidenceRecords,
  exhibitAssignments,
  previewEvents,
  previewOutbox,
  productionSetItems,
  productionSets,
} from "../../db/schema";
import {
  buildSyntheticQmePdf,
  SYNTHETIC_QME_BYTE_SIZE,
  SYNTHETIC_QME_SHA256,
} from "@/domain/documents/synthetic-qme-original";
import {
  validateProductionSet,
  type DocumentEvidenceCommand,
  type ProductionSetState,
} from "@/domain/documents/evidence-lifecycle";
import type { EventEnvelope } from "./events";
import type { RequestActor } from "./request-actor";
export async function readEvidence(t: string, m: string, id: string) {
  const [x] = await getPreviewDb()
    .select()
    .from(documentEvidenceRecords)
    .where(
      and(
        eq(documentEvidenceRecords.tenantId, t),
        eq(documentEvidenceRecords.matterId, m),
        eq(documentEvidenceRecords.id, id),
      ),
    )
    .limit(1);
  return x ?? null;
}
export async function readDerivative(t: string, m: string, id: string) {
  const [x] = await getPreviewDb()
    .select()
    .from(documentDerivatives)
    .where(
      and(
        eq(documentDerivatives.tenantId, t),
        eq(documentDerivatives.matterId, m),
        eq(documentDerivatives.id, id),
      ),
    )
    .limit(1);
  return x ?? null;
}
export async function readProductionSet(t: string, m: string, id: string) {
  const db = getPreviewDb(),
    [set] = await db
      .select()
      .from(productionSets)
      .where(
        and(
          eq(productionSets.tenantId, t),
          eq(productionSets.matterId, m),
          eq(productionSets.id, id),
        ),
      )
      .limit(1);
  if (!set) return null;
  const [items, derivatives] = await Promise.all([
      db
        .select()
        .from(productionSetItems)
        .where(
          and(
            eq(productionSetItems.tenantId, t),
            eq(productionSetItems.productionSetId, id),
          ),
        )
        .orderBy(asc(productionSetItems.position)),
      db
        .select()
        .from(documentDerivatives)
        .where(
          and(
            eq(documentDerivatives.tenantId, t),
            eq(documentDerivatives.matterId, m),
          ),
        ),
    ]),
    states = new Map(derivatives.map((x) => [x.id, x.status]));
  return {
    ...set,
    items: items.map((x) => ({
      ...x,
      derivativeStatus: states.get(x.derivativeId) ?? "missing",
    })),
  } as typeof set & ProductionSetState;
}
export async function documentEvidenceProjection(t: string, m: string) {
  const db = getPreviewDb(),
    [evidence, derivatives, bates, exhibits, sets] = await Promise.all([
      db
        .select()
        .from(documentEvidenceRecords)
        .where(
          and(
            eq(documentEvidenceRecords.tenantId, t),
            eq(documentEvidenceRecords.matterId, m),
          ),
        )
        .orderBy(asc(documentEvidenceRecords.createdAt)),
      db
        .select()
        .from(documentDerivatives)
        .where(
          and(
            eq(documentDerivatives.tenantId, t),
            eq(documentDerivatives.matterId, m),
          ),
        )
        .orderBy(asc(documentDerivatives.createdAt)),
      db
        .select()
        .from(batesAssignments)
        .where(
          and(
            eq(batesAssignments.tenantId, t),
            eq(batesAssignments.matterId, m),
          ),
        ),
      db
        .select()
        .from(exhibitAssignments)
        .where(
          and(
            eq(exhibitAssignments.tenantId, t),
            eq(exhibitAssignments.matterId, m),
          ),
        ),
      db
        .select()
        .from(productionSets)
        .where(
          and(eq(productionSets.tenantId, t), eq(productionSets.matterId, m)),
        )
        .orderBy(asc(productionSets.createdAt)),
    ]);
  const setItems = await Promise.all(
    sets.map(async (x) => ({
      ...x,
      items: await db
        .select()
        .from(productionSetItems)
        .where(
          and(
            eq(productionSetItems.tenantId, t),
            eq(productionSetItems.productionSetId, x.id),
          ),
        )
        .orderBy(asc(productionSetItems.position)),
    })),
  );
  return { evidence, derivatives, bates, exhibits, productionSets: setItems };
}
export async function readDocumentEvidenceEvent(t: string, key: string) {
  const [x] = await getPreviewDb()
    .select({ eventId: previewEvents.eventId })
    .from(previewEvents)
    .where(
      and(eq(previewEvents.tenantId, t), eq(previewEvents.idempotencyKey, key)),
    )
    .limit(1);
  return x ?? null;
}
export async function buildProductionValidation(
  t: string,
  m: string,
  id: string,
) {
  const set = await readProductionSet(t, m, id);
  if (!set) throw new Error("Production set does not exist");
  return validateProductionSet(set);
}
export async function persistDocumentEvidence(input: {
  command: DocumentEvidenceCommand;
  aggregateType: string;
  aggregateId: string;
  fromStatus: string;
  toStatus: string;
  event: EventEnvelope<Record<string, unknown>>;
  actor: RequestActor;
  validation?: ReturnType<typeof validateProductionSet>;
}) {
  const db = getPreviewDb(),
    bucket = getDocumentBucket(),
    c = input.command,
    now = new Date(input.event.occurredAt),
    eventWrite = db
      .insert(previewEvents)
      .values(eventValues(input.event, input.actor)),
    outboxWrite = db
      .insert(previewOutbox)
      .values({
        id: createId(),
        tenantId: c.tenantId,
        eventId: input.event.eventId,
        topic: "athena.document_evidence",
        payload: input.event,
        attempts: 0,
        availableAt: now,
      }),
    decisionWrite = db
      .insert(documentEvidenceDecisions)
      .values({
        id: createId(),
        tenantId: c.tenantId,
        matterId: c.matterId,
        aggregateType: input.aggregateType,
        aggregateId: input.aggregateId,
        action: c.action,
        fromStatus: input.fromStatus,
        toStatus: input.toStatus,
        evidence: reason(c),
        actorId: input.actor.userId,
        eventId: input.event.eventId,
        idempotencyKey: c.idempotencyKey,
        createdAt: now,
      });
  if (c.action === "materialize_fixture_original") {
    const objectKey = `${c.tenantId}/${c.matterId}/${c.evidenceId}/original.pdf`,
      existing = await bucket.get(objectKey);
    if (existing) {
      const bytes = new Uint8Array(await existing.arrayBuffer());
      if ((await digest(bytes)) !== SYNTHETIC_QME_SHA256)
        throw new Error(
          "Existing original checksum does not match the immutable fixture identity",
        );
    } else
      await bucket.put(objectKey, buildSyntheticQmePdf(), {
        httpMetadata: { contentType: "application/pdf" },
        customMetadata: {
          tenantId: c.tenantId,
          matterId: c.matterId,
          evidenceId: c.evidenceId,
          sha256: SYNTHETIC_QME_SHA256,
          custodyStatus: "trusted_synthetic_fixture",
        },
      });
    try {
      await db.batch([
        db
          .insert(documentEvidenceRecords)
          .values({
            id: c.evidenceId,
            tenantId: c.tenantId,
            matterId: c.matterId,
            sourceType: "deterministic_fixture",
            sourceId: "fixture-qme-rivera-20260818",
            title: c.title,
            originalObjectKey: objectKey,
            originalSha256: SYNTHETIC_QME_SHA256,
            byteSize: SYNTHETIC_QME_BYTE_SIZE,
            mimeType: "application/pdf",
            pageCount: 1,
            custodyStatus: "trusted_synthetic_fixture",
            privilege: c.privilege,
            confidentiality: c.confidentiality,
            legalHoldRequired: false,
            createdBy: input.actor.userId,
            createdAt: now,
          }),
        decisionWrite,
        eventWrite,
        outboxWrite,
      ]);
    } catch (e) {
      if (!existing) await bucket.delete(objectKey);
      throw e;
    }
  } else if (c.action === "create_derivative") {
    const original = await readEvidence(c.tenantId, c.matterId, c.evidenceId);
    if (!original) throw new Error("Original evidence missing");
    const [prior] = await db
        .select({ version: documentDerivatives.version })
        .from(documentDerivatives)
        .where(
          and(
            eq(documentDerivatives.tenantId, c.tenantId),
            eq(documentDerivatives.evidenceId, c.evidenceId),
            eq(documentDerivatives.derivativeKind, c.derivativeKind),
          ),
        )
        .orderBy(desc(documentDerivatives.version))
        .limit(1),
      version = (prior?.version ?? 0) + 1,
      bytes = buildDerivativePdf(
        c.title,
        c.derivativeKind,
        original.originalSha256,
        c.sourcePageStart,
        c.sourcePageEnd,
      ),
      sha = await digest(bytes),
      objectKey = `${c.tenantId}/${c.matterId}/${c.evidenceId}/derivatives/${c.derivativeId}.pdf`;
    await bucket.put(objectKey, bytes, {
      httpMetadata: { contentType: "application/pdf" },
      customMetadata: {
        tenantId: c.tenantId,
        matterId: c.matterId,
        evidenceId: c.evidenceId,
        derivativeId: c.derivativeId,
        parentSha256: original.originalSha256,
        sha256: sha,
      },
    });
    try {
      await db.batch([
        db
          .insert(documentDerivatives)
          .values({
            id: c.derivativeId,
            tenantId: c.tenantId,
            matterId: c.matterId,
            evidenceId: c.evidenceId,
            parentDerivativeId: c.parentDerivativeId,
            derivativeKind: c.derivativeKind,
            version,
            title: c.title,
            objectKey,
            sha256: sha,
            sourcePageStart: c.sourcePageStart,
            sourcePageEnd: c.sourcePageEnd,
            status: "draft",
            providerMode: c.providerMode,
            createdBy: input.actor.userId,
            createdAt: now,
          }),
        decisionWrite,
        eventWrite,
        outboxWrite,
      ]);
    } catch (e) {
      await bucket.delete(objectKey);
      throw e;
    }
  } else if (c.action === "record_provider_block") {
    const [prior] = await db
      .select({ version: documentDerivatives.version })
      .from(documentDerivatives)
      .where(
        and(
          eq(documentDerivatives.tenantId, c.tenantId),
          eq(documentDerivatives.evidenceId, c.evidenceId),
          eq(documentDerivatives.derivativeKind, c.derivativeKind),
        ),
      )
      .orderBy(desc(documentDerivatives.version))
      .limit(1);
    await db.batch([
      db
        .insert(documentDerivatives)
        .values({
          id: c.derivativeId,
          tenantId: c.tenantId,
          matterId: c.matterId,
          evidenceId: c.evidenceId,
          derivativeKind: c.derivativeKind,
          version: (prior?.version ?? 0) + 1,
          title: `Blocked ${c.derivativeKind.replaceAll("_", " ")}`,
          sourcePageStart: 1,
          sourcePageEnd: 1,
          status: "blocked",
          providerMode: "not_connected",
          createdBy: input.actor.userId,
          createdAt: now,
        }),
      decisionWrite,
      eventWrite,
      outboxWrite,
    ]);
  } else if (c.action === "approve_derivative")
    await db.batch([
      db
        .update(documentDerivatives)
        .set({
          status: "approved",
          approvedBy: input.actor.userId,
          approvedAt: now,
        })
        .where(
          and(
            eq(documentDerivatives.tenantId, c.tenantId),
            eq(documentDerivatives.id, c.derivativeId),
            eq(documentDerivatives.status, "draft"),
          ),
        ),
      decisionWrite,
      eventWrite,
      outboxWrite,
    ]);
  else if (c.action === "assign_bates") {
    const d = await readDerivative(c.tenantId, c.matterId, c.derivativeId);
    if (!d) throw new Error("Derivative missing");
    await db.batch([
      db
        .insert(batesAssignments)
        .values({
          id: c.assignmentId,
          tenantId: c.tenantId,
          matterId: c.matterId,
          derivativeId: c.derivativeId,
          prefix: c.prefix,
          startNumber: c.startNumber,
          endNumber: c.startNumber + (d.sourcePageEnd - d.sourcePageStart),
          digits: c.digits,
          assignedBy: input.actor.userId,
          eventId: input.event.eventId,
          createdAt: now,
        }),
      decisionWrite,
      eventWrite,
      outboxWrite,
    ]);
  } else if (c.action === "assign_exhibit")
    await db.batch([
      db
        .insert(exhibitAssignments)
        .values({
          id: c.assignmentId,
          tenantId: c.tenantId,
          matterId: c.matterId,
          derivativeId: c.derivativeId,
          proceedingId: c.proceedingId,
          exhibitLabel: c.exhibitLabel,
          description: c.description,
          assignedBy: input.actor.userId,
          eventId: input.event.eventId,
          createdAt: now,
        }),
      decisionWrite,
      eventWrite,
      outboxWrite,
    ]);
  else if (c.action === "create_production_set")
    await db.batch([
      db
        .insert(productionSets)
        .values({
          id: c.productionSetId,
          tenantId: c.tenantId,
          matterId: c.matterId,
          title: c.title,
          purpose: c.purpose,
          status: "draft",
          itemCount: 0,
          pageCount: 0,
          revision: 1,
          createdBy: input.actor.userId,
          createdAt: now,
          updatedAt: now,
        }),
      decisionWrite,
      eventWrite,
      outboxWrite,
    ]);
  else {
    const set = await readProductionSet(
      c.tenantId,
      c.matterId,
      c.productionSetId,
    );
    if (!set || set.revision !== c.expectedRevision)
      throw new Error("Production set changed; refresh");
    if (c.action === "add_production_item") {
      const pages = c.includedPageEnd - c.includedPageStart + 1;
      await db.batch([
        db
          .insert(productionSetItems)
          .values({
            id: c.itemId,
            tenantId: c.tenantId,
            matterId: c.matterId,
            productionSetId: c.productionSetId,
            evidenceId: c.evidenceId,
            derivativeId: c.derivativeId,
            position: c.position,
            includedPageStart: c.includedPageStart,
            includedPageEnd: c.includedPageEnd,
            privilegeReviewed: c.privilegeReviewed,
            confidentialityReviewed: c.confidentialityReviewed,
            createdAt: now,
          }),
        db
          .update(productionSets)
          .set({
            itemCount: set.itemCount + 1,
            pageCount: set.pageCount + pages,
            revision: set.revision + 1,
            updatedAt: now,
          })
          .where(
            and(
              eq(productionSets.tenantId, c.tenantId),
              eq(productionSets.id, c.productionSetId),
              eq(productionSets.revision, c.expectedRevision),
            ),
          ),
        decisionWrite,
        eventWrite,
        outboxWrite,
      ]);
    } else if (c.action === "validate_production_set")
      await db.batch([
        db
          .update(productionSets)
          .set({
            status: "validated",
            itemCount: input.validation?.itemCount ?? set.itemCount,
            pageCount: input.validation?.pageCount ?? set.pageCount,
            revision: set.revision + 1,
            updatedAt: now,
          })
          .where(
            and(
              eq(productionSets.tenantId, c.tenantId),
              eq(productionSets.id, c.productionSetId),
              eq(productionSets.revision, c.expectedRevision),
            ),
          ),
        decisionWrite,
        eventWrite,
        outboxWrite,
      ]);
    else if (c.action === "approve_production_set")
      await db.batch([
        db
          .update(productionSets)
          .set({
            status: "approved",
            revision: set.revision + 1,
            approvedBy: input.actor.userId,
            approvedAt: now,
            updatedAt: now,
          })
          .where(
            and(
              eq(productionSets.tenantId, c.tenantId),
              eq(productionSets.id, c.productionSetId),
              eq(productionSets.revision, c.expectedRevision),
            ),
          ),
        decisionWrite,
        eventWrite,
        outboxWrite,
      ]);
    else {
      const manifest = {
          version: 1,
          productionSetId: set.id,
          matterId: c.matterId,
          items: set.items.map((x) => ({
            position: x.position,
            evidenceId: x.evidenceId,
            derivativeId: x.derivativeId,
            pages: [x.includedPageStart, x.includedPageEnd],
            privilegeReviewed: x.privilegeReviewed,
            confidentialityReviewed: x.confidentialityReviewed,
          })),
        },
        bytes = new TextEncoder().encode(JSON.stringify(manifest)),
        sha = await digest(bytes),
        objectKey = `${c.tenantId}/${c.matterId}/production-sets/${c.productionSetId}/manifest.json`;
      await bucket.put(objectKey, bytes, {
        httpMetadata: { contentType: "application/json" },
        customMetadata: {
          tenantId: c.tenantId,
          matterId: c.matterId,
          productionSetId: c.productionSetId,
          sha256: sha,
        },
      });
      try {
        await db.batch([
          db
            .update(productionSets)
            .set({
              status: "export_ready",
              manifestObjectKey: objectKey,
              manifestSha256: sha,
              revision: set.revision + 1,
              updatedAt: now,
            })
            .where(
              and(
                eq(productionSets.tenantId, c.tenantId),
                eq(productionSets.id, c.productionSetId),
                eq(productionSets.revision, c.expectedRevision),
              ),
            ),
          decisionWrite,
          eventWrite,
          outboxWrite,
        ]);
      } catch (e) {
        await bucket.delete(objectKey);
        throw e;
      }
    }
  }
  return { replayed: false, eventId: input.event.eventId };
}
function eventValues(
  e: EventEnvelope<Record<string, unknown>>,
  actor: RequestActor,
) {
  return {
    eventId: e.eventId,
    eventType: e.eventType,
    eventVersion: e.eventVersion,
    tenantId: e.tenantId,
    aggregateType: e.aggregateType,
    aggregateId: e.aggregateId,
    matterId: e.matterId,
    actorId: actor.userId,
    occurredAt: new Date(e.occurredAt),
    correlationId: e.correlationId,
    causationId: e.causationId,
    idempotencyKey: e.idempotencyKey,
    source: e.source,
    visibility: e.visibility,
    retentionPolicy: e.retentionPolicy,
    payload: e.payload,
  };
}
function reason(c: DocumentEvidenceCommand) {
  if ("reason" in c) return c.reason;
  if (c.action === "create_derivative")
    return `${c.derivativeKind}:${c.sourcePageStart}-${c.sourcePageEnd}`;
  if (c.action === "assign_exhibit") return c.description;
  if (c.action === "create_production_set") return c.purpose;
  return null;
}
async function digest(bytes: Uint8Array) {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const hash = await crypto.subtle.digest("SHA-256", copy.buffer);
  return Array.from(new Uint8Array(hash), (x) =>
    x.toString(16).padStart(2, "0"),
  ).join("");
}
function buildDerivativePdf(
  title: string,
  kind: string,
  parentSha: string,
  start: number,
  end: number,
) {
  const safe =
      `ATHENA SYNTHETIC DERIVATIVE | ${kind} | ${title} | source ${start}-${end} | parent ${parentSha}`.replace(
        /[()\\]/g,
        " ",
      ),
    content = `BT\n/F1 9 Tf\n36 720 Td\n(${safe}) Tj\nET\n`,
    encoder = new TextEncoder(),
    objects = [
      "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
      "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n",
      "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n",
      "4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n",
      `5 0 obj\n<< /Length ${encoder.encode(content).byteLength} >>\nstream\n${content}endstream\nendobj\n`,
    ];
  let pdf = "%PDF-1.4\n%ATHENA-DERIVATIVE\n";
  const offsets = [0];
  for (const object of objects) {
    offsets.push(encoder.encode(pdf).byteLength);
    pdf += object;
  }
  const xref = encoder.encode(pdf).byteLength;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets.slice(1))
    pdf += `${offset.toString().padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return encoder.encode(pdf);
}
