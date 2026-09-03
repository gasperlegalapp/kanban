// Re-runs the configuration seed (boards, stages, lanes, case types, template
// sets, deadline rules, users, settings). Safe to run more than once.
import "dotenv/config";
import { getDb } from "../src/db";
import { seedConfiguration } from "../src/db/seed";

async function main() {
  const db = await getDb();
  await seedConfiguration(db);
  console.log("Seed complete.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
