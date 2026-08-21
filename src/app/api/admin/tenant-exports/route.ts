import {
  decideTenantExport,
  tenantExportCommand,
} from "@/domain/exports/tenant-portability";
import { authorizePersistedMatter } from "@/platform/access-policy-persistence";
import { PILOT_TENANT_ID, pilotContext } from "@/platform/pilot-context";
import {
  enforceRateLimit,
  RateLimitError,
  rateLimitResponse,
} from "@/platform/rate-limit-persistence";
import { requestActor } from "@/platform/request-actor";
import {
  assertTrustedWriteOrigin,
  RequestSecurityError,
} from "@/platform/request-security";
import {
  persistTenantExport,
  readTenantExport,
  readTenantExportEvent,
  tenantExportProjection,
} from "@/platform/tenant-export-persistence";
import { AuthorizationError } from "@/platform/tenant-context";
import { getPreviewDb } from "../../../../../db";
import { matters } from "../../../../../db/schema";
import { eq } from "drizzle-orm";

const limitation =
  "This creates a real checksummed TAR for synthetic pilot data across 12 required portability categories and every tenant-aware table discovered from Athena's current Drizzle schema. Reads are paged in 500-row chunks; an export stops with durable failed-job, decision, event, and outbox evidence above 50,000 tenant rows or a 64 MiB estimated/final archive. Completeness still fails if a table lacks tenant context or an original is missing or invalid. The TAR is assembled in memory, so streaming, encryption/key policy, provider-held data, and independent restoration remain unavailable.";

export async function GET(request: Request) {
  try {
    const actor = requestActor(request);
    if (!actor)
      return Response.json(
        { error: "Authentication required" },
        { status: 401 },
      );
    const context = pilotContext(actor);
    if (
      !context.roles.some((role) =>
        ["partner", "security_admin"].includes(role),
      )
    )
      throw new AuthorizationError();
    return Response.json({
      ...(await tenantExportProjection(PILOT_TENANT_ID)),
      limitation,
    });
  } catch (error) {
    if (error instanceof AuthorizationError)
      return Response.json({ error: "Access denied" }, { status: 403 });
    return Response.json(
      { error: "Tenant exports could not be read" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    assertTrustedWriteOrigin(request);
    const actor = requestActor(request);
    if (!actor)
      return Response.json(
        { error: "Authentication required" },
        { status: 401 },
      );
    await enforceRateLimit({
      tenantId: PILOT_TENANT_ID,
      actorId: actor.userId,
      action: "tenant_exports.create",
      policy: { limit: 5, windowMs: 60_000 },
    });
    const context = pilotContext(actor);
    const command = tenantExportCommand.parse(await request.json());
    const prior = await readTenantExportEvent(
      command.tenantId,
      command.idempotencyKey,
    );
    if (prior)
      return Response.json({
        persistence: { replayed: true, eventId: prior.eventId },
        ...(await tenantExportProjection(command.tenantId)),
        limitation,
      });
    const tenantMatters = await getPreviewDb()
      .select({ id: matters.id })
      .from(matters)
      .where(eq(matters.tenantId, command.tenantId));
    for (const matter of tenantMatters)
      await authorizePersistedMatter(
        context,
        command.tenantId,
        matter.id,
        new Date(),
        "export",
      );
    const decision = decideTenantExport({
      context,
      raw: command,
      exportExists: Boolean(
        await readTenantExport(command.tenantId, command.exportId),
      ),
    });
    const persistence = await persistTenantExport({ ...decision, actor });
    return Response.json({
      event: decision.event,
      persistence,
      ...(await tenantExportProjection(command.tenantId)),
      limitation,
    });
  } catch (error) {
    if (error instanceof RateLimitError) return rateLimitResponse(error);
    if (error instanceof RequestSecurityError)
      return Response.json(
        { error: "Untrusted request origin" },
        { status: 403 },
      );
    if (error instanceof AuthorizationError)
      return Response.json({ error: "Access denied" }, { status: 403 });
    return Response.json(
      {
        error: error instanceof Error ? error.message : "Tenant export failed",
      },
      { status: 400 },
    );
  }
}
