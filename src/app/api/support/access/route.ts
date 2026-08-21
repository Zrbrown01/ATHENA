import { PILOT_TENANT_ID } from "@/platform/pilot-context";
import { requestActor } from "@/platform/request-actor";
import { authorizeSupportActor } from "@/platform/support-access-persistence";

export async function GET(request: Request) {
  const actor = requestActor(request); if (!actor) return Response.json({ error: "Authentication required" }, { status: 401 });
  const matterId = new URL(request.url).searchParams.get("matterId"); if (!matterId) return Response.json({ error: "Matter scope is required" }, { status: 400 });
  try { const grant = await authorizeSupportActor(actor, PILOT_TENANT_ID, matterId); return Response.json({ authorized: true, scope: { matterId: grant.matterId, purpose: grant.purpose, ticketReference: grant.ticketReference, expiresAt: grant.expiresAt }, limitation: "Scope metadata only. This endpoint returns no matter content and grants no standing access." }); }
  catch { return Response.json({ error: "Active matter-scoped support approval is required" }, { status: 403 }); }
}
