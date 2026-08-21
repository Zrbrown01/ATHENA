import {
  DEFAULT_DEVICE_SIZES,
  DEFAULT_IMAGE_SIZES,
  handleImageOptimization,
} from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";
import { runScheduledInternalDelivery } from "../src/platform/outbox-scheduler";
import { operationalRequestRecord, pseudonymousActorRef, requestTelemetryContext, withObservabilityHeaders } from "../src/platform/request-observability";

interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> };
  DB: D1Database;
  DOCUMENTS: R2Bucket;
  ATHENA_APP_VERSION?: string;
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

const securityHeaders = {
  "Content-Security-Policy": "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; img-src 'self' data:; font-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self'",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Resource-Policy": "same-origin",
} as const;

function withSecurityHeaders(response: Response): Response {
  const secured = new Response(response.body, response);
  for (const [name, value] of Object.entries(securityHeaders)) secured.headers.set(name, value);
  return secured;
}

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const startedAt = performance.now();
    const telemetry = requestTelemetryContext(request);
    const actorRef = await pseudonymousActorRef(request);
    const url = new URL(request.url);
    try {
      let response: Response;
      if (url.pathname === "/_vinext/image") {
        const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
        response = await handleImageOptimization(request, { fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))), transformImage: async (body, { width, format, quality }) => { const result = await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality }); return result.response(); } }, allowedWidths);
      } else response = await handler.fetch(request, env, ctx);
      const durationMs = performance.now() - startedAt, status = response.status, outcome = status >= 500 ? "server_error" : status >= 400 ? "client_error" : "success";
      console.log(JSON.stringify(operationalRequestRecord({ context: telemetry, status, durationMs, appVersion: env.ATHENA_APP_VERSION ?? "unversioned", actorRef, outcome })));
      return withObservabilityHeaders(withSecurityHeaders(response), telemetry, durationMs);
    } catch (error) {
      console.error(JSON.stringify(operationalRequestRecord({ context: telemetry, status: 500, durationMs: performance.now() - startedAt, appVersion: env.ATHENA_APP_VERSION ?? "unversioned", actorRef, outcome: "exception", errorName: error instanceof Error ? error.name : "UnknownError" })));
      throw error;
    }
  },
  scheduled(controller: { scheduledTime: number; cron: string }, _env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(runScheduledInternalDelivery({ trigger: `cron:${controller.cron}`, scheduledAt: new Date(controller.scheduledTime) }));
  },
};

export default worker;
