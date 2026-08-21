import { describe, expect, it } from "vitest";
import { decideMigration, type MigrationBatchState } from "./lifecycle";
const context = {
    tenantId: "t",
    userId: "u",
    roles: ["migration_admin"],
    matterAccess: new Set<string>(),
  },
  hash = "a".repeat(64),
  batch: MigrationBatchState = {
    id: "batch-1",
    status: "staged",
    revision: 4,
    sourceRecordCount: 5,
    stagedRecordCount: 5,
    acceptedRecordCount: 0,
    exceptionCount: 0,
    sourceAggregateSha256: hash,
    targetAggregateSha256: hash,
  };
describe("migration lifecycle", () => {
  it("reconciles only matching counts, checksums, and zero exceptions", () =>
    expect(
      decideMigration({
        context,
        batch,
        raw: {
          action: "reconcile_batch",
          tenantId: "t",
          batchId: "batch-1",
          expectedRevision: 4,
          reconciliationId: "recon-1",
          idempotencyKey: "migration-reconcile",
        },
      }).toStatus,
    ).toBe("reconciled"));
  it("blocks unresolved exceptions", () =>
    expect(() =>
      decideMigration({
        context,
        batch: { ...batch, exceptionCount: 1 },
        raw: {
          action: "reconcile_batch",
          tenantId: "t",
          batchId: "batch-1",
          expectedRevision: 4,
          reconciliationId: "recon-1",
          idempotencyKey: "migration-reconcile",
        },
      }),
    ).toThrow("reconcile"));
  it("blocks count and checksum mismatch", () => {
    expect(() =>
      decideMigration({
        context,
        batch: { ...batch, stagedRecordCount: 4 },
        raw: {
          action: "reconcile_batch",
          tenantId: "t",
          batchId: "batch-1",
          expectedRevision: 4,
          reconciliationId: "recon-1",
          idempotencyKey: "migration-count",
        },
      }),
    ).toThrow("reconcile");
    expect(() =>
      decideMigration({
        context,
        batch: { ...batch, targetAggregateSha256: "b".repeat(64) },
        raw: {
          action: "reconcile_batch",
          tenantId: "t",
          batchId: "batch-1",
          expectedRevision: 4,
          reconciliationId: "recon-1",
          idempotencyKey: "migration-hash",
        },
      }),
    ).toThrow("reconcile");
  });
  it("enforces strict cutover ordering", () =>
    expect(() =>
      decideMigration({
        context,
        batch: { ...batch, status: "accepted" },
        raw: {
          action: "authorize_cutover",
          tenantId: "t",
          batchId: "batch-1",
          expectedRevision: 4,
          cutoverRecordId: "cutover-1",
          rollbackPlan:
            "Restore the prior read-only routing and preserve all evidence.",
          idempotencyKey: "migration-cutover",
        },
      }),
    ).toThrow("accepted"));
  it("enforces revision and tenant isolation", () => {
    expect(() =>
      decideMigration({
        context,
        batch,
        raw: {
          action: "reconcile_batch",
          tenantId: "t",
          batchId: "batch-1",
          expectedRevision: 3,
          reconciliationId: "recon-1",
          idempotencyKey: "migration-stale",
        },
      }),
    ).toThrow("changed");
    expect(() =>
      decideMigration({
        context,
        raw: {
          action: "validate_package",
          tenantId: "other",
          batchId: "batch-1",
          expectedRevision: 1,
          reason: "Validate immutable package and mapping evidence.",
          idempotencyKey: "migration-tenant",
        },
      }),
    ).toThrow("Access denied");
  });
});
