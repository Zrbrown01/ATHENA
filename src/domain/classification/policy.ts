import { z } from "zod";
import { createEvent } from "@/platform/events";
import {
  AuthorizationError,
  authorizeMatter,
  requireRole,
  type TenantContext,
} from "@/platform/tenant-context";
export const classificationLabel = z.enum([
  "public",
  "internal",
  "confidential",
  "privileged",
  "medical_sensitive",
  "personal_information",
  "financial",
  "authentication_sensitive",
  "ethical_wall_restricted",
  "client_restricted",
  "ai_restricted",
  "legal_hold",
]);
export const classificationPlane = z.enum([
  "access",
  "search",
  "ai",
  "sharing",
  "download",
  "printing",
  "retention",
  "export",
  "logging",
]);
const id = z.string().min(3).max(160),
  detail = z.string().trim().min(12).max(1500),
  base = {
    tenantId: z.string().min(1),
    matterId: id,
    resourceType: z.string().min(3).max(80),
    resourceId: id,
    idempotencyKey: z.string().min(8).max(200),
  };
export const classificationCommand = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("register_fixture_classification"),
    ...base,
    classificationId: id,
    policyId: id,
    labels: z.array(classificationLabel).min(1).max(12),
    source: detail,
    fixtureAcknowledged: z.literal(true),
  }),
  z.object({
    action: z.literal("evaluate_plane"),
    ...base,
    plane: classificationPlane,
    purpose: detail,
  }),
  z.object({
    action: z.literal("approve_override"),
    ...base,
    overrideId: id,
    plane: classificationPlane,
    reason: detail,
    expiresAt: z.string().datetime(),
  }),
]);
export type ClassificationCommand = z.infer<typeof classificationCommand>;
export type Plane = z.infer<typeof classificationPlane>;
export type Label = z.infer<typeof classificationLabel>;
export type ClassificationState = { labels: Label[]; policyVersion: number };
export type OverrideState = {
  id: string;
  plane: string;
  status: "active" | "expired" | "revoked";
  expiresAt: Date;
};
const sensitive = new Set<Label>([
    "confidential",
    "privileged",
    "medical_sensitive",
    "personal_information",
    "financial",
    "authentication_sensitive",
    "ethical_wall_restricted",
    "client_restricted",
    "ai_restricted",
  ]),
  nonOverridable = new Set<Label>([
    "authentication_sensitive",
    "ethical_wall_restricted",
    "ai_restricted",
    "legal_hold",
  ]);
export function evaluateClassification(input: {
  context: TenantContext;
  tenantId: string;
  matterId: string;
  plane: Plane;
  labels: Label[];
  override?: OverrideState | null;
  now?: Date;
}) {
  authorizeMatter(input.context, input.tenantId, input.matterId);
  const labels = [...new Set(input.labels)],
    reasons: string[] = [];
  let outcome: "allow" | "deny" | "redact" | "retain" = "allow";
  if (input.plane === "retention" && labels.includes("legal_hold")) {
    outcome = "retain";
    reasons.push("active_legal_hold_requires_retention");
  } else if (
    input.plane === "ai" &&
    labels.some((x) =>
      [
        "privileged",
        "medical_sensitive",
        "authentication_sensitive",
        "ethical_wall_restricted",
        "ai_restricted",
      ].includes(x),
    )
  ) {
    outcome = "deny";
    reasons.push("classification_prohibits_ai_use");
  } else if (
    input.plane === "sharing" &&
    labels.some((x) =>
      [
        "privileged",
        "medical_sensitive",
        "authentication_sensitive",
        "ethical_wall_restricted",
        "client_restricted",
      ].includes(x),
    )
  ) {
    outcome = "deny";
    reasons.push("classification_prohibits_external_sharing");
  } else if (
    input.plane === "printing" &&
    labels.some((x) =>
      [
        "privileged",
        "medical_sensitive",
        "authentication_sensitive",
        "ethical_wall_restricted",
      ].includes(x),
    )
  ) {
    outcome = "deny";
    reasons.push("classification_prohibits_printing");
  } else if (
    ["access", "download", "export"].includes(input.plane) &&
    labels.includes("authentication_sensitive")
  ) {
    outcome = "deny";
    reasons.push("authentication_sensitive_content_restricted");
  } else if (
    input.plane === "search" &&
    labels.some((x) =>
      ["authentication_sensitive", "ethical_wall_restricted"].includes(x),
    )
  ) {
    outcome = "redact";
    reasons.push("search_metadata_only");
  } else if (
    input.plane === "logging" &&
    labels.some((x) => sensitive.has(x))
  ) {
    outcome = "redact";
    reasons.push("sensitive_values_excluded_from_logs");
  } else reasons.push("authorized_matter_scope_and_policy_allow");
  const override = input.override,
    overrideUsable = Boolean(
      override &&
      override.plane === input.plane &&
      override.status === "active" &&
      override.expiresAt > (input.now ?? new Date()) &&
      !labels.some((x) => nonOverridable.has(x)) &&
      outcome === "deny",
    );
  if (overrideUsable) {
    outcome = "allow";
    reasons.push("active_human_override");
  }
  return {
    outcome,
    reasonCodes: reasons,
    overrideId: overrideUsable ? override!.id : null,
    denyOverridesAllow: true,
  };
}
export function decideClassification(input: {
  context: TenantContext;
  raw: unknown;
  classification?: ClassificationState | null;
  override?: OverrideState | null;
  targetExists?: boolean;
}) {
  const c = classificationCommand.parse(input.raw);
  if (c.tenantId !== input.context.tenantId) throw new AuthorizationError();
  authorizeMatter(input.context, c.tenantId, c.matterId);
  let result: ReturnType<typeof evaluateClassification> | undefined;
  if (c.action === "register_fixture_classification") {
    requireRole(input.context, ["partner", "security_admin"]);
    if (input.targetExists)
      throw new Error("Resource classification already exists");
  } else {
    if (!input.classification)
      throw new Error("Resource classification does not exist");
    if (c.action === "approve_override") {
      requireRole(input.context, ["partner", "security_admin"]);
      if (new Date(c.expiresAt) <= new Date())
        throw new Error("Override expiry must be in the future");
      if (input.classification.labels.some((x) => nonOverridable.has(x)))
        throw new Error("This classification cannot be overridden");
    } else
      result = evaluateClassification({
        context: input.context,
        tenantId: c.tenantId,
        matterId: c.matterId,
        plane: c.plane,
        labels: input.classification.labels,
        override: input.override,
      });
  }
  return {
    command: c,
    result,
    event: createEvent({
      eventType: `classification.${c.action}`,
      tenantId: c.tenantId,
      aggregateType: "resource_classification",
      aggregateId: c.resourceId,
      matterId: c.matterId,
      actorId: input.context.userId,
      correlationId: c.idempotencyKey,
      idempotencyKey: c.idempotencyKey,
      source: "athena.web",
      visibility: "restricted",
      retentionPolicy: "security-permanent",
      payload: {
        action: c.action,
        plane: "plane" in c ? c.plane : null,
        outcome: result?.outcome ?? "classified",
        denyOverridesAllow: true,
      },
    }),
  };
}
