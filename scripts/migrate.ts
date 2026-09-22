// Applies pending migrations (and the initial seed) to the configured database.
// - With DATABASE_URL set: the Supabase/Postgres database.
// - Without it: the local embedded PGlite database in ./.pglite.
import { config as loadEnv } from "dotenv";
if (process.argv.includes("--local")) process.env.USE_PGLITE = "1";
loadEnv({ path: [".env.local", ".env"] });
import { getDb, isPostgresConfigured } from "../src/db";

async function main() {
  console.log(isPostgresConfigured() ? "Migrating Postgres database from DATABASE_URL" : "Migrating local PGlite database (./.pglite)");
  await getDb();
  console.log("Migrations applied and configuration seeded.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
