import { decideReportRecurrence, reportRecurrenceCommand } from "@/domain/reports/recurrence";
import { authorizePersistedMatter } from "@/platform/access-policy-persistence";
import { OptimisticConcurrencyError } from "@/platform/optimistic-concurrency";
import { GOLDEN_MATTER_ID, PILOT_TENANT_ID, pilotContext } from "@/platform/pilot-context";
import { enforceRateLimit, RateLimitError, rateLimitResponse } from "@/platform/rate-limit-persistence";
import { listReportRecurrenceExceptions, persistReportRecurrence, readReportRecurrenceDefinitionStatus, readReportRecurrenceEvent, readReportRecurrenceSeries, reportRecurrenceProjection } from "@/platform/report-recurrence-persistence";
import { requestActor } from "@/platform/request-actor";
import { assertTrustedWriteOrigin, RequestSecurityError } from "@/platform/request-security";
import { AuthorizationError } from "@/platform/tenant-context";

const limitation = "Athena creates at most six source-linked report drafts per authorized command. AI drafting, background scheduling, and Microsoft delivery are disconnected; each draft still requires governed validation and attorney approval.";
async function projection() { return { ...await reportRecurrenceProjection(PILOT_TENANT_ID, GOLDEN_MATTER_ID), limitation }; }
export async function GET(request: Request) { try { const actor = requestActor(request); if (!actor) return Response.json({ error: "Authentication required" }, { status: 401 }); const context = pilotContext(actor); await authorizePersistedMatter(context, PILOT_TENANT_ID, GOLDEN_MATTER_ID); return Response.json(await projection()); } catch (error) { if (error instanceof AuthorizationError) return Response.json({ error: "Access denied" }, { status: 403 }); return Response.json({ error: "Recurring reports could not be read" }, { status: 500 }); } }
export async function POST(request: Request) { try {
  assertTrustedWriteOrigin(request); const actor = requestActor(request); if (!actor) return Response.json({ error: "Authentication required" }, { status: 401 });
  await enforceRateLimit({ tenantId: PILOT_TENANT_ID, actorId: actor.userId, action: "report-recurrence.command", policy: { limit: 20, windowMs: 60_000 } });
  const context = pilotContext(actor), command = reportRecurrenceCommand.parse(await request.json()); await authorizePersistedMatter(context, command.tenantId, command.matterId);
  const prior = await readReportRecurrenceEvent(command.tenantId, command.idempotencyKey); if (prior) return Response.json({ event: null, persistence: { replayed: true, eventId: prior.eventId }, ...await projection() });
  const current = command.action === "create_series" ? null : await readReportRecurrenceSeries(command.tenantId, command.matterId, command.seriesId);
  const exceptions = command.action === "materialize_window" ? await listReportRecurrenceExceptions(command.tenantId, command.matterId, command.seriesId) : [];
  const definitionContentStatus = command.action === "activate_series" && current ? await readReportRecurrenceDefinitionStatus(command.tenantId, current.definitionId) : null;
  const decision = decideReportRecurrence({ context, raw: command, current, exceptions, definitionContentStatus });
  const persistence = await persistReportRecurrence({ ...decision, actor });
  return Response.json({ event: decision.event, persistence, ...await projection() });
} catch (error) { if (error instanceof RateLimitError) return rateLimitResponse(error); if (error instanceof RequestSecurityError) return Response.json({ error: "Untrusted request origin" }, { status: 403 }); if (error instanceof AuthorizationError) return Response.json({ error: "Access denied" }, { status: 403 }); if (error instanceof OptimisticConcurrencyError || (error instanceof Error && error.message.startsWith("Recurring report series changed;"))) return Response.json({ error: "Record changed; refresh before retrying" }, { status: 409 }); return Response.json({ error: error instanceof Error ? error.message : "Recurring report command failed" }, { status: 400 }); } }
