import { z } from "zod";
import { createEvent } from "@/platform/events";
import {
  authorizeMatter,
  requireRole,
  type TenantContext,
} from "@/platform/tenant-context";
const id = z.string().min(3).max(120),
  base = {
    tenantId: id,
    matterId: id,
    idempotencyKey: z.string().min(8).max(200),
  },
  date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export const authorityCommand = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("propose"),
    ...base,
    candidateId: id,
    classification: z.enum([
      "request",
      "recommendation",
      "grant",
      "historical_quote",
      "hypothetical",
      "third_party_statement",
    ]),
    amountCents: z.number().int().positive().optional(),
    currency: z.literal("USD"),
    settlementStructure: z.enum(["C&R", "stipulations", "either"]).optional(),
    scope: z.string().trim().min(3).max(500).optional(),
    includes: z.array(z.string().min(2).max(160)).max(30).default([]),
    excludes: z.array(z.string().min(2).max(160)).max(30).default([]),
    conditions: z.array(z.string().min(3).max(500)).max(30).default([]),
    negotiationThresholdCents: z.number().int().positive().optional(),
    grantorName: z.string().min(3).max(200),
    grantorRole: z.string().min(3).max(120),
    grantorOrganization: z.string().min(3).max(200),
    effectiveDate: date.optional(),
    expiresDate: date.optional(),
    sourceType: z.literal("synthetic_email"),
    sourceId: id,
    sourceExcerpt: z.string().min(12).max(2000),
  }),
  z.object({
    action: z.literal("confirm"),
    ...base,
    candidateId: id,
    expectedRevision: z.number().int().positive(),
    reason: z.string().min(12).max(1000),
  }),
  z.object({
    action: z.literal("not_authority"),
    ...base,
    candidateId: id,
    expectedRevision: z.number().int().positive(),
    reason: z.string().min(12).max(1000),
  }),
  z.object({
    action: z.enum(["expire", "withdraw", "use"]),
    ...base,
    ledgerId: id,
    expectedRevision: z.number().int().positive(),
    reason: z.string().min(12).max(1000),
  }),
]);
export type AuthorityCommand = z.infer<typeof authorityCommand>;
export type AuthorityCandidateState = {
  id: string;
  classification:
    | "request"
    | "recommendation"
    | "grant"
    | "historical_quote"
    | "hypothetical"
    | "third_party_statement";
  amountCents: number | null;
  settlementStructure: string | null;
  scope: string | null;
  effectiveAt: Date | null;
  expiresAt: Date | null;
  status: "proposed" | "confirmed" | "not_authority";
  revision: number;
  negotiationThresholdCents: number | null;
};
export type AuthorityLedgerState = {
  id: string;
  status: "confirmed" | "expired" | "withdrawn" | "used" | "superseded";
  revision: number;
};
export function decideAuthority(input: {
  context: TenantContext;
  raw: unknown;
  candidate?: AuthorityCandidateState | null;
  ledger?: AuthorityLedgerState | null;
}) {
  const command = authorityCommand.parse(input.raw);
  authorizeMatter(input.context, command.tenantId, command.matterId);
  requireRole(input.context, ["attorney", "partner"]);
  if (command.action === "propose") {
    if (
      command.negotiationThresholdCents &&
      command.amountCents &&
      command.negotiationThresholdCents > command.amountCents
    )
      throw new Error("Negotiation threshold cannot exceed maximum authority");
    if (
      command.effectiveDate &&
      command.expiresDate &&
      command.expiresDate < command.effectiveDate
    )
      throw new Error("Authority expiration cannot precede its effective date");
  }
  if (command.action === "confirm" || command.action === "not_authority") {
    const candidate = input.candidate;
    if (!candidate || candidate.id !== command.candidateId)
      throw new Error("Authority candidate does not exist");
    if (candidate.revision !== command.expectedRevision)
      throw new Error("Authority candidate changed; refresh before retrying");
    if (candidate.status !== "proposed")
      throw new Error("Authority candidate is terminal");
    if (
      command.action === "confirm" &&
      (candidate.classification !== "grant" ||
        !candidate.amountCents ||
        !candidate.settlementStructure ||
        !candidate.scope ||
        !candidate.effectiveAt)
    )
      throw new Error(
        "Only a complete verified grant can become active authority",
      );
  }
  if (
    command.action === "expire" ||
    command.action === "withdraw" ||
    command.action === "use"
  ) {
    const ledger = input.ledger;
    if (!ledger || ledger.id !== command.ledgerId)
      throw new Error("Authority ledger entry does not exist");
    if (ledger.revision !== command.expectedRevision)
      throw new Error("Authority ledger changed; refresh before retrying");
    if (ledger.status !== "confirmed")
      throw new Error("Only confirmed authority can transition");
  }
  const aggregateId =
      "candidateId" in command ? command.candidateId : command.ledgerId,
    eventType =
      command.action === "propose"
        ? "authority.candidate_proposed"
        : command.action === "confirm"
          ? "authority.confirmed"
          : command.action === "not_authority"
            ? "authority.not_authority"
            : ({ expire: "authority.expired", withdraw: "authority.withdrawn", use: "authority.used" } as const)[command.action];
  return {
    command,
    event: createEvent({
      eventType,
      tenantId: command.tenantId,
      aggregateType:
        command.action === "propose" ||
        command.action === "confirm" ||
        command.action === "not_authority"
          ? "authority_candidate"
          : "authority_ledger",
      aggregateId,
      matterId: command.matterId,
      actorId: input.context.userId,
      correlationId: command.idempotencyKey,
      idempotencyKey: command.idempotencyKey,
      source: "athena.web",
      visibility: "restricted",
      retentionPolicy: "matter-lifecycle-plus-firm-retention",
      payload: {
        action: command.action,
        classification:
          "classification" in command
            ? command.classification
            : (input.candidate?.classification ?? null),
        humanAuthorized: command.action !== "propose",
        historicalLedger: true,
      },
    }),
  };
}
