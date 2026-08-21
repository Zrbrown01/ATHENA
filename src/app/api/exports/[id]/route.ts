import { authorizePersistedTenantObject } from "@/platform/access-policy-persistence";
import { authorizeClassifiedUse } from "@/platform/classification-boundary";
import { getExportForActor } from "@/platform/companion-persistence";
import { pilotContext, PILOT_TENANT_ID } from "@/platform/pilot-context";
import { requestActor } from "@/platform/request-actor";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const actor = requestActor(request);
  if (!actor)
    return Response.json({ error: "Authentication required" }, { status: 401 });
  const { id } = await params;
  const result = await getExportForActor(PILOT_TENANT_ID, id);
  if (!result)
    return Response.json({ error: "Export not found" }, { status: 404 });
  try {
    const context = pilotContext(actor);
    await authorizePersistedTenantObject(
      context,
      PILOT_TENANT_ID,
      result.job.matterId,
      result.job.objectKey,
      "export",
    );
    await authorizeClassifiedUse({
      context,
      tenantId: PILOT_TENANT_ID,
      matterId: result.job.matterId,
      resourceType: "export_job",
      resourceId: result.job.id,
      plane: "download",
    });
  } catch {
    return Response.json({ error: "Access denied" }, { status: 403 });
  }
  const extension = result.job.format === "application/x-tar" ? "tar" : "json";
  return new Response(result.object.body, {
    headers: {
      "content-type": result.job.format,
      "content-disposition": `attachment; filename="athena-${result.job.matterId}-export.${extension}"`,
      "x-content-type-options": "nosniff",
      "cache-control": "private, no-store",
      "x-athena-sha256": result.job.sha256,
      "x-athena-export-completeness": result.job.completeness,
      "x-athena-restoration-verified": String(
        Boolean(result.job.restorationVerifiedAt),
      ),
    },
  });
}
