import { z } from "zod";
import { createEvent } from "@/platform/events";
import {
  AuthorizationError,
  requireRole,
  type TenantContext,
} from "@/platform/tenant-context";

const id = z.string().min(3).max(160),
  detail = z.string().trim().min(12).max(2000),
  sha = z.string().regex(/^[a-f0-9]{64}$/);
const base = {
  tenantId: z.string().min(1),
  exerciseId: id,
  idempotencyKey: z.string().min(8).max(200),
};
const check = z.object({
  code: z.enum([
    "table_count",
    "event_count",
    "outbox_count",
    "snapshot_checksum",
    "tenant_scope",
  ]),
  expectedValue: z.string().min(1).max(200),
  actualValue: z.string().min(1).max(200),
  outcome: z.enum(["pass", "fail"]),
  evidenceRef: detail,
});
export const recoveryCommand = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("register_local_snapshot"),
    ...base,
    snapshotId: id,
    scope: detail,
    objectRef: detail,
    snapshotSha256: sha,
    byteSize: z.number().int().positive(),
    tableCount: z.number().int().positive(),
    dataAsOf: z.string().datetime(),
    localExportAcknowledged: z.literal(true),
  }),
  z.object({
    action: z.literal("record_disposable_restore"),
    ...base,
    expectedRevision: z.literal(1),
    targetEnvironment: z.string().min(8).max(200),
    durationSeconds: z.number().int().positive(),
    rpoSeconds: z.number().int().nonnegative(),
    rtoSeconds: z.number().int().positive(),
    productionMutation: z.literal(false),
    evidenceRef: detail,
  }),
  z.object({
    action: z.literal("verify_restore"),
    ...base,
    expectedRevision: z.literal(2),
    checks: z.array(check).length(5),
    reason: detail,
  }),
  z.object({
    action: z.literal("approve_exercise"),
    ...base,
    expectedRevision: z.literal(3),
    approvalId: id,
    scopeLimitation: detail,
    notes: detail,
  }),
]);
export type RecoveryCommand = z.infer<typeof recoveryCommand>;
export type RecoveryExerciseState = {
  id: string;
  status: "planned" | "restored" | "verified" | "approved" | "failed";
  revision: number;
};

export function decideRecovery(input: {
  context: TenantContext;
  raw: unknown;
  exercise?: RecoveryExerciseState | null;
  targetExists?: boolean;
}) {
  const c = recoveryCommand.parse(input.raw);
  if (input.context.tenantId !== c.tenantId) throw new AuthorizationError();
  requireRole(input.context, ["partner", "security_admin"]);
  let fromStatus = "not_created",
    toStatus = "planned";
  if (c.action === "register_local_snapshot") {
    if (input.targetExists)
      throw new Error("Recovery exercise identity already exists");
  } else {
    const state = input.exercise;
    if (
      !state ||
      state.id !== c.exerciseId ||
      state.revision !== c.expectedRevision
    )
      throw new Error("Recovery exercise changed; refresh before retrying");
    const expected =
      c.action === "record_disposable_restore"
        ? "planned"
        : c.action === "verify_restore"
          ? "restored"
          : "verified";
    if (state.status !== expected)
      throw new Error(`${c.action} is not allowed from ${state.status}`);
    fromStatus = state.status;
    if (c.action === "verify_restore") {
      if (new Set(c.checks.map((x) => x.code)).size !== 5)
        throw new Error(
          "Every required recovery check must appear exactly once",
        );
      toStatus = c.checks.every(
        (x) => x.outcome === "pass" && x.expectedValue === x.actualValue,
      )
        ? "verified"
        : "failed";
    } else
      toStatus =
        c.action === "record_disposable_restore" ? "restored" : "approved";
  }
  return {
    command: c,
    fromStatus,
    toStatus,
    event: createEvent({
      eventType: `recovery.${c.action}`,
      tenantId: c.tenantId,
      aggregateType: "recovery_exercise",
      aggregateId: c.exerciseId,
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
        providerBackupConnected: false,
        productionMutation: false,
      },
    }),
  };
}
