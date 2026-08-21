import { decideReport, reportCommand, type ReportDefinitionState, type ReportState } from "@/domain/reports/lifecycle";
import { authorizePersistedMatter } from "@/platform/access-policy-persistence";
import { buildReportValidation, persistReport, readReportInstance, readReportingEvent, reportingProjection } from "@/platform/reporting-persistence";
import { GOLDEN_MATTER_ID, PILOT_TENANT_ID, pilotContext } from "@/platform/pilot-context";
import { enforceRateLimit, RateLimitError, rateLimitResponse } from "@/platform/rate-limit-persistence";
import { requestActor } from "@/platform/request-actor";
import { assertTrustedWriteOrigin, RequestSecurityError } from "@/platform/request-security";
import { AuthorizationError } from "@/platform/tenant-context";
const limitation = "This source-linked report uses an acknowledged synthetic client definition and local schedule intent. AI drafting and Microsoft delivery are disconnected; delivery can only be recorded as blocked, never sent.";
export async function GET(request: Request) { try { const actor = requestActor(request); if (!actor) return Response.json({ error: "Authentication required" }, { status: 401 }); await authorizePersistedMatter(pilotContext(actor), PILOT_TENANT_ID, GOLDEN_MATTER_ID); return Response.json({ ...await reportingProjection(PILOT_TENANT_ID, GOLDEN_MATTER_ID), limitation }); } catch (error) { if (error instanceof AuthorizationError) return Response.json({ error: "Access denied" }, { status: 403 }); return Response.json({ error: "Reporting records could not be read" }, { status: 500 }); } }
export async function POST(request: Request) { try {
  assertTrustedWriteOrigin(request); const actor = requestActor(request); if (!actor) return Response.json({ error: "Authentication required" }, { status: 401 });
  await enforceRateLimit({ tenantId: PILOT_TENANT_ID, actorId: actor.userId, action: "reporting.command", policy: { limit: 20, windowMs: 60_000 } });
  const context = pilotContext(actor), command = reportCommand.parse(await request.json()); await authorizePersistedMatter(context, command.tenantId, command.matterId);
  const prior = await readReportingEvent(command.tenantId, command.idempotencyKey); if (prior) return Response.json({ event: null, persistence: { replayed: true, eventId: prior.eventId }, ...await reportingProjection(command.tenantId, command.matterId), limitation });
  const report = await readReportInstance(command.tenantId, command.matterId, command.reportInstanceId);
  const governed = command.action === "validate_report" ? await buildReportValidation(command.tenantId, command.matterId, command.reportInstanceId) : undefined;
  const decision = decideReport({ context, raw: command, report: report as ReportState | null, definition: governed?.definition as ReportDefinitionState | undefined, validation: governed?.validation, targetExists: Boolean(report) });
  const persistence = await persistReport({ ...decision, actor, validation: governed?.validation, definition: governed?.definition as ReportDefinitionState | undefined });
  return Response.json({ event: decision.event, persistence, ...await reportingProjection(command.tenantId, command.matterId), limitation });
} catch (error) { if (error instanceof RateLimitError) return rateLimitResponse(error); if (error instanceof RequestSecurityError) return Response.json({ error: "Untrusted request origin" }, { status: 403 }); if (error instanceof AuthorizationError) return Response.json({ error: "Access denied" }, { status: 403 }); return Response.json({ error: error instanceof Error ? error.message : "Reporting command failed" }, { status: 400 }); } }
