import { describe, expect, it } from "vitest";
import { operationalRequestRecord, pseudonymousActorRef, requestTelemetryContext, safeRouteTemplate, withObservabilityHeaders } from "./request-observability";

describe("request observability", () => {
  it("preserves valid request/trace correlation without logging query content", () => {
    const context = requestTelemetryContext(new Request("https://www.athenacms.app/api/search?q=Rivera%20medical", { headers: { "x-request-id": "request-safe-001", traceparent: "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01" } }));
    expect(context).toEqual({ requestId: "request-safe-001", traceId: "4bf92f3577b34da6a3ce929d0e0e4736", route: "/api/search", method: "GET" });
  });

  it("templates dynamic export identities and never includes URL parameters", () => {
    expect(safeRouteTemplate("/api/admin/tenant-exports/tenant-export-sensitive-1234567890")).toBe("/api/admin/tenant-exports/:id");
    expect(safeRouteTemplate("/api/exports/1d92be14-2d48-4aad-8b0b-9bcc4a56b13c")).toBe("/api/exports/:id");
  });

  it("uses a pseudonymous actor reference instead of the platform identity", async () => {
    const request = new Request("https://example.test/api/tasks", { headers: { "oai-authenticated-user-id": "account-user-sensitive-001" } });
    const ref = await pseudonymousActorRef(request);
    expect(ref).toMatch(/^[a-f0-9]{16}$/);
    expect(ref).not.toContain("account-user");
  });

  it("emits only the bounded operational schema and response correlation headers", () => {
    const context = { requestId: "request-safe-001", traceId: "4bf92f3577b34da6a3ce929d0e0e4736", route: "/api/tasks", method: "POST" };
    const record = operationalRequestRecord({ context, status: 403, durationMs: 12.6, appVersion: "commit-abc", actorRef: "1234567890abcdef", outcome: "client_error" });
    expect(record).toMatchObject({ event: "http.request", status: 403, durationMs: 13, tenantId: "tenant-golden", actorRef: "1234567890abcdef", applicationVersion: "commit-abc" });
    expect(JSON.stringify(record)).not.toMatch(/email|medical|query|body|token/i);
    const response = withObservabilityHeaders(new Response("denied", { status: 403 }), context, 12.6);
    expect(response.headers.get("x-athena-request-id")).toBe("request-safe-001");
    expect(response.headers.get("server-timing")).toBe("athena;dur=12.6");
  });
});

