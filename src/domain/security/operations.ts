import { z } from "zod";
import { createEvent } from "@/platform/events";
import {
  AuthorizationError,
  requireRole,
  type TenantContext,
} from "@/platform/tenant-context";

const id = z.string().min(3).max(160);
const detail = z.string().trim().min(12).max(3000);
const sha256 = z.string().regex(/^[a-f0-9]{64}$/);
const base = {
  tenantId: z.string().min(1),
  idempotencyKey: z.string().min(8).max(200),
};
const revision = z.number().int().positive();
const stringList = z.array(z.string().trim().min(2).max(160)).min(1).max(30);

export const securityOperationsCommand = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("create_incident"),
    ...base,
    incidentId: id,
    title: z.string().trim().min(8).max(240),
    detectedAt: z.string().datetime(),
    detectionSource: detail,
    severity: z.enum(["low", "moderate", "high", "critical"]),
    systems: stringList,
    affectedTenantIds: stringList,
    affectedMatterIds: z.array(id).max(100),
    informationCategories: stringList,
    suspectedAccess: z.boolean(),
    confirmedAccess: z.literal(false),
    incidentLead: id,
  }),
  z.object({
    action: z.literal("scope_incident"),
    ...base,
    incidentId: id,
    expectedRevision: revision,
    systems: stringList,
    affectedTenantIds: stringList,
    affectedMatterIds: z.array(id).max(100),
    informationCategories: stringList,
    suspectedAccess: z.boolean(),
    confirmedAccess: z.boolean(),
    evidencePreservationRef: detail,
    scopeSummary: detail,
  }),
  z.object({
    action: z.literal("contain_incident"),
    ...base,
    incidentId: id,
    expectedRevision: revision,
    containmentSummary: detail,
    containmentEvidenceRef: detail,
    sessionRevocationMode: z.enum(["not_connected", "human_verified_external"]),
    sessionRevocationEvidence: detail,
  }),
  z.object({
    action: z.literal("assess_breach"),
    ...base,
    incidentId: id,
    expectedRevision: revision,
    assessmentId: id,
    conclusion: z.enum(["undetermined", "not_a_breach", "breach_confirmed"]),
    legalAnalysis: detail,
    notificationDecision: z.enum(["pending", "not_required", "required"]),
    contractualDeadlines: z
      .array(
        z.object({
          obligation: z.string().min(3).max(240),
          dueAt: z.string().datetime(),
          source: z.string().min(3).max(500),
        }),
      )
      .max(30),
    privilegeRestricted: z.literal(true),
  }),
  z.object({
    action: z.literal("begin_recovery"),
    ...base,
    incidentId: id,
    expectedRevision: revision,
    recoverySummary: detail,
    recoveryEvidenceRef: detail,
    restorationVerified: z.literal(true),
  }),
  z.object({
    action: z.literal("record_root_cause"),
    ...base,
    incidentId: id,
    expectedRevision: revision,
    rootCause: detail,
    correctiveAction: detail,
    correctiveActionEvidenceRef: detail,
  }),
  z.object({
    action: z.literal("close_incident"),
    ...base,
    incidentId: id,
    expectedRevision: revision,
    closureApproval: detail,
    effectivenessReview: detail,
  }),
  z.object({
    action: z.literal("register_control"),
    ...base,
    controlId: id,
    code: z.string().min(3).max(40),
    title: z.string().min(8).max(240),
    controlFamily: z.string().min(3).max(120),
    ownerId: id,
    description: detail,
    reviewCadenceDays: z.number().int().min(7).max(730),
  }),
  z.object({
    action: z.literal("attach_control_evidence"),
    ...base,
    controlId: id,
    expectedRevision: revision,
    evidenceId: id,
    evidenceType: z.enum([
      "test_result",
      "configuration_snapshot",
      "procedure",
      "decision_record",
      "recovery_record",
    ]),
    title: z.string().min(8).max(240),
    evidenceRef: detail,
    evidenceSha256: sha256,
    outcome: z.enum(["pass", "fail", "needs_review"]),
    validFrom: z.string().datetime(),
    validUntil: z.string().datetime(),
  }),
  z.object({
    action: z.literal("register_risk"),
    ...base,
    riskId: id,
    title: z.string().min(8).max(240),
    category: z.string().min(3).max(120),
    description: detail,
    likelihood: z.number().int().min(1).max(5),
    impact: z.number().int().min(1).max(5),
    ownerId: id,
  }),
  z.object({
    action: z.literal("plan_risk_treatment"),
    ...base,
    riskId: id,
    expectedRevision: revision,
    treatmentId: id,
    strategy: z.enum(["mitigate", "avoid", "transfer", "accept"]),
    actionPlan: detail,
    controlIds: z.array(id).min(1).max(30),
    ownerId: id,
    dueAt: z.string().datetime(),
    residualScore: z.number().int().min(1).max(25),
    approvalEvidence: detail,
  }),
]);

export type SecurityOperationsCommand = z.infer<
  typeof securityOperationsCommand
>;
export type IncidentState = {
  id: string;
  status:
    | "detected"
    | "scoped"
    | "contained"
    | "legal_review"
    | "recovering"
    | "root_cause_review"
    | "closed";
  revision: number;
};
export type ControlState = {
  id: string;
  status: "designed" | "implemented" | "verified" | "deficient";
  revision: number;
};
export type RiskState = {
  id: string;
  status: "open" | "treatment_planned" | "accepted" | "mitigated" | "closed";
  revision: number;
  inherentScore: number;
};

const incidentExpected = {
  scope_incident: "detected",
  contain_incident: "scoped",
  assess_breach: "contained",
  begin_recovery: "legal_review",
  record_root_cause: "recovering",
  close_incident: "root_cause_review",
} as const;
const incidentTo = {
  scope_incident: "scoped",
  contain_incident: "contained",
  assess_breach: "legal_review",
  begin_recovery: "recovering",
  record_root_cause: "root_cause_review",
  close_incident: "closed",
} as const;

export function decideSecurityOperations(input: {
  context: TenantContext;
  raw: unknown;
  incident?: IncidentState | null;
  control?: ControlState | null;
  risk?: RiskState | null;
  targetExists?: boolean;
}) {
  const command = securityOperationsCommand.parse(input.raw);
  if (input.context.tenantId !== command.tenantId)
    throw new AuthorizationError();
  requireRole(input.context, ["partner", "security_admin"]);
  let aggregateType: "incident" | "security_control" | "risk";
  let aggregateId: string;
  let fromStatus = "not_created";
  let toStatus = "created";

  if (command.action === "create_incident") {
    aggregateType = "incident";
    aggregateId = command.incidentId;
    toStatus = "detected";
    if (input.targetExists) throw new Error("Incident identity already exists");
  } else if (
    [
      "scope_incident",
      "contain_incident",
      "assess_breach",
      "begin_recovery",
      "record_root_cause",
      "close_incident",
    ].includes(command.action)
  ) {
    const c = command as Extract<
      SecurityOperationsCommand,
      { incidentId: string; expectedRevision: number }
    >;
    const state = input.incident;
    if (
      !state ||
      state.id !== c.incidentId ||
      state.revision !== c.expectedRevision
    )
      throw new Error("Incident changed; refresh before retrying");
    const expected =
      incidentExpected[c.action as keyof typeof incidentExpected];
    if (state.status !== expected)
      throw new Error(`${c.action} is not allowed from ${state.status}`);
    aggregateType = "incident";
    aggregateId = c.incidentId;
    fromStatus = state.status;
    toStatus = incidentTo[c.action as keyof typeof incidentTo];
  } else if (command.action === "register_control") {
    aggregateType = "security_control";
    aggregateId = command.controlId;
    toStatus = "designed";
    if (input.targetExists)
      throw new Error("Security control identity already exists");
  } else if (command.action === "attach_control_evidence") {
    const state = input.control;
    if (
      !state ||
      state.id !== command.controlId ||
      state.revision !== command.expectedRevision
    )
      throw new Error("Security control changed; refresh before retrying");
    if (new Date(command.validUntil) <= new Date(command.validFrom))
      throw new Error("Evidence validity must end after it begins");
    aggregateType = "security_control";
    aggregateId = command.controlId;
    fromStatus = state.status;
    toStatus =
      command.outcome === "pass"
        ? "verified"
        : command.outcome === "fail"
          ? "deficient"
          : "implemented";
  } else if (command.action === "register_risk") {
    aggregateType = "risk";
    aggregateId = command.riskId;
    toStatus = "open";
    if (input.targetExists) throw new Error("Risk identity already exists");
  } else {
    const riskCommand = command as Extract<
      SecurityOperationsCommand,
      { action: "plan_risk_treatment" }
    >;
    const state = input.risk;
    if (
      !state ||
      state.id !== riskCommand.riskId ||
      state.revision !== riskCommand.expectedRevision
    )
      throw new Error("Risk changed; refresh before retrying");
    if (state.status !== "open")
      throw new Error(
        `plan_risk_treatment is not allowed from ${state.status}`,
      );
    if (riskCommand.residualScore > state.inherentScore)
      throw new Error("Residual risk cannot exceed inherent risk");
    aggregateType = "risk";
    aggregateId = riskCommand.riskId;
    fromStatus = state.status;
    toStatus =
      riskCommand.strategy === "accept" ? "accepted" : "treatment_planned";
  }

  return {
    command,
    aggregateType,
    aggregateId,
    fromStatus,
    toStatus,
    event: createEvent({
      eventType: `security.${command.action}`,
      tenantId: command.tenantId,
      aggregateType,
      aggregateId,
      actorId: input.context.userId,
      correlationId: command.idempotencyKey,
      idempotencyKey: command.idempotencyKey,
      source: "athena.web",
      visibility: "restricted",
      retentionPolicy: "security-permanent",
      payload: {
        action: command.action,
        fromStatus,
        toStatus,
        humanAuthorized: true,
        automaticRevocationConnected: false,
        externalAlertingConnected: false,
      },
    }),
  };
}
