import { NextResponse } from "next/server";
import { reviewFact, reviewFactCommand } from "@/domain/facts/review-fact";
import { AuthorizationError } from "@/platform/tenant-context";
import { requestActor } from "@/platform/request-actor";
import { persistFactReview } from "@/platform/preview-persistence";
import { pilotContext } from "@/platform/pilot-context";
import { assertTrustedWriteOrigin, RequestSecurityError } from "@/platform/request-security";
import { authorizePersistedMatter } from "@/platform/access-policy-persistence";

export async function POST(request: Request) {
  try {
    assertTrustedWriteOrigin(request);
    const actor = requestActor(request);
    if (!actor) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    const command = reviewFactCommand.parse(await request.json());
    await authorizePersistedMatter(pilotContext(actor), command.tenantId, command.matterId);
    const event = reviewFact(pilotContext(actor), command);
    await persistFactReview(event, actor, command);
    return NextResponse.json({ event }, { status: 200 });
  } catch (error) {
    if (error instanceof RequestSecurityError) return NextResponse.json({ error: "Untrusted request origin" }, { status: 403 });
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }
    return NextResponse.json({ error: "The review decision could not be recorded" }, { status: 400 });
  }
}
