import { createId } from "@paralleldrive/cuid2";
import { and, asc, eq } from "drizzle-orm";
import { getPreviewDb } from "../../db";
import {
  directoryConnections,
  directoryIdentities,
  identityDecisions,
  offboardingRuns,
  previewEvents,
  previewOutbox,
  roleAssignments,
  roleDefinitions,
} from "../../db/schema";
import type { DirectoryCommand } from "@/domain/identity/directory";
import type { EventEnvelope } from "./events";
import type { RequestActor } from "./request-actor";
const roles = [
  {
    code: "partner",
    title: "Partner",
    permissions: [
      "matter.all",
      "admin.identity",
      "admin.security",
      "legal.approve",
    ],
    privileged: true,
  },
  {
    code: "attorney",
    title: "Attorney",
    permissions: ["matter.assigned", "legal.review", "legal.approve"],
    privileged: true,
  },
  {
    code: "paralegal",
    title: "Paralegal",
    permissions: ["matter.assigned", "work.prepare"],
    privileged: false,
  },
  {
    code: "legal_assistant",
    title: "Legal assistant",
    permissions: ["matter.assigned", "work.coordinate"],
    privileged: false,
  },
  {
    code: "billing_specialist",
    title: "Billing specialist",
    permissions: ["billing.manage"],
    privileged: false,
  },
  {
    code: "docketing_specialist",
    title: "Docketing specialist",
    permissions: ["calendar.manage", "filing.prepare"],
    privileged: false,
  },
  {
    code: "security_admin",
    title: "Security administrator",
    permissions: ["admin.identity", "admin.security", "audit.review"],
    privileged: true,
  },
] as const;
export async function readDirectoryIdentity(t: string, id: string) {
  const [x] = await getPreviewDb()
    .select()
    .from(directoryIdentities)
    .where(
      and(eq(directoryIdentities.tenantId, t), eq(directoryIdentities.id, id)),
    )
    .limit(1);
  return x ?? null;
}
export async function readOffboardingRun(t: string, id: string) {
  const [x] = await getPreviewDb()
    .select()
    .from(offboardingRuns)
    .where(and(eq(offboardingRuns.tenantId, t), eq(offboardingRuns.id, id)))
    .limit(1);
  return x ?? null;
}
export async function countActiveAssignments(t: string, id: string) {
  const rows = await getPreviewDb()
    .select({ id: roleAssignments.id })
    .from(roleAssignments)
    .where(
      and(
        eq(roleAssignments.tenantId, t),
        eq(roleAssignments.identityId, id),
        eq(roleAssignments.status, "active"),
      ),
    );
  return rows.length;
}
export async function readIdentityEvent(t: string, key: string) {
  const [x] = await getPreviewDb()
    .select({ eventId: previewEvents.eventId })
    .from(previewEvents)
    .where(
      and(eq(previewEvents.tenantId, t), eq(previewEvents.idempotencyKey, key)),
    )
    .limit(1);
  return x ?? null;
}
export async function directoryProjection(t: string) {
  const db = getPreviewDb(),
    [
      connections,
      identities,
      roleCatalog,
      assignments,
      offboarding,
      decisions,
    ] = await Promise.all([
      db
        .select()
        .from(directoryConnections)
        .where(eq(directoryConnections.tenantId, t)),
      db
        .select()
        .from(directoryIdentities)
        .where(eq(directoryIdentities.tenantId, t))
        .orderBy(asc(directoryIdentities.createdAt)),
      db.select().from(roleDefinitions).where(eq(roleDefinitions.tenantId, t)),
      db.select().from(roleAssignments).where(eq(roleAssignments.tenantId, t)),
      db.select().from(offboardingRuns).where(eq(offboardingRuns.tenantId, t)),
      db
        .select()
        .from(identityDecisions)
        .where(eq(identityDecisions.tenantId, t))
        .orderBy(asc(identityDecisions.createdAt)),
    ]);
  return {
    connections,
    identities,
    roleCatalog,
    assignments,
    offboarding,
    decisions,
  };
}
export async function persistDirectory(input: {
  command: DirectoryCommand;
  fromStatus: string;
  toStatus: string;
  event: EventEnvelope<Record<string, unknown>>;
  actor: RequestActor;
  activeAssignmentCount: number;
}) {
  const db = getPreviewDb(),
    c = input.command,
    now = new Date(input.event.occurredAt),
    eventWrite = db.insert(previewEvents).values({
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
    }),
    outboxWrite = db.insert(previewOutbox).values({
      id: createId(),
      tenantId: c.tenantId,
      eventId: input.event.eventId,
      topic: "athena.identity",
      payload: input.event,
      attempts: 0,
      availableAt: now,
    }),
    decisionWrite = db.insert(identityDecisions).values({
      id: createId(),
      tenantId: c.tenantId,
      identityId: c.identityId,
      action: c.action,
      fromStatus: input.fromStatus,
      toStatus: input.toStatus,
      reason: reason(c),
      actorId: input.actor.userId,
      eventId: input.event.eventId,
      idempotencyKey: c.idempotencyKey,
      createdAt: now,
    }),
    writes: unknown[] = [];
  if (c.action === "register_fixture_identity") {
    writes.push(
      db
        .insert(directoryConnections)
        .values({
          id: c.connectionId,
          tenantId: c.tenantId,
          provider: "microsoft_entra",
          providerMode: "not_connected",
          status: "not_connected",
          createdBy: input.actor.userId,
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoNothing(),
      ...roles.map((r) =>
        db
          .insert(roleDefinitions)
          .values({
            id: `role-${r.code}`,
            tenantId: c.tenantId,
            ...r,
            permissions: [...r.permissions],
            immutable: true,
            createdBy: input.actor.userId,
            createdAt: now,
          })
          .onConflictDoNothing(),
      ),
      db.insert(directoryIdentities).values({
        id: c.identityId,
        tenantId: c.tenantId,
        connectionId: c.connectionId,
        externalObjectId: null,
        email: c.email,
        normalizedEmail: c.email.trim().toLowerCase(),
        displayName: c.displayName,
        status: "invited",
        identitySource: "local_fixture",
        mfaState: "unknown",
        sessionRevocationState: "not_requested",
        revision: 1,
        createdBy: input.actor.userId,
        createdAt: now,
        updatedAt: now,
      }),
    );
  } else if (c.action === "activate_local_identity")
    writes.push(
      updateIdentity(db, c.tenantId, c.identityId, c.expectedRevision, {
        status: "active",
        revision: c.expectedRevision + 1,
        updatedAt: now,
      }),
    );
  else if (c.action === "assign_role") {
    const [role] = await db
      .select({ id: roleDefinitions.id })
      .from(roleDefinitions)
      .where(
        and(
          eq(roleDefinitions.tenantId, c.tenantId),
          eq(roleDefinitions.code, c.roleCode),
        ),
      )
      .limit(1);
    if (!role) throw new Error("Role definition does not exist");
    writes.push(
      db.insert(roleAssignments).values({
        id: c.assignmentId,
        tenantId: c.tenantId,
        identityId: c.identityId,
        roleDefinitionId: role.id,
        scopeType: c.scopeType,
        matterId: c.matterId,
        status: "active",
        grantReason: c.grantReason,
        grantedBy: input.actor.userId,
        grantedAt: now,
      }),
      updateIdentity(db, c.tenantId, c.identityId, c.expectedRevision, {
        revision: c.expectedRevision + 1,
        updatedAt: now,
      }),
    );
  } else if (c.action === "start_offboarding")
    writes.push(
      updateIdentity(db, c.tenantId, c.identityId, c.expectedRevision, {
        status: "suspended",
        revision: c.expectedRevision + 1,
        updatedAt: now,
      }),
      db.insert(offboardingRuns).values({
        id: c.offboardingRunId,
        tenantId: c.tenantId,
        identityId: c.identityId,
        status: "initiated",
        reason: c.reason,
        activeAssignmentCount: input.activeAssignmentCount,
        revokedAssignmentCount: 0,
        sessionRevocationMode: "not_connected",
        revision: 1,
        initiatedBy: input.actor.userId,
        initiatedAt: now,
        updatedAt: now,
      }),
    );
  else if (c.action === "revoke_assignments")
    writes.push(
      db
        .update(roleAssignments)
        .set({
          status: "revoked",
          revokedBy: input.actor.userId,
          revokedAt: now,
          revocationEvidence: c.revocationEvidence,
        })
        .where(
          and(
            eq(roleAssignments.tenantId, c.tenantId),
            eq(roleAssignments.identityId, c.identityId),
            eq(roleAssignments.status, "active"),
          ),
        ),
      updateIdentity(db, c.tenantId, c.identityId, c.expectedRevision, {
        revision: c.expectedRevision + 1,
        updatedAt: now,
      }),
      db
        .update(offboardingRuns)
        .set({
          status: "assignments_revoked",
          revokedAssignmentCount: input.activeAssignmentCount,
          revision: c.expectedRunRevision + 1,
          updatedAt: now,
        })
        .where(
          and(
            eq(offboardingRuns.tenantId, c.tenantId),
            eq(offboardingRuns.id, c.offboardingRunId),
            eq(offboardingRuns.revision, c.expectedRunRevision),
          ),
        ),
    );
  else {
    const completed = c.mode !== "not_connected";
    writes.push(
      updateIdentity(db, c.tenantId, c.identityId, c.expectedRevision, {
        status: completed ? "offboarded" : "suspended",
        sessionRevocationState:
          c.mode === "not_connected"
            ? "blocked_not_connected"
            : c.mode === "live"
              ? "provider_confirmed"
              : "human_verified",
        revision: c.expectedRevision + 1,
        updatedAt: now,
      }),
      db
        .update(offboardingRuns)
        .set({
          status: completed ? "completed" : "session_revocation_blocked",
          sessionRevocationMode: c.mode,
          sessionRevocationEvidence: c.evidence,
          revision: c.expectedRunRevision + 1,
          completedAt: completed ? now : null,
          updatedAt: now,
        })
        .where(
          and(
            eq(offboardingRuns.tenantId, c.tenantId),
            eq(offboardingRuns.id, c.offboardingRunId),
            eq(offboardingRuns.revision, c.expectedRunRevision),
          ),
        ),
    );
  }
  await db.batch([
    ...(writes as never[]),
    decisionWrite,
    eventWrite,
    outboxWrite,
  ] as never);
  return { replayed: false, eventId: input.event.eventId };
}
function updateIdentity(
  db: ReturnType<typeof getPreviewDb>,
  t: string,
  id: string,
  revision: number,
  patch: Record<string, unknown>,
) {
  return db
    .update(directoryIdentities)
    .set(patch)
    .where(
      and(
        eq(directoryIdentities.tenantId, t),
        eq(directoryIdentities.id, id),
        eq(directoryIdentities.revision, revision),
      ),
    );
}
function reason(c: DirectoryCommand) {
  if (c.action === "register_fixture_identity")
    return "Registered an acknowledged local directory fixture.";
  if (c.action === "activate_local_identity") return c.reason;
  if (c.action === "assign_role") return c.grantReason;
  if (c.action === "start_offboarding") return c.reason;
  if (c.action === "revoke_assignments") return c.revocationEvidence;
  return c.evidence;
}
