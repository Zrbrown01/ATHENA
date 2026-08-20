import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./db/postgres-migrations",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgres://athena:athena@localhost:5432/athena",
  },
  strict: true,
  verbose: true,
});
