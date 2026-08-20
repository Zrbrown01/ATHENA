import { env } from "cloudflare:workers";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

type AthenaBindings = {
  DB?: D1Database;
  DOCUMENTS?: R2Bucket;
};

function bindings(): AthenaBindings {
  return env as unknown as AthenaBindings;
}

export function getPreviewDb() {
  const database = bindings().DB;
  if (!database) throw new Error("Athena preview database binding is unavailable");
  return drizzle(database, { schema });
}

export function getDocumentBucket(): R2Bucket {
  const bucket = bindings().DOCUMENTS;
  if (!bucket) throw new Error("Athena document storage binding is unavailable");
  return bucket;
}
