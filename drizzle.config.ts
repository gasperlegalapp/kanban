import { defineConfig } from "drizzle-kit";

// Migrations are generated from src/db/schema.ts into ./drizzle and applied by
// scripts/migrate.ts (works for both the local PGlite database and Supabase).
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgres://localhost:5432/casecontrol",
  },
});
