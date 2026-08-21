import { z } from "zod";
import type { DirectoryProviderIdentity } from "@/integrations/directory";
import { createEvent } from "@/platform/events";
import {
  AuthorizationError,
  requireRole,
  type TenantContext,
} from "@/platform/tenant-context";

const id = z.string().min(3).max(160);
const base = {
  tenantId: z.string().min(1),
  reconciliationId: id,
  idempotencyKey: z.string().min(8).max(200),
};

export const directoryReconciliationCommand = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("run_sandbox_reconciliation"),
    ...base,
    connectionId: id,
    snapshotAsOf: z.iso.datetime(),
    fixtureAcknowledged: z.literal(true),
  }),
  z.object({
    action: z.literal("review_reconciliation"),
    ...base,
    expectedRevision: z.number().int().positive(),
    outcome: z.enum(["certified", "exceptions_noted"]),
    notes: z.string().trim().min(20).max(2000),
  }),
]);

export type DirectoryReconciliationCommand = z.infer<
  typeof directoryReconciliationCommand
>;

export type LocalDirectoryIdentity = {
  id: string;
  normalizedEmail: string;
  status: "invited" | "active" | "suspended" | "offboarded";
  mfaState: "unknown" | "enforced" | "not_enforced";
  roleCodes: string[];
};

export type DirectoryReconciliationFinding = {
  identityId: string | null;
  externalObjectId: string | null;
  normalizedEmail: string;
  code:
    | "missing_provider_identity"
    | "unmanaged_provider_identity"
    | "status_drift"
    | "role_drift"
    | "mfa_claim_unverified";
  severity: "medium" | "high" | "critical";
  blocking: boolean;
  localValue: unknown;
  providerValue: unknown;
  explanation: string;
};

export type DirectoryReconciliationState = {
  id: string;
  status: "clean" | "findings_open" | "reviewed";
  revision: number;
  findingCount: number;
  blockingFindingCount: number;
};

export function evaluateDirectoryReconciliation(input: {
  local: LocalDirectoryIdentity[];
  provider: DirectoryProviderIdentity[];
}) {
  const findings: DirectoryReconciliationFinding[] = [];
  const localByEmail = new Map(
    input.local.map((identity) => [identity.normalizedEmail, identity]),
  );
  const providerByEmail = new Map(
    input.provider.map((identity) => [identity.normalizedEmail, identity]),
  );
  let matchedIdentityCount = 0;

  for (const local of input.local) {
    const provider = providerByEmail.get(local.normalizedEmail);
    if (!provider) {
      findings.push({
        identityId: local.id,
        externalObjectId: null,
        normalizedEmail: local.normalizedEmail,
        code: "missing_provider_identity",
        severity: "critical",
        blocking: true,
        localValue: { status: local.status, roleCodes: local.roleCodes },
        providerValue: null,
        explanation:
          "An Athena identity has no matching record in the supplied directory snapshot.",
      });
      continue;
    }
    matchedIdentityCount += 1;
    const localEnabled = local.status === "active";
    if (localEnabled !== provider.enabled)
      findings.push({
        identityId: local.id,
        externalObjectId: provider.externalObjectId,
        normalizedEmail: local.normalizedEmail,
        code: "status_drift",
        severity: "critical",
        blocking: true,
        localValue: { status: local.status },
        providerValue: { enabled: provider.enabled },
        explanation:
          "Athena access state and the directory enabled state do not agree.",
      });
    if (local.mfaState !== provider.mfaState)
      findings.push({
        identityId: local.id,
        externalObjectId: provider.externalObjectId,
        normalizedEmail: local.normalizedEmail,
        code: "mfa_claim_unverified",
        severity: "high",
        blocking: true,
        localValue: { mfaState: local.mfaState },
        providerValue: { mfaState: provider.mfaState },
        explanation:
          "Athena does not hold a verified MFA claim matching the directory snapshot.",
      });
    const localRoles = [...local.roleCodes].sort();
    const providerRoles = [...provider.roleCodes].sort();
    if (JSON.stringify(localRoles) !== JSON.stringify(providerRoles))
      findings.push({
        identityId: local.id,
        externalObjectId: provider.externalObjectId,
        normalizedEmail: local.normalizedEmail,
        code: "role_drift",
        severity: "high",
        blocking: true,
        localValue: { roleCodes: localRoles },
        providerValue: { roleCodes: providerRoles },
        explanation:
          "Athena role assignments and the directory snapshot do not reconcile.",
      });
  }

  for (const provider of input.provider)
    if (!localByEmail.has(provider.normalizedEmail))
      findings.push({
        identityId: null,
        externalObjectId: provider.externalObjectId,
        normalizedEmail: provider.normalizedEmail,
        code: "unmanaged_provider_identity",
        severity: "critical",
        blocking: true,
        localValue: null,
        providerValue: {
          enabled: provider.enabled,
          roleCodes: provider.roleCodes,
        },
        explanation:
          "The directory snapshot contains an identity that Athena does not manage.",
      });

  return {
    localIdentityCount: input.local.length,
    providerIdentityCount: input.provider.length,
    matchedIdentityCount,
    findingCount: findings.length,
    blockingFindingCount: findings.filter((finding) => finding.blocking).length,
    findings,
  };
}

export function decideDirectoryReconciliation(input: {
  context: TenantContext;
  raw: unknown;
  current?: DirectoryReconciliationState | null;
}) {
  const command = directoryReconciliationCommand.parse(input.raw);
  if (command.tenantId !== input.context.tenantId)
    throw new AuthorizationError();
  requireRole(input.context, ["partner", "security_admin"]);

  let fromStatus = "not_created";
  let toStatus: DirectoryReconciliationState["status"] = "findings_open";
  if (command.action === "review_reconciliation") {
    const current = input.current;
    if (
      !current ||
      current.id !== command.reconciliationId ||
      current.revision !== command.expectedRevision
    )
      throw new Error(
        "Directory reconciliation changed; refresh before retrying",
      );
    if (current.status === "reviewed")
      throw new Error("Directory reconciliation has already been reviewed");
    if (
      current.blockingFindingCount > 0 &&
      command.outcome !== "exceptions_noted"
    )
      throw new Error("Blocking identity drift cannot be certified as clean");
    if (current.findingCount === 0 && command.outcome !== "certified")
      throw new Error("A clean reconciliation must be certified");
    fromStatus = current.status;
    toStatus = "reviewed";
  }

  return {
    command,
    fromStatus,
    toStatus,
    event: createEvent({
      eventType: `identity.${command.action}`,
      tenantId: command.tenantId,
      aggregateType: "directory_reconciliation",
      aggregateId: command.reconciliationId,
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
        provider: "microsoft_entra",
        providerMode: "deterministic_sandbox",
        liveDirectoryConnected: false,
        humanAuthorized: true,
      },
    }),
  };
}
