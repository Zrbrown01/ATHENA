import { z } from "zod";
import { createEvent } from "@/platform/events";
import { AuthorizationError, requireRole, type TenantContext } from "@/platform/tenant-context";
const id = z.string().min(3).max(160),
  reason = z.string().trim().min(12).max(1500),
  base = {
    tenantId: z.string().min(1),
    batchId: id,
    idempotencyKey: z.string().min(8).max(200),
  },
  revision = z.number().int().positive();
export const migrationCommand = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("register_fixture_package"),
    ...base,
    sourceSystemId: id,
    packageId: id,
    mappingVersionId: id,
    fileName: z.string().min(5).max(240),
    packageSha256: z.string().regex(/^[a-f0-9]{64}$/),
    byteSize: z.number().int().positive(),
    recordCount: z.literal(5),
    sandboxAcknowledged: z.literal(true),
  }),
  z.object({
    action: z.literal("validate_package"),
    ...base,
    expectedRevision: revision,
    reason,
  }),
  z.object({
    action: z.literal("stage_import"),
    ...base,
    expectedRevision: revision,
    recordIds: z.array(id).length(5),
    exceptionId: id,
    reason,
  }),
  z.object({
    action: z.literal("resolve_exception"),
    ...base,
    expectedRevision: revision,
    exceptionId: id,
    migrationRecordId: id,
    correctionEvidence: reason,
  }),
  z.object({
    action: z.literal("reconcile_batch"),
    ...base,
    expectedRevision: revision,
    reconciliationId: id,
  }),
  z.object({
    action: z.literal("accept_batch"),
    ...base,
    expectedRevision: revision,
    acceptanceId: id,
    scope: reason,
    evidence: reason,
  }),
  z.object({
    action: z.literal("freeze_source"),
    ...base,
    expectedRevision: revision,
    cutoverRecordId: id,
    rollbackPlan: reason,
  }),
  z.object({
    action: z.literal("authorize_cutover"),
    ...base,
    expectedRevision: revision,
    cutoverRecordId: id,
    rollbackPlan: reason,
  }),
  z.object({
    action: z.literal("archive_legacy"),
    ...base,
    expectedRevision: revision,
    cutoverRecordId: id,
    rollbackPlan: reason,
  }),
]);
export type MigrationCommand = z.infer<typeof migrationCommand>;
export type MigrationBatchState = {
  id: string;
  status:
    | "package_registered"
    | "validated"
    | "staged_with_exceptions"
    | "staged"
    | "reconciled"
    | "accepted"
    | "frozen"
    | "cutover"
    | "archived";
  revision: number;
  sourceRecordCount: number;
  stagedRecordCount: number;
  acceptedRecordCount: number;
  exceptionCount: number;
  sourceAggregateSha256: string;
  targetAggregateSha256?: string | null;
};
const expected = {
    validate_package: "package_registered",
    stage_import: "validated",
    resolve_exception: "staged_with_exceptions",
    reconcile_batch: "staged",
    accept_batch: "reconciled",
    freeze_source: "accepted",
    authorize_cutover: "frozen",
    archive_legacy: "cutover",
  } as const,
  to = {
    validate_package: "validated",
    stage_import: "staged_with_exceptions",
    resolve_exception: "staged",
    reconcile_batch: "reconciled",
    accept_batch: "accepted",
    freeze_source: "frozen",
    authorize_cutover: "cutover",
    archive_legacy: "archived",
  } as const;
export function decideMigration(input: {
  context: TenantContext;
  raw: unknown;
  batch?: MigrationBatchState | null;
  targetExists?: boolean;
}) {
  const c = migrationCommand.parse(input.raw);
  if (input.context.tenantId !== c.tenantId)
    throw new AuthorizationError();
  requireRole(input.context, ["partner", "attorney", "migration_admin"]);
  let fromStatus = "not_created",
    toStatus = "package_registered";
  if (c.action === "register_fixture_package") {
    if (input.targetExists)
      throw new Error("Migration batch identity already exists");
  } else {
    const b = input.batch;
    if (!b || b.revision !== c.expectedRevision)
      throw new Error("Migration batch changed; refresh before retrying");
    if (b.status !== expected[c.action])
      throw new Error(`${c.action} is not allowed from ${b.status}`);
    fromStatus = b.status;
    toStatus = to[c.action];
    if (
      c.action === "reconcile_batch" &&
      (b.exceptionCount !== 0 ||
        b.sourceRecordCount !== b.stagedRecordCount ||
        !b.targetAggregateSha256 ||
        b.sourceAggregateSha256 !== b.targetAggregateSha256)
    )
      throw new Error(
        "Counts, exceptions, and aggregate checksums must reconcile",
      );
  }
  return {
    command: c,
    fromStatus,
    toStatus,
    event: createEvent({
      eventType: `migration.${c.action}`,
      tenantId: c.tenantId,
      aggregateType: "migration_batch",
      aggregateId: c.batchId,
      actorId: input.context.userId,
      correlationId: c.idempotencyKey,
      idempotencyKey: c.idempotencyKey,
      source: "athena.web",
      visibility: "restricted",
      retentionPolicy: "migration-permanent",
      payload: {
        action: c.action,
        fromStatus,
        toStatus,
        humanAuthorized: true,
        externalProviderConnected: false,
        resumable: true,
        sourceIdsPreserved: true,
        filesReleased: false,
      },
    }),
  };
}
