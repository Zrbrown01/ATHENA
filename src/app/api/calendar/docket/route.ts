import { decideDocket, docketCommand, type ConflictState, type ReminderState, type SyncState } from "@/domain/calendar/docket";
import { authorizePersistedMatter } from "@/platform/access-policy-persistence";
import { calendarProjection, persistDocket, readCalendarConflict, readCalendarEventEnvelope, readCalendarReminder, readCalendarSeries, readCalendarSyncState } from "@/platform/calendar-persistence";
import { GOLDEN_MATTER_ID, PILOT_TENANT_ID, pilotContext } from "@/platform/pilot-context";
import { enforceRateLimit, RateLimitError, rateLimitResponse } from "@/platform/rate-limit-persistence";
import { requestActor } from "@/platform/request-actor";
import { assertTrustedWriteOrigin, RequestSecurityError } from "@/platform/request-security";
import { AuthorizationError } from "@/platform/tenant-context";

const limitation = "Recurrence is expanded locally from an acknowledged synthetic firm workflow. The preparation chain is not statutory authority. Microsoft calendar OAuth, sync, subscriptions, delta recovery, revocation, and writes remain disconnected.";

export async function GET(request: Request) {
  try {
    const actor = requestActor(request);
    if (!actor) return Response.json({ error: "Authentication required" }, { status: 401 });
    await authorizePersistedMatter(pilotContext(actor), PILOT_TENANT_ID, GOLDEN_MATTER_ID);
    return Response.json({ ...await calendarProjection(PILOT_TENANT_ID, GOLDEN_MATTER_ID), limitation });
  } catch (error) {
    if (error instanceof AuthorizationError) return Response.json({ error: "Access denied" }, { status: 403 });
    return Response.json({ error: "Calendar docket could not be read" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    assertTrustedWriteOrigin(request);
    const actor = requestActor(request);
    if (!actor) return Response.json({ error: "Authentication required" }, { status: 401 });
    await enforceRateLimit({ tenantId: PILOT_TENANT_ID, actorId: actor.userId, action: "calendar_docket.command", policy: { limit: 20, windowMs: 60_000 } });
    const context = pilotContext(actor);
    const command = docketCommand.parse(await request.json());
    await authorizePersistedMatter(context, command.tenantId, command.matterId);
    const prior = await readCalendarEventEnvelope(command.tenantId, command.idempotencyKey);
    if (prior) return Response.json({ event: null, persistence: { replayed: true, eventId: prior.eventId }, ...await calendarProjection(command.tenantId, command.matterId), limitation });
    const series = command.action === "materialize_fixture_docket" ? await readCalendarSeries(command.tenantId, command.matterId, command.seriesId) : null;
    const reminder = command.action === "acknowledge_reminder" ? await readCalendarReminder(command.tenantId, command.matterId, command.reminderId) : null;
    const conflict = command.action === "resolve_conflict" ? await readCalendarConflict(command.tenantId, command.matterId, command.conflictId) : null;
    const syncState = command.action === "record_sync_block" ? await readCalendarSyncState(command.tenantId, command.syncStateId) : null;
    const decision = decideDocket({ context, raw: command, targetExists: Boolean(series), reminder: reminder as ReminderState | null, conflict: conflict as ConflictState | null, syncState: syncState as SyncState | null });
    const persistence = await persistDocket({ ...decision, actor });
    return Response.json({ event: decision.event, persistence, ...await calendarProjection(command.tenantId, command.matterId), limitation });
  } catch (error) {
    if (error instanceof RateLimitError) return rateLimitResponse(error);
    if (error instanceof RequestSecurityError) return Response.json({ error: "Untrusted request origin" }, { status: 403 });
    if (error instanceof AuthorizationError) return Response.json({ error: "Access denied" }, { status: 403 });
    return Response.json({ error: error instanceof Error ? error.message : "Calendar docket command failed" }, { status: 400 });
  }
}
