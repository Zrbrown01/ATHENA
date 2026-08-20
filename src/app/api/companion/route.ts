import { z } from "zod";
import { AuthorizationError } from "@/platform/tenant-context";
import { companionActions, nextCompanionAction, transitionCompanionRun, type CompanionAction, type CompanionStage } from "@/domain/companion/run";
import { companionFixture } from "@/domain/companion/fixture";
import { persistCompanionTransition, readCompanionRun } from "@/platform/companion-persistence";
import { GOLDEN_MATTER_ID, PILOT_TENANT_ID, pilotContext } from "@/platform/pilot-context";
import { requestActor } from "@/platform/request-actor";
import { assertTrustedWriteOrigin, RequestSecurityError } from "@/platform/request-security";
import { authorizePersistedMatter } from "@/platform/access-policy-persistence";

const requestSchema = z.object({ action: z.enum(companionActions), idempotencyKey: z.string().min(8).max(200) });

export async function GET(request: Request) {
  const actor = requestActor(request);
  if (!actor) return Response.json({ error: "Authentication required" }, { status: 401 });
  try { await authorizePersistedMatter(pilotContext(actor), PILOT_TENANT_ID, GOLDEN_MATTER_ID); }
  catch { return Response.json({ error: "Access denied" }, { status: 403 }); }
  const run = await readCompanionRun(PILOT_TENANT_ID, GOLDEN_MATTER_ID);
  const stage: CompanionStage = run?.stage ?? "not_started";
  return Response.json({ run, stage, nextAction: nextCompanionAction(stage), fixture: { matter: companionFixture.matter, document: companionFixture.document, facts: companionFixture.facts } });
}

export async function POST(request: Request) {
  try { assertTrustedWriteOrigin(request); }
  catch (error) { if (error instanceof RequestSecurityError) return Response.json({ error: "Untrusted request origin" }, { status: 403 }); throw error; }
  const actor = requestActor(request);
  if (!actor) return Response.json({ error: "Authentication required" }, { status: 401 });
  try {
    await authorizePersistedMatter(pilotContext(actor), PILOT_TENANT_ID, GOLDEN_MATTER_ID);
    const body = requestSchema.parse(await request.json());
    const current = await readCompanionRun(PILOT_TENANT_ID, GOLDEN_MATTER_ID);
    const currentStage: CompanionStage = current?.stage ?? "not_started";
    const result = transitionCompanionRun(pilotContext(actor), { tenantId: PILOT_TENANT_ID, matterId: GOLDEN_MATTER_ID, runId: companionFixture.runId, currentStage, action: body.action, idempotencyKey: body.idempotencyKey });
    await persistCompanionTransition({ action: result.command.action, currentStage, nextStage: result.nextStage, actor, event: result.event });
    const run = await readCompanionRun(PILOT_TENANT_ID, GOLDEN_MATTER_ID);
    return Response.json({ run, stage: result.nextStage, nextAction: nextCompanionAction(result.nextStage), event: result.event });
  } catch (error) {
    if (error instanceof AuthorizationError) return Response.json({ error: "Access denied" }, { status: 403 });
    if (error instanceof z.ZodError) return Response.json({ error: "Invalid workflow command", issues: error.issues }, { status: 400 });
    const message = error instanceof Error ? error.message : "Workflow transition failed";
    return Response.json({ error: message }, { status: message.includes("not valid") ? 409 : 500 });
  }
}

export type CompanionResponse = { stage: CompanionStage; nextAction: CompanionAction | null; run: Awaited<ReturnType<typeof readCompanionRun>> };
