import { NextResponse } from "next/server";
import { reviewFact } from "@/domain/facts/review-fact";
import { AuthorizationError, type TenantContext } from "@/platform/tenant-context";

// Development-only identity adapter. Production must replace this with verified
// IdP claims and database-backed matter authorization before deployment.
function developmentContext(): TenantContext {
  return {
    tenantId: "tenant-golden",
    userId: "user-maya-chen",
    roles: ["attorney"],
    matterAccess: new Set(["matter-golden-001"]),
  };
}

export async function POST(request: Request) {
  try {
    const event = reviewFact(developmentContext(), await request.json());
    return NextResponse.json({ event }, { status: 200 });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }
    return NextResponse.json({ error: "Invalid review command" }, { status: 400 });
  }
}
