import { getExportForActor } from "@/platform/companion-persistence";
import { pilotContext, PILOT_TENANT_ID } from "@/platform/pilot-context";
import { requestActor } from "@/platform/request-actor";
import { authorizeMatter } from "@/platform/tenant-context";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = requestActor(request);
  if (!actor) return Response.json({ error: "Authentication required" }, { status: 401 });
  const { id } = await params;
  const result = await getExportForActor(PILOT_TENANT_ID, id);
  if (!result) return Response.json({ error: "Export not found" }, { status: 404 });
  try { authorizeMatter(pilotContext(actor), PILOT_TENANT_ID, result.job.matterId); }
  catch { return Response.json({ error: "Access denied" }, { status: 403 }); }
  return new Response(result.object.body, { headers: { "content-type": result.job.format, "content-disposition": `attachment; filename="athena-${result.job.matterId}-export.json"`, "x-content-type-options": "nosniff", "cache-control": "private, no-store", "x-athena-sha256": result.job.sha256 } });
}
