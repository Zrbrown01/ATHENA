import { z } from "zod";
import { calculateDeadline, type DeadlineResult } from "./deadline";
import { createEvent } from "@/platform/events";
import {
  authorizeMatter,
  requireRole,
  type TenantContext,
} from "@/platform/tenant-context";

const identifier = z.string().trim().min(3).max(160);
const evidence = z.string().trim().min(12).max(1500);
const base = {
  tenantId: identifier,
  matterId: identifier,
  idempotencyKey: z.string().min(8).max(200),
};

export const governanceScopeTypes = [
  "firm",
  "client",
  "matter_type",
  "matter",
] as const;

export const policySimulationCommand = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("create_layer"),
    ...base,
    layerId: identifier,
    code: z.string().trim().min(4).max(120),
    version: z.number().int().positive(),
    scopeType: z.enum(governanceScopeTypes),
    scopeId: identifier,
    businessDays: z.number().int().min(0).max(365),
    authorityCitation: evidence,
    effectiveDate: z.iso.date(),
    reviewDate: z.iso.date(),
    contentStatus: z.enum([
      "synthetic_sandbox",
      "pending_attorney_review",
      "attorney_approved",
    ]),
    supersedesLayerId: identifier.nullable(),
    expectedSupersededRevision: z.number().int().positive().nullable(),
    reason: evidence,
    sandboxAcknowledged: z.boolean(),
  }),
  z.object({
    action: z.literal("simulate"),
    ...base,
    simulationId: identifier,
    code: z.string().trim().min(4).max(120),
    triggerDate: z.iso.date(),
    asOfDate: z.iso.date(),
    clientId: identifier,
    matterType: identifier,
    sandboxAcknowledged: z.boolean(),
  }),
]);

export type PolicySimulationCommand = z.infer<typeof policySimulationCommand>;

export type GovernancePolicyLayerState = {
  id: string;
  code: string;
  version: number;
  scopeType: (typeof governanceScopeTypes)[number];
  scopeId: string;
  businessDays: number;
  authorityCitation: string;
  effectiveAt: Date;
  reviewBy: Date;
  contentStatus:
    "synthetic_sandbox" | "pending_attorney_review" | "attorney_approved";
  status: "active" | "superseded";
  revision: number;
  supersedesLayerId: string | null;
};

export type PolicySubject = {
  tenantId: string;
  clientId: string;
  matterType: string;
  matterId: string;
};

export type PolicyResolution = {
  selected: GovernancePolicyLayerState;
  applicable: GovernancePolicyLayerState[];
  deadline: DeadlineResult;
  trace: string[];
};

const precedence = new Map(
  governanceScopeTypes.map((scope, index) => [scope, index]),
);

export function resolveGovernancePolicy(input: {
  layers: GovernancePolicyLayerState[];
  code: string;
  subject: PolicySubject;
  triggerDate: string;
  asOfDate: string;
  holidays: Set<string>;
  sandboxAcknowledged: boolean;
}): PolicyResolution {
  const applicable = input.layers
    .filter(
      (layer) =>
        layer.code === input.code &&
        layer.status === "active" &&
        layerApplies(layer, input.subject),
    )
    .sort(
      (left, right) =>
        (precedence.get(left.scopeType) ?? -1) -
          (precedence.get(right.scopeType) ?? -1) ||
        left.version - right.version,
    );
  const selected = applicable.at(-1);
  if (!selected) throw new Error("No applicable active policy layer exists");

  const effective = selected.effectiveAt.toISOString().slice(0, 10);
  const review = selected.reviewBy.toISOString().slice(0, 10);
  if (input.asOfDate < effective)
    throw new Error("The selected policy layer is not yet effective");
  if (input.asOfDate > review)
    throw new Error("The selected policy layer requires renewed review");
  if (selected.contentStatus === "pending_attorney_review")
    throw new Error("The selected policy layer is pending attorney review");
  if (
    selected.contentStatus === "synthetic_sandbox" &&
    !input.sandboxAcknowledged
  )
    throw new Error("Synthetic policy simulation must be acknowledged");

  const deadline = calculateDeadline(
    input.triggerDate,
    {
      code: selected.code,
      version: selected.version,
      authorityType: "client_policy",
      authorityCitation: selected.authorityCitation,
      baseDays: selected.businessDays,
      dayKind: "business",
      rollConvention: "next_business_day",
      effectiveDate: effective,
      reviewDate: review,
    },
    input.holidays,
  );
  return {
    selected,
    applicable,
    deadline,
    trace: [
      ...applicable.map(
        (layer) =>
          `${layer.scopeType}:${layer.scopeId} selected candidate ${layer.code}@${layer.version}`,
      ),
      `Precedence selected ${selected.scopeType}:${selected.scopeId}`,
      ...deadline.trace,
    ],
  };
}

export function diffGovernanceLayers(
  prior: GovernancePolicyLayerState,
  next: GovernancePolicyLayerState,
) {
  if (prior.code !== next.code)
    throw new Error("Only versions of the same policy code can be compared");
  return {
    priorLayerId: prior.id,
    nextLayerId: next.id,
    businessDaysDelta: next.businessDays - prior.businessDays,
    authorityCitationChanged:
      prior.authorityCitation !== next.authorityCitation,
    contentStatusChanged: prior.contentStatus !== next.contentStatus,
    scopeChanged:
      prior.scopeType !== next.scopeType || prior.scopeId !== next.scopeId,
  };
}

export function decidePolicySimulation(input: {
  context: TenantContext;
  raw: unknown;
  currentScopeLayer?: GovernancePolicyLayerState | null;
  supersededLayer?: GovernancePolicyLayerState | null;
  resolution?: PolicyResolution | null;
}) {
  const command = policySimulationCommand.parse(input.raw);
  authorizeMatter(input.context, command.tenantId, command.matterId);
  requireRole(
    input.context,
    command.action === "create_layer"
      ? ["partner"]
      : ["attorney", "partner", "docketing_specialist"],
  );

  if (command.action === "create_layer") {
    if (command.contentStatus === "attorney_approved")
      throw new Error(
        "Attorney-approved content requires the external legal-review activation process",
      );
    if (
      command.contentStatus === "synthetic_sandbox" &&
      !command.sandboxAcknowledged
    )
      throw new Error("Synthetic policy content must be acknowledged");
    if (command.reviewDate <= command.effectiveDate)
      throw new Error("Policy review must occur after its effective date");
    const expectedScopeId =
      command.scopeType === "firm" ? command.tenantId : command.scopeId;
    if (command.scopeId !== expectedScopeId)
      throw new Error("Firm policy scope must use the tenant identifier");

    if (input.currentScopeLayer) {
      if (
        command.supersedesLayerId !== input.currentScopeLayer.id ||
        command.expectedSupersededRevision !==
          input.currentScopeLayer.revision ||
        command.version !== input.currentScopeLayer.version + 1
      )
        throw new Error("Active policy layer changed; refresh before retrying");
    } else if (
      command.supersedesLayerId !== null ||
      command.expectedSupersededRevision !== null ||
      command.version !== 1
    ) {
      throw new Error("The first policy layer must begin at version 1");
    }
    if (
      command.supersedesLayerId &&
      input.supersededLayer?.id !== command.supersedesLayerId
    )
      throw new Error("Superseded policy layer could not be verified");
  } else if (!input.resolution) {
    throw new Error("A validated policy resolution is required");
  }

  const aggregateId =
    command.action === "create_layer" ? command.layerId : command.simulationId;
  return {
    command,
    event: createEvent({
      eventType: `governance_policy.${command.action}`,
      tenantId: command.tenantId,
      aggregateType: "governance_policy",
      aggregateId,
      matterId: command.matterId,
      actorId: input.context.userId,
      correlationId: command.idempotencyKey,
      idempotencyKey: command.idempotencyKey,
      source: "athena.web",
      visibility: "internal",
      retentionPolicy: "matter-lifecycle-plus-firm-retention",
      payload: {
        action: command.action,
        humanAuthorized: true,
        legalContentActivated: false,
        selectedLayerId: input.resolution?.selected.id ?? null,
        dueDate: input.resolution?.deadline.dueDate ?? null,
      },
    }),
  };
}

function layerApplies(
  layer: GovernancePolicyLayerState,
  subject: PolicySubject,
) {
  if (layer.scopeType === "firm") return layer.scopeId === subject.tenantId;
  if (layer.scopeType === "client") return layer.scopeId === subject.clientId;
  if (layer.scopeType === "matter_type")
    return layer.scopeId === subject.matterType;
  return layer.scopeId === subject.matterId;
}
