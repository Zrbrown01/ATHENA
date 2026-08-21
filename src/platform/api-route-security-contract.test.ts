import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const apiRoot = join(process.cwd(), "src/app/api");
const methodPattern = /export async function (GET|POST|PUT|PATCH|DELETE)/g;
const authorizationBoundaries = [
  "authorizePersistedMatter",
  "authorizePersistedTenantObject",
  "authorizeMatterDataPlane",
  "authorizeSupportActor",
  "authorizeMatter(",
  "requireRole(",
  "pilotContext(",
];

type Handler = { file: string; method: string; source: string };

function routeFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return routeFiles(path);
    return entry.name === "route.ts" ? [path] : [];
  });
}

function handlers(): Handler[] {
  return routeFiles(apiRoot).flatMap((file) => {
    const source = readFileSync(file, "utf8");
    const matches = [...source.matchAll(methodPattern)];
    return matches.map((match, index) => ({
      file: file.slice(apiRoot.length + 1),
      method: match[1],
      source: source.slice(match.index, matches[index + 1]?.index ?? source.length),
    }));
  });
}

describe("API route security contract", () => {
  const routes = handlers();

  it("discovers every current API route handler", () => {
    expect(routes).toHaveLength(94);
    expect(new Set(routes.map(({ file }) => file)).size).toBe(50);
  });

  it.each(routes)("requires authenticated identity for $method $file", ({ source }) => {
    expect(source).toContain("requestActor");
    expect(source).toMatch(/Authentication required/);
  });

  it.each(routes)("requires an authorization boundary for $method $file", ({ source }) => {
    expect(authorizationBoundaries.some((boundary) => source.includes(boundary))).toBe(true);
  });

  const mutations = routes.filter(({ method }) => method !== "GET");

  it.each(mutations)("requires trusted origin for $method $file", ({ source }) => {
    expect(source).toContain("assertTrustedWriteOrigin");
  });

  it.each(mutations)("requires durable rate limiting for $method $file", ({ source }) => {
    expect(source).toContain("enforceRateLimit");
  });
});
