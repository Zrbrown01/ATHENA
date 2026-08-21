const safeIdentifier = /^[A-Za-z0-9._:-]{8,128}$/;
const traceParent = /^[\da-f]{2}-([\da-f]{32})-[\da-f]{16}-[\da-f]{2}$/i;
const opaqueSegment = /^(?:[\da-f]{8}-[\da-f-]{16,}|[a-z0-9_-]{24,})$/i;
const dynamicParents = new Set(["exports", "tenant-exports"]);

export type RequestTelemetryContext = {
  requestId: string;
  traceId: string;
  route: string;
  method: string;
};

export function requestTelemetryContext(request: Request): RequestTelemetryContext {
  const requestIdHeader = request.headers.get("x-request-id") ?? request.headers.get("cf-ray");
  const requestId = requestIdHeader && safeIdentifier.test(requestIdHeader) ? requestIdHeader : crypto.randomUUID();
  const parent = request.headers.get("traceparent")?.match(traceParent);
  return { requestId, traceId: parent?.[1].toLowerCase() ?? crypto.randomUUID().replaceAll("-", ""), route: safeRouteTemplate(new URL(request.url).pathname), method: request.method.toUpperCase() };
}

export function safeRouteTemplate(pathname: string): string {
  const segments = pathname.split("/");
  return segments.map((segment, index) => {
    const decoded = safeDecode(segment);
    const prior = safeDecode(segments[index - 1] ?? "");
    if ((dynamicParents.has(prior) && decoded) || opaqueSegment.test(decoded)) return ":id";
    return decoded.slice(0, 80).replace(/[^A-Za-z0-9._~-]/g, "_");
  }).join("/");
}

export async function pseudonymousActorRef(request: Request): Promise<string | null> {
  const actorId = request.headers.get("oai-authenticated-user-id");
  if (!actorId) return null;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(actorId));
  return Array.from(new Uint8Array(digest).slice(0, 8), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function operationalRequestRecord(input: { context: RequestTelemetryContext; status: number; durationMs: number; appVersion: string; actorRef: string | null; outcome: "success" | "client_error" | "server_error" | "exception"; errorName?: string }) {
  return { timestamp: new Date().toISOString(), level: input.outcome === "server_error" || input.outcome === "exception" ? "error" : "info", event: "http.request", requestId: input.context.requestId, traceId: input.context.traceId, method: input.context.method, route: input.context.route, status: input.status, durationMs: Math.max(0, Math.round(input.durationMs)), tenantId: input.actorRef ? "tenant-golden" : null, actorRef: input.actorRef, matterId: null, workflowId: null, integrationId: null, eventId: null, applicationVersion: input.appVersion, outcome: input.outcome, errorName: input.errorName ?? null };
}

export function withObservabilityHeaders(response: Response, context: RequestTelemetryContext, durationMs: number): Response {
  const result = new Response(response.body, response);
  result.headers.set("x-athena-request-id", context.requestId);
  result.headers.set("x-athena-trace-id", context.traceId);
  result.headers.set("server-timing", `athena;dur=${Math.max(0, durationMs).toFixed(1)}`);
  return result;
}

function safeDecode(value: string) { try { return decodeURIComponent(value); } catch { return "invalid"; } }

