import { createId } from "@paralleldrive/cuid2";
import { and, asc, desc, eq } from "drizzle-orm";
import { getPreviewDb } from "../../db";
import {
  directoryConnections,
  directoryIdentities,
  directoryReconciliationFindings,
  directoryReconciliationReviews,
  directoryReconciliationRuns,
  optimisticWriteClaims,
  previewEvents,
  previewOutbox,
  roleAssignments,
  roleDefinitions,
} from "../../db/schema";
import {
  evaluateDirectoryReconciliation,
  type DirectoryReconciliationCommand,
} from "@/domain/identity/directory-reconciliation";
import { DeterministicEntraDirectoryAdapter } from "@/integrations/directory";
import type { EventEnvelope } from "./events";
import { rethrowOptimisticClaimConflict } from "./optimistic-concurrency";
import type { RequestActor } from "./request-actor";

export async function readDirectoryReconciliation(
  tenantId: string,
  id: string,
) {
  const [row] = await getPreviewDb()
    .select()
    .from(directoryReconciliationRuns)
    .where(
      and(
        eq(directoryReconciliationRuns.tenantId, tenantId),
        eq(directoryReconciliationRuns.id, id),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function directoryReconciliationProjection(tenantId: string) {
  const db = getPreviewDb();
  const [runs, findings, reviews] = await Promise.all([
    db
      .select()
      .from(directoryReconciliationRuns)
      .where(eq(directoryReconciliationRuns.tenantId, tenantId))
      .orderBy(desc(directoryReconciliationRuns.createdAt)),
    db
      .select()
      .from(directoryReconciliationFindings)
      .where(eq(directoryReconciliationFindings.tenantId, tenantId))
      .orderBy(asc(directoryReconciliationFindings.createdAt)),
    db
      .select()
      .from(directoryReconciliationReviews)
      .where(eq(directoryReconciliationReviews.tenantId, tenantId))
      .orderBy(desc(directoryReconciliationReviews.reviewedAt)),
  ]);
  return {
    reconciliations: runs,
    reconciliationFindings: findings,
    reconciliationReviews: reviews,
  };
}

export async function persistDirectoryReconciliation(input: {
  command: DirectoryReconciliationCommand;
  fromStatus: string;
  toStatus: string;
  event: EventEnvelope<Record<string, unknown>>;
  actor: RequestActor;
}) {
  const db = getPreviewDb();
  const c = input.command;
  const now = new Date(input.event.occurredAt);
  const eventWrite = db.insert(previewEvents).values({
    eventId: input.event.eventId,
    eventType: input.event.eventType,
    eventVersion: input.event.eventVersion,
    tenantId: c.tenantId,
    aggregateType: input.event.aggregateType,
    aggregateId: input.event.aggregateId,
    actorId: input.actor.userId,
    occurredAt: now,
    correlationId: input.event.correlationId,
    idempotencyKey: input.event.idempotencyKey,
    source: input.event.source,
    visibility: input.event.visibility,
    retentionPolicy: input.event.retentionPolicy,
    payload: input.event.payload,
  });
  const outboxWrite = db.insert(previewOutbox).values({
    id: createId(),
    tenantId: c.tenantId,
    eventId: input.event.eventId,
    topic: "athena.identity_reconciliation",
    payload: input.event,
    attempts: 0,
    availableAt: now,
  });

  if (c.action === "run_sandbox_reconciliation") {
    const [connection] = await db
      .select({ id: directoryConnections.id })
      .from(directoryConnections)
      .where(
        and(
          eq(directoryConnections.tenantId, c.tenantId),
          eq(directoryConnections.id, c.connectionId),
        ),
      )
      .limit(1);
    if (!connection) throw new Error("Directory connection does not exist");

    const [identities, activeRoleRows] = await Promise.all([
      db
        .select()
        .from(directoryIdentities)
        .where(eq(directoryIdentities.tenantId, c.tenantId)),
      db
        .select({
          identityId: roleAssignments.identityId,
          roleCode: roleDefinitions.code,
        })
        .from(roleAssignments)
        .innerJoin(
          roleDefinitions,
          and(
            eq(roleAssignments.tenantId, roleDefinitions.tenantId),
            eq(roleAssignments.roleDefinitionId, roleDefinitions.id),
          ),
        )
        .where(
          and(
            eq(roleAssignments.tenantId, c.tenantId),
            eq(roleAssignments.status, "active"),
          ),
        ),
    ]);
    const roleCodes = new Map<string, string[]>();
    for (const row of activeRoleRows)
      roleCodes.set(row.identityId, [
        ...(roleCodes.get(row.identityId) ?? []),
        row.roleCode,
      ]);
    const snapshot = await new DeterministicEntraDirectoryAdapter().snapshot(
      c.tenantId,
      c.snapshotAsOf,
    );
    const result = evaluateDirectoryReconciliation({
      local: identities.map((identity) => ({
        id: identity.id,
        normalizedEmail: identity.normalizedEmail,
        status: identity.status,
        mfaState: identity.mfaState,
        roleCodes: roleCodes.get(identity.id) ?? [],
      })),
      provider: snapshot.identities,
    });
    const snapshotSha256 = await digest(JSON.stringify(snapshot));
    const limitation =
      "This run compares Athena-native identities with a pinned deterministic Entra-shaped fixture. It does not prove live tenant users, groups, MFA, sessions, or provider state.";
    await db.batch([
      db.insert(directoryReconciliationRuns).values({
        id: c.reconciliationId,
        tenantId: c.tenantId,
        connectionId: c.connectionId,
        provider: "microsoft_entra",
        providerMode: "deterministic_sandbox",
        status: result.findingCount === 0 ? "clean" : "findings_open",
        snapshotAsOf: new Date(c.snapshotAsOf),
        snapshotSha256,
        localIdentityCount: result.localIdentityCount,
        providerIdentityCount: result.providerIdentityCount,
        matchedIdentityCount: result.matchedIdentityCount,
        findingCount: result.findingCount,
        blockingFindingCount: result.blockingFindingCount,
        limitation,
        revision: 1,
        initiatedBy: input.actor.userId,
        eventId: input.event.eventId,
        createdAt: now,
        updatedAt: now,
      }),
      ...result.findings.map((finding) =>
        db.insert(directoryReconciliationFindings).values({
          id: createId(),
          tenantId: c.tenantId,
          reconciliationId: c.reconciliationId,
          identityId: finding.identityId,
          externalObjectId: finding.externalObjectId,
          normalizedEmail: finding.normalizedEmail,
          code: finding.code,
          severity: finding.severity,
          blocking: finding.blocking,
          localValue: finding.localValue,
          providerValue: finding.providerValue,
          explanation: finding.explanation,
          status: "open",
          createdAt: now,
        }),
      ),
      eventWrite,
      outboxWrite,
    ] as never);
  } else {
    const current = await readDirectoryReconciliation(
      c.tenantId,
      c.reconciliationId,
    );
    if (!current) throw new Error("Directory reconciliation does not exist");
    const acceptExceptions = c.outcome === "exceptions_noted";
    try {
      await db.batch([
        db.insert(optimisticWriteClaims).values({
          id: createId(),
          tenantId: c.tenantId,
          aggregateType: "directory_reconciliation",
          aggregateId: c.reconciliationId,
          expectedRevision: c.expectedRevision,
          claimedRevision: c.expectedRevision + 1,
          actorId: input.actor.userId,
          eventId: input.event.eventId,
          idempotencyKey: c.idempotencyKey,
          createdAt: now,
        }),
        db
          .update(directoryReconciliationRuns)
          .set({
            status: "reviewed",
            revision: c.expectedRevision + 1,
            reviewedAt: now,
            updatedAt: now,
          })
          .where(
            and(
              eq(directoryReconciliationRuns.tenantId, c.tenantId),
              eq(directoryReconciliationRuns.id, c.reconciliationId),
              eq(directoryReconciliationRuns.revision, c.expectedRevision),
            ),
          ),
        ...(acceptExceptions
          ? [
              db
                .update(directoryReconciliationFindings)
                .set({ status: "accepted_exception" })
                .where(
                  and(
                    eq(directoryReconciliationFindings.tenantId, c.tenantId),
                    eq(
                      directoryReconciliationFindings.reconciliationId,
                      c.reconciliationId,
                    ),
                    eq(directoryReconciliationFindings.status, "open"),
                  ),
                ),
            ]
          : []),
        db.insert(directoryReconciliationReviews).values({
          id: createId(),
          tenantId: c.tenantId,
          reconciliationId: c.reconciliationId,
          outcome: c.outcome,
          notes: c.notes,
          openFindingCount: acceptExceptions ? 0 : current.findingCount,
          acceptedExceptionCount: acceptExceptions ? current.findingCount : 0,
          reviewedBy: input.actor.userId,
          eventId: input.event.eventId,
          idempotencyKey: c.idempotencyKey,
          reviewedAt: now,
        }),
        eventWrite,
        outboxWrite,
      ] as never);
    } catch (error) {
      rethrowOptimisticClaimConflict(error);
    }
  }
  return { replayed: false, eventId: input.event.eventId };
}

async function digest(value: string) {
  const bytes = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(bytes), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}
