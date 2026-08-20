import { NextResponse } from "next/server";
import { reviewFact, reviewFactCommand } from "@/domain/facts/review-fact";
import { AuthorizationError, type TenantContext } from "@/platform/tenant-context";
import { requestActor } from "@/platform/request-actor";
import { persistFactReview } from "@/platform/preview-persistence";

// Development-only identity adapter. Production must replace this with verified
// IdP claims and database-backed matter authorization before deployment.
function previewContext(userId: string): TenantContext {
  return {
    tenantId: "tenant-golden",
    userId,
    roles: ["attorney"],
    matterAccess: new Set(["matter-golden-001"]),
  };
}

export async function POST(request: Request) {
  try {
    const actor = requestActor(request);
    if (!actor) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    const command = reviewFactCommand.parse(await request.json());
    const event = reviewFact(previewContext(actor.userId), command);
    await persistFactReview(event, actor, command);
    return NextResponse.json({ event }, { status: 200 });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }
    return NextResponse.json({ error: "The review decision could not be recorded" }, { status: 400 });
  }
}
