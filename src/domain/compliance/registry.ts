import { z } from "zod";
import { createEvent } from "@/platform/events";
import {
  AuthorizationError,
  requireRole,
  type TenantContext,
} from "@/platform/tenant-context";
const id = z.string().min(3).max(160),
  detail = z.string().trim().min(12).max(2500),
  sha = z.string().regex(/^[a-f0-9]{64}$/),
  base = {
    tenantId: z.string().min(1),
    subprocessorId: id,
    idempotencyKey: z.string().min(8).max(200),
  },
  rev = z.number().int().positive();
export const complianceRegistryCommand = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("register_candidate"),
    ...base,
    name: z.string().min(3).max(200),
    service: z.string().min(3).max(200),
    dataRegions: z.array(z.string().min(2)).min(1).max(20),
    dataCategories: z.array(z.string().min(2)).min(1).max(30),
    usesAi: z.boolean(),
    trainingUse: z.enum(["unknown", "prohibited", "allowed"]),
    ownerId: id,
    syntheticAcknowledged: z.literal(true),
  }),
  z.object({
    action: z.literal("record_security_review"),
    ...base,
    expectedRevision: rev,
    reviewId: id,
    outcome: z.enum(["pass", "fail", "needs_remediation"]),
    controlsReviewed: z.array(z.string().min(3)).min(3).max(50),
    evidenceRef: detail,
    evidenceSha256: sha,
    validUntil: z.string().datetime(),
  }),
  z.object({
    action: z.literal("record_agreement"),
    ...base,
    expectedRevision: rev,
    agreementId: id,
    agreementType: z.enum(["baa", "dpa", "msa"]),
    status: z.enum(["draft", "executed", "not_required"]),
    effectiveAt: z.string().datetime().nullable(),
    expiresAt: z.string().datetime().nullable(),
    artifactRef: detail,
    artifactSha256: sha,
  }),
  z.object({
    action: z.literal("approve_data_use"),
    ...base,
    expectedRevision: rev,
    authorityId: id,
    purpose: detail,
    allowedDataCategories: z.array(z.string().min(2)).min(1).max(30),
    allowedOperations: z.array(z.string().min(2)).min(1).max(30),
    aiAllowed: z.boolean(),
    trainingUseProhibited: z.boolean(),
  }),
  z.object({
    action: z.literal("assess_activation"),
    ...base,
    expectedRevision: rev,
    assessmentId: id,
    reason: detail,
  }),
]);
export type ComplianceRegistryCommand = z.infer<
  typeof complianceRegistryCommand
>;
export type SubprocessorState = {
  id: string;
  status:
    | "candidate"
    | "under_review"
    | "contractually_eligible"
    | "rejected"
    | "suspended";
  revision: number;
  dataCategories: string[];
  trainingUse: "unknown" | "prohibited" | "allowed";
};
export type ActivationInputs = {
  securityPass: boolean;
  securityValid: boolean;
  baaSatisfied: boolean;
  dpaSatisfied: boolean;
  dataUseApproved: boolean;
  authorizedCategories: string[];
  trainingUseProhibited: boolean;
};
export function evaluateActivation(v: SubprocessorState, x: ActivationInputs) {
  const missing: string[] = [];
  if (!x.securityPass || !x.securityValid)
    missing.push("current_security_review");
  if (!x.baaSatisfied)
    missing.push("executed_baa_or_approved_not_required_basis");
  if (!x.dpaSatisfied)
    missing.push("executed_dpa_or_approved_not_required_basis");
  if (!x.dataUseApproved) missing.push("approved_data_use_authority");
  if (!v.dataCategories.every((c) => x.authorizedCategories.includes(c)))
    missing.push("complete_data_category_scope");
  if (v.trainingUse !== "prohibited" || !x.trainingUseProhibited)
    missing.push("training_use_prohibition");
  return {
    outcome: missing.length
      ? ("blocked" as const)
      : ("contractually_eligible" as const),
    missingRequirements: missing,
    credentialActivationAllowed: false as const,
    providerConnected: false as const,
  };
}
export function decideComplianceRegistry(input: {
  context: TenantContext;
  raw: unknown;
  vendor?: SubprocessorState | null;
  targetExists?: boolean;
  activationInputs?: ActivationInputs;
}) {
  const c = complianceRegistryCommand.parse(input.raw);
  if (c.tenantId !== input.context.tenantId) throw new AuthorizationError();
  requireRole(input.context, ["partner", "security_admin"]);
  let fromStatus = "not_created",
    toStatus = "candidate",
    assessment: ReturnType<typeof evaluateActivation> | undefined;
  if (c.action === "register_candidate") {
    if (input.targetExists)
      throw new Error("Subprocessor identity already exists");
  } else {
    const v = input.vendor;
    if (!v || v.id !== c.subprocessorId || v.revision !== c.expectedRevision)
      throw new Error("Subprocessor changed; refresh before retrying");
    fromStatus = v.status;
    if (!["candidate", "under_review"].includes(v.status))
      throw new Error(`${c.action} is not allowed from ${v.status}`);
    toStatus = "under_review";
    if (
      c.action === "record_security_review" &&
      new Date(c.validUntil) <= new Date()
    )
      throw new Error("Security review must remain currently valid");
    if (
      c.action === "record_agreement" &&
      c.status === "executed" &&
      !c.effectiveAt
    )
      throw new Error("Executed agreements require an effective date");
    if (c.action === "assess_activation") {
      if (!input.activationInputs)
        throw new Error("Activation inputs are required");
      assessment = evaluateActivation(v, input.activationInputs);
      toStatus = assessment.outcome;
    }
  }
  return {
    command: c,
    fromStatus,
    toStatus,
    assessment,
    event: createEvent({
      eventType: `compliance.${c.action}`,
      tenantId: c.tenantId,
      aggregateType: "subprocessor",
      aggregateId: c.subprocessorId,
      actorId: input.context.userId,
      correlationId: c.idempotencyKey,
      idempotencyKey: c.idempotencyKey,
      source: "athena.web",
      visibility: "restricted",
      retentionPolicy: "security-permanent",
      payload: {
        action: c.action,
        fromStatus,
        toStatus,
        humanAuthorized: true,
        providerConnected: false,
        credentialActivationAllowed: false,
      },
    }),
  };
}
