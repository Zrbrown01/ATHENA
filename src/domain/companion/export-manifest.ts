import { companionFixture } from "./fixture";

export type ExportEvent = { eventId: string; eventType: string; occurredAt: Date | string; actorId: string; payload: unknown };

export function buildCompanionExport(input: { tenantId: string; matterId: string; generatedAt: Date; generatedBy: string; events: ExportEvent[] }) {
  return {
    manifestVersion: 1,
    classification: "synthetic-pilot-export",
    tenantId: input.tenantId,
    matterId: input.matterId,
    generatedAt: input.generatedAt.toISOString(),
    generatedBy: input.generatedBy,
    matter: companionFixture.matter,
    sourceDocument: companionFixture.document,
    sourceLinkedFacts: companionFixture.facts,
    workProduct: companionFixture.workProduct,
    candidateTime: companionFixture.time,
    events: input.events,
    limitations: ["Synthetic fixture export only", "No production PHI", "Original PDF bytes are not part of this deterministic fixture", "Microsoft delivery is blocked and not represented as sent"],
  };
}
