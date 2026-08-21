import { pilotContext, PILOT_TENANT_ID } from "@/platform/pilot-context";
import { requestActor } from "@/platform/request-actor";
import { getTenantExportObject } from "@/platform/tenant-export-persistence";
import { requireRole } from "@/platform/tenant-context";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const actor = requestActor(request);
  if (!actor)
    return Response.json({ error: "Authentication required" }, { status: 401 });
  try {
    requireRole(pilotContext(actor), ["partner", "security_admin"]);
  } catch {
    return Response.json({ error: "Access denied" }, { status: 403 });
  }
  const { id } = await params;
  const result = await getTenantExportObject(PILOT_TENANT_ID, id);
  if (!result)
    return Response.json({ error: "Tenant export not found" }, { status: 404 });
  return new Response(result.object.body, {
    headers: {
      "content-type": "application/x-tar",
      "content-disposition": `attachment; filename="athena-tenant-${id}.tar"`,
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
      "x-athena-sha256": result.job.sha256,
      "x-athena-export-completeness": result.job.completeness,
      "x-athena-missing-items": String(result.job.missingItems.length),
    },
  });
}
