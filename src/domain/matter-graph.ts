import { z } from "zod";
import { createEvent } from "@/platform/events";
import { authorizeMatter, requireRole, type TenantContext } from "@/platform/tenant-context";

const id = z.string().trim().min(3).max(120);
const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const entityType = z.enum(["matter", "claim", "injury", "adjudication_case"]);

export const matterGraphCommand = z.object({
  action: z.literal("materialize_graph"),
  tenantId: id,
  matterId: id,
  idempotencyKey: z.string().min(8).max(200),
  graph: z.object({
    matter: z.object({ id, matterNumber: id, caption: z.string().trim().min(5).max(240), status: z.enum(["intake", "open", "stayed", "closed"]), clientName: z.string().trim().min(2).max(200), employerName: z.string().trim().min(2).max(200), applicantName: z.string().trim().min(2).max(200), assignedAttorneyId: id.optional() }),
    claims: z.array(z.object({ id, claimNumber: id, carrierName: z.string().trim().max(200).optional(), administratorName: z.string().trim().max(200).optional() })).min(1).max(20),
    injuries: z.array(z.object({ id, claimId: id.optional(), injuryType: z.enum(["specific", "cumulative", "occupational_disease", "other"]), dateFrom: dateOnly, dateTo: dateOnly.optional(), bodyParts: z.array(z.string().trim().min(2).max(80)).min(1).max(30) })).min(1).max(30),
    adjudicationCases: z.array(z.object({ id, adjNumber: z.string().trim().regex(/^ADJ\d+$/i), venue: z.string().trim().max(160).optional(), districtOffice: z.string().trim().max(160).optional(), status: z.enum(["unfiled", "active", "stayed", "closed"]) })).max(20),
    sourceLinks: z.array(z.object({ id, entityType, entityId: id, sourceSystem: id, sourceRecordId: id, providerMode: z.literal("deterministic_sandbox") })).min(1).max(100),
    relationships: z.array(z.object({ id, fromEntityType: entityType, fromEntityId: id, relationshipType: z.enum(["contains", "covers", "adjudicates"]), toEntityType: entityType, toEntityId: id, sourceLinkId: id })).min(1).max(100),
  }),
}).superRefine((command, context) => {
  if (command.graph.matter.id !== command.matterId) context.addIssue({ code: "custom", path: ["graph", "matter", "id"], message: "Matter identity must match the command scope" });
  const entities = new Set([command.graph.matter.id, ...command.graph.claims.map((item) => item.id), ...command.graph.injuries.map((item) => item.id), ...command.graph.adjudicationCases.map((item) => item.id)]);
  if (entities.size !== 1 + command.graph.claims.length + command.graph.injuries.length + command.graph.adjudicationCases.length) context.addIssue({ code: "custom", path: ["graph"], message: "Every graph entity must have a distinct identity" });
  const claimIds = new Set(command.graph.claims.map((item) => item.id));
  command.graph.injuries.forEach((injury, index) => {
    if (injury.claimId && !claimIds.has(injury.claimId)) context.addIssue({ code: "custom", path: ["graph", "injuries", index, "claimId"], message: "Injury claim must exist in the same graph" });
    if (injury.dateTo && injury.dateTo < injury.dateFrom) context.addIssue({ code: "custom", path: ["graph", "injuries", index, "dateTo"], message: "Injury end date cannot precede its start date" });
  });
  const linkIds = new Set(command.graph.sourceLinks.map((item) => item.id));
  command.graph.sourceLinks.forEach((link, index) => { if (!entities.has(link.entityId)) context.addIssue({ code: "custom", path: ["graph", "sourceLinks", index, "entityId"], message: "Source provenance must point to an entity in this graph" }); });
  command.graph.relationships.forEach((relationship, index) => {
    if (!entities.has(relationship.fromEntityId) || !entities.has(relationship.toEntityId)) context.addIssue({ code: "custom", path: ["graph", "relationships", index], message: "Relationship endpoints must exist in this graph" });
    if (!linkIds.has(relationship.sourceLinkId)) context.addIssue({ code: "custom", path: ["graph", "relationships", index, "sourceLinkId"], message: "Relationship provenance link must exist" });
  });
});

export type MatterGraphCommand = z.infer<typeof matterGraphCommand>;

export function decideMatterGraph(input: { context: TenantContext; raw: unknown }) {
  const command = matterGraphCommand.parse(input.raw);
  authorizeMatter(input.context, command.tenantId, command.matterId);
  requireRole(input.context, ["attorney", "partner", "paralegal", "firm_admin"]);
  return {
    command,
    event: createEvent({ eventType: "matter.graph_materialized", tenantId: command.tenantId, aggregateType: "matter", aggregateId: command.matterId, matterId: command.matterId, actorId: input.context.userId, correlationId: command.idempotencyKey, idempotencyKey: command.idempotencyKey, source: "athena.web", visibility: "restricted", retentionPolicy: "matter-lifecycle-plus-firm-retention", payload: { entityCounts: { matters: 1, claims: command.graph.claims.length, injuries: command.graph.injuries.length, adjudicationCases: command.graph.adjudicationCases.length, relationships: command.graph.relationships.length, sourceLinks: command.graph.sourceLinks.length }, providerMode: "deterministic_sandbox", flattened: false } }),
  };
}

export const goldenMatterGraph: MatterGraphCommand["graph"] = {
  matter: { id: "matter-golden-001", matterNumber: "NRL-2026-0042", caption: "Rivera v. Northstar Logistics", status: "open", clientName: "Summit Claims Services", employerName: "Northstar Logistics, Inc.", applicantName: "Elena Rivera", assignedAttorneyId: "user-maya-chen" },
  claims: [{ id: "claim-golden-001", claimNumber: "SCS-CA-884103", carrierName: "Summit Casualty", administratorName: "Summit Claims Services" }],
  injuries: [{ id: "injury-golden-001", claimId: "claim-golden-001", injuryType: "specific", dateFrom: "2025-11-04", bodyParts: ["lumbar spine"] }],
  adjudicationCases: [{ id: "adj-case-golden-001", adjNumber: "ADJ18420931", venue: "WCAB", districtOffice: "Los Angeles", status: "active" }],
  sourceLinks: [
    { id: "source-matter-golden-001", entityType: "matter", entityId: "matter-golden-001", sourceSystem: "meruscase_sandbox", sourceRecordId: "sandbox-merus-matter-0042", providerMode: "deterministic_sandbox" },
    { id: "source-claim-golden-001", entityType: "claim", entityId: "claim-golden-001", sourceSystem: "meruscase_sandbox", sourceRecordId: "sandbox-merus-claim-884103", providerMode: "deterministic_sandbox" },
    { id: "source-injury-golden-001", entityType: "injury", entityId: "injury-golden-001", sourceSystem: "meruscase_sandbox", sourceRecordId: "sandbox-merus-injury-20251104", providerMode: "deterministic_sandbox" },
    { id: "source-adj-golden-001", entityType: "adjudication_case", entityId: "adj-case-golden-001", sourceSystem: "meruscase_sandbox", sourceRecordId: "sandbox-merus-adj-18420931", providerMode: "deterministic_sandbox" },
  ],
  relationships: [
    { id: "rel-matter-claim-001", fromEntityType: "matter", fromEntityId: "matter-golden-001", relationshipType: "contains", toEntityType: "claim", toEntityId: "claim-golden-001", sourceLinkId: "source-claim-golden-001" },
    { id: "rel-claim-injury-001", fromEntityType: "claim", fromEntityId: "claim-golden-001", relationshipType: "covers", toEntityType: "injury", toEntityId: "injury-golden-001", sourceLinkId: "source-injury-golden-001" },
    { id: "rel-adj-injury-001", fromEntityType: "adjudication_case", fromEntityId: "adj-case-golden-001", relationshipType: "adjudicates", toEntityType: "injury", toEntityId: "injury-golden-001", sourceLinkId: "source-adj-golden-001" },
  ],
};
