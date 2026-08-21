import { z } from "zod";
import { createEvent } from "@/platform/events";
import {
  AuthorizationError,
  requireRole,
  type TenantContext,
} from "@/platform/tenant-context";
const id = z.string().min(3).max(160),
  detail = z.string().trim().min(12).max(2000),
  base = {
    tenantId: z.string().min(1),
    identityId: id,
    idempotencyKey: z.string().min(8).max(200),
  },
  rev = z.number().int().positive();
export const directoryCommand = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("register_fixture_identity"),
    ...base,
    connectionId: id,
    email: z.string().email().max(254),
    displayName: z.string().min(3).max(200),
    fixtureAcknowledged: z.literal(true),
  }),
  z.object({
    action: z.literal("activate_local_identity"),
    ...base,
    expectedRevision: rev,
    reason: detail,
  }),
  z.object({
    action: z.literal("assign_role"),
    ...base,
    expectedRevision: rev,
    assignmentId: id,
    roleCode: z.enum([
      "partner",
      "attorney",
      "paralegal",
      "legal_assistant",
      "billing_specialist",
      "docketing_specialist",
      "security_admin",
    ]),
    scopeType: z.enum(["firm", "matter"]),
    matterId: id.nullable(),
    grantReason: detail,
  }),
  z.object({
    action: z.literal("start_offboarding"),
    ...base,
    expectedRevision: rev,
    offboardingRunId: id,
    reason: detail,
  }),
  z.object({
    action: z.literal("revoke_assignments"),
    ...base,
    expectedRevision: rev,
    offboardingRunId: id,
    expectedRunRevision: rev,
    revocationEvidence: detail,
  }),
  z.object({
    action: z.literal("record_session_revocation"),
    ...base,
    expectedRevision: rev,
    offboardingRunId: id,
    expectedRunRevision: rev,
    mode: z.enum(["not_connected", "human_verified_external", "live"]),
    evidence: detail,
  }),
]);
export type DirectoryCommand = z.infer<typeof directoryCommand>;
export type DirectoryIdentityState = {
  id: string;
  status: "invited" | "active" | "suspended" | "offboarded";
  revision: number;
};
export type OffboardingState = {
  id: string;
  status:
    | "initiated"
    | "assignments_revoked"
    | "session_revocation_blocked"
    | "completed";
  revision: number;
};
export function decideDirectory(input: {
  context: TenantContext;
  raw: unknown;
  identity?: DirectoryIdentityState | null;
  run?: OffboardingState | null;
  targetExists?: boolean;
  activeAssignmentCount?: number;
}) {
  const c = directoryCommand.parse(input.raw);
  if (c.tenantId !== input.context.tenantId) throw new AuthorizationError();
  requireRole(input.context, ["partner", "security_admin"]);
  let fromStatus = "not_created",
    toStatus = "invited";
  if (c.action === "register_fixture_identity") {
    if (input.targetExists)
      throw new Error("Directory identity already exists");
  } else {
    const identity = input.identity;
    if (
      !identity ||
      identity.id !== c.identityId ||
      identity.revision !== c.expectedRevision
    )
      throw new Error("Directory identity changed; refresh before retrying");
    fromStatus = identity.status;
    if (c.action === "activate_local_identity") {
      if (identity.status !== "invited")
        throw new Error(
          `activate_local_identity is not allowed from ${identity.status}`,
        );
      toStatus = "active";
    } else if (c.action === "assign_role") {
      if (identity.status !== "active")
        throw new Error("Roles may be assigned only to an active identity");
      if (c.scopeType === "matter" && !c.matterId)
        throw new Error("Matter-scoped roles require a matter identity");
      if (c.scopeType === "firm" && c.matterId)
        throw new Error("Firm-scoped roles cannot name a matter");
      toStatus = "active";
    } else if (c.action === "start_offboarding") {
      if (identity.status !== "active")
        throw new Error(
          `start_offboarding is not allowed from ${identity.status}`,
        );
      if (identity.id === input.context.userId)
        throw new Error(
          "Administrators cannot offboard their own active session",
        );
      toStatus = "suspended";
    } else {
      const run = input.run;
      if (
        !run ||
        run.id !== c.offboardingRunId ||
        run.revision !== c.expectedRunRevision
      )
        throw new Error("Offboarding run changed; refresh before retrying");
      if (identity.status !== "suspended")
        throw new Error("Offboarding requires a suspended identity");
      if (c.action === "revoke_assignments") {
        if (run.status !== "initiated")
          throw new Error(
            `revoke_assignments is not allowed from ${run.status}`,
          );
        if ((input.activeAssignmentCount ?? 0) < 1)
          throw new Error("No active assignments were found to revoke");
        toStatus = "suspended";
      } else {
        if (
          !["assignments_revoked", "session_revocation_blocked"].includes(
            run.status,
          )
        )
          throw new Error(
            `record_session_revocation is not allowed from ${run.status}`,
          );
        if (c.mode !== "not_connected" && c.evidence.length < 20)
          throw new Error(
            "Verified external revocation requires specific evidence",
          );
        toStatus = c.mode === "not_connected" ? "suspended" : "offboarded";
      }
    }
  }
  return {
    command: c,
    fromStatus,
    toStatus,
    event: createEvent({
      eventType: `identity.${c.action}`,
      tenantId: c.tenantId,
      aggregateType: "directory_identity",
      aggregateId: c.identityId,
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
        directoryConnected: false,
        automaticSessionRevocationConnected: false,
      },
    }),
  };
}
