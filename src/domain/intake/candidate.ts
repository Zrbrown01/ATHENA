import { z } from "zod";
import { createEvent } from "@/platform/events";
import {
  authorizeMatter,
  requireRole,
  type TenantContext,
} from "@/platform/tenant-context";

const base = {
  tenantId: z.string().min(1),
  candidateId: z.string().min(3).max(120),
  matterId: z.string().min(3).max(120),
  idempotencyKey: z.string().min(8).max(200),
};
const opening = {
  expectedRevision: z.number().int().positive(),
  reason: z.string().trim().min(12).max(1000),
  openingTriggerDate: z.iso.date(),
  syntheticDataAcknowledged: z.literal(true),
};
export const intakeCandidateCommand = z.discriminatedUnion("action", [
  z.object({ action: z.literal("create_candidate"), ...base }),
  z.object({
    action: z.literal("clear_conflict"),
    ...base,
    conflictId: z.string().min(3),
    expectedRevision: z.number().int().positive(),
    reason: z.string().trim().min(12).max(1000),
  }),
  z.object({
    action: z.literal("resolve_match"),
    ...base,
    matchId: z.string().min(3),
    disposition: z.enum(["ruled_out", "confirmed_duplicate"]),
    expectedRevision: z.number().int().positive(),
    reason: z.string().trim().min(12).max(1000),
  }),
  z.object({
    action: z.literal("supply_information"),
    ...base,
    expectedRevision: z.number().int().positive(),
    fields: z
      .array(
        z.enum([
          "claim_number",
          "adj_number",
          "injury_date",
          "claims_professional_email",
        ]),
      )
      .min(1),
    reason: z.string().trim().min(12).max(1000),
  }),
  z.object({ action: z.literal("approve_open"), ...base, ...opening }),
  z.object({
    action: z.literal("materialize_initial_obligations"),
    ...base,
    ...opening,
  }),
  z.object({
    action: z.literal("reject"),
    ...base,
    expectedRevision: z.number().int().positive(),
    reason: z.string().trim().min(12).max(1000),
  }),
]);
export type IntakeCandidateCommand = z.infer<typeof intakeCandidateCommand>;
export type IntakeCandidateState = {
  id: string;
  proposedMatterId: string;
  status:
    | "conflict_review"
    | "missing_information"
    | "ready_to_open"
    | "opened"
    | "rejected";
  revision: number;
  missingFields: string[];
};

export function decideIntakeCandidate(input: {
  context: TenantContext;
  raw: unknown;
  current?: IntakeCandidateState | null;
  openConflictCount?: number;
  unresolvedMatchCount?: number;
  openingPlanCount?: number;
  existingOpeningObligationCount?: number;
}) {
  const command = intakeCandidateCommand.parse(input.raw);
  authorizeMatter(input.context, command.tenantId, command.matterId);
  requireRole(
    input.context,
    command.action === "clear_conflict" || command.action === "resolve_match"
      ? ["partner", "firm_admin"]
      : command.action === "approve_open" ||
          command.action === "materialize_initial_obligations" ||
          command.action === "reject"
        ? ["attorney", "partner"]
        : ["attorney", "partner", "paralegal"],
  );
  let fromStatus = "not_created",
    toStatus: IntakeCandidateState["status"] = "conflict_review";
  if (command.action === "create_candidate" && input.current)
    throw new Error("Intake candidate already exists");
  if (command.action !== "create_candidate") {
    const current = input.current;
    if (
      !current ||
      current.id !== command.candidateId ||
      current.proposedMatterId !== command.matterId
    )
      throw new Error("Intake candidate does not exist in this matter scope");
    if (
      current.status === "rejected" ||
      (current.status === "opened" &&
        command.action !== "materialize_initial_obligations")
    )
      throw new Error("Intake candidate is terminal");
    if (
      command.action === "materialize_initial_obligations" &&
      current.status !== "opened"
    )
      throw new Error(
        "Initial obligations can be migrated only for an opened matter",
      );
    if (current.revision !== command.expectedRevision)
      throw new Error("Intake candidate changed; refresh before retrying");
    fromStatus = current.status;
    if (command.action === "clear_conflict")
      toStatus = current.missingFields.length
        ? "missing_information"
        : "ready_to_open";
    if (command.action === "resolve_match")
      toStatus =
        command.disposition === "confirmed_duplicate"
          ? "rejected"
          : current.missingFields.length
            ? "missing_information"
            : (input.openConflictCount ?? 0) > 0
              ? "conflict_review"
              : "ready_to_open";
    if (command.action === "supply_information") {
      const remaining = current.missingFields.filter(
        (field) => !command.fields.includes(field as never),
      );
      toStatus = remaining.length
        ? "missing_information"
        : (input.openConflictCount ?? 0) > 0
          ? "conflict_review"
          : "ready_to_open";
    }
    if (command.action === "approve_open") {
      if (
        current.status !== "ready_to_open" ||
        current.missingFields.length ||
        (input.openConflictCount ?? 0) > 0 ||
        (input.unresolvedMatchCount ?? 0) > 0
      )
        throw new Error(
          "Matter cannot open until missing information, duplicate matches, and conflicts are resolved",
        );
      toStatus = "opened";
    }
    if (command.action === "materialize_initial_obligations")
      toStatus = "opened";
    if (
      (command.action === "approve_open" ||
        command.action === "materialize_initial_obligations") &&
      input.openingPlanCount !== 2
    )
      throw new Error(
        "The complete governed opening-obligation bundle is required",
      );
    if (
      (command.action === "approve_open" ||
        command.action === "materialize_initial_obligations") &&
      (input.existingOpeningObligationCount ?? 0) > 0
    )
      throw new Error("Initial opening obligations already exist");
    if (command.action === "reject") toStatus = "rejected";
  }
  const eventType =
    command.action === "create_candidate"
      ? "intake.candidate_created"
      : command.action === "clear_conflict"
        ? "intake.conflict_cleared"
        : command.action === "resolve_match"
          ? "intake.match_resolved"
          : command.action === "supply_information"
            ? "intake.information_supplied"
            : command.action === "approve_open"
              ? "intake.matter_opened"
              : command.action === "materialize_initial_obligations"
                ? "intake.initial_obligations_materialized"
                : "intake.candidate_rejected";
  return {
    command,
    fromStatus,
    toStatus,
    event: createEvent({
      eventType,
      tenantId: command.tenantId,
      aggregateType: "intake_candidate",
      aggregateId: command.candidateId,
      matterId: command.matterId,
      actorId: input.context.userId,
      correlationId: command.idempotencyKey,
      idempotencyKey: command.idempotencyKey,
      source: "athena.web",
      visibility: "restricted",
      retentionPolicy: "matter-lifecycle-plus-firm-retention",
      payload: {
        action: command.action,
        fromStatus,
        toStatus,
        humanAuthorized: command.action !== "create_candidate",
        providerMode: "deterministic_sandbox",
        openConflictCount: input.openConflictCount ?? 0,
        unresolvedMatchCount: input.unresolvedMatchCount ?? 0,
        openingObligationCount: input.openingPlanCount ?? 0,
        legalContentStatus:
          command.action === "approve_open" ||
          command.action === "materialize_initial_obligations"
            ? "synthetic_sandbox"
            : null,
      },
    }),
  };
}
