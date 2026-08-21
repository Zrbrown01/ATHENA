import { searchQuery } from "@/domain/search/structured";
import { authorizePersistedMatter } from "@/platform/access-policy-persistence";
import {
  authorizeClassifiedUse,
  ClassificationDeniedError,
} from "@/platform/classification-boundary";
import {
  GOLDEN_MATTER_ID,
  PILOT_TENANT_ID,
  pilotContext,
} from "@/platform/pilot-context";
import { requestActor } from "@/platform/request-actor";
import { structuredMatterSearch } from "@/platform/structured-search-persistence";
import { AuthorizationError } from "@/platform/tenant-context";

export async function GET(request: Request) {
  try {
    const actor = requestActor(request);
    if (!actor)
      return Response.json(
        { error: "Authentication required" },
        { status: 401 },
      );
    const context = pilotContext(actor);
    await authorizePersistedMatter(context, PILOT_TENANT_ID, GOLDEN_MATTER_ID);
    const q = searchQuery.parse(
      new URL(request.url).searchParams.get("q") ?? "",
    );
    const rawResults = await structuredMatterSearch(
      PILOT_TENANT_ID,
      GOLDEN_MATTER_ID,
      q,
    );
    const results = [];
    for (const result of rawResults) {
      if (result.category !== "document") {
        results.push(result);
        continue;
      }
      try {
        const policy = await authorizeClassifiedUse({
          context,
          tenantId: PILOT_TENANT_ID,
          matterId: GOLDEN_MATTER_ID,
          resourceType: "document",
          resourceId: result.sourceId,
          plane: "search",
        });
        results.push(
          policy.outcome === "redact"
            ? {
                ...result,
                title: "Restricted classified document",
                subtitle: "Metadata redacted by classification policy",
              }
            : result,
        );
      } catch (error) {
        if (!(error instanceof ClassificationDeniedError)) throw error;
      }
    }
    return Response.json({
      query: q,
      results,
      limitation:
        "This is tenant- and matter-scoped deterministic structured search with classified-document redaction or denial. Ask Athena and AI retrieval remain disabled; results are direct records, not generated answers.",
    });
  } catch (error) {
    if (error instanceof AuthorizationError)
      return Response.json({ error: "Access denied" }, { status: 403 });
    return Response.json(
      { error: error instanceof Error ? error.message : "Search failed" },
      { status: 400 },
    );
  }
}
