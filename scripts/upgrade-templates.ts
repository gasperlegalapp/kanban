// One-time upgrade (September 2026): splits the single "standard" task set of
// each board into per-stage sets that run when a case enters that stage.
//
// The old set is only removed if nobody has edited it (its task titles still
// match the original seed exactly). An edited set is left alone and reported.
//
//   corepack pnpm exec tsx scripts/upgrade-templates.ts            (database in .env.local)
//   corepack pnpm exec tsx scripts/upgrade-templates.ts --local    (local ./.pglite)
import { config as loadEnv } from "dotenv";
if (process.argv.includes("--local")) process.env.USE_PGLITE = "1";
loadEnv({ path: [".env.local", ".env"] });
import { and, asc, eq } from "drizzle-orm";
import { getDb, isPostgresConfigured } from "../src/db";
import { templateSets, templateTasks } from "../src/db/schema";
import { seedConfiguration } from "../src/db/seed";

const ORIGINAL: Record<string, { board: string; titles: string[] }> = {
  probate_standard: {
    board: "probate",
    titles: [
      "Start Case",
      "Confirm Parties and Status",
      "Gather Info & Docs",
      "Application Drafting",
      "Waivers Admin / Will",
      "File with Court",
      "Appointment on Estate",
      "Letters Issued",
      "Fiduciary Claim(s)",
      "Assets / Inventory",
      "Estate Checking Account",
      "Inventory - Filing",
      "Pay Debts / Expenses",
    ],
  },
  guardianship_standard: {
    board: "guardianship",
    titles: [
      "Start Case",
      "Gather Info & Docs",
      "Application Drafting",
      "File with Court",
      "Appointment Hearing",
      "Bond",
      "Guardian's Inventory",
      "Guardian's Report / Account",
    ],
  },
};

async function main() {
  console.log(isPostgresConfigured() ? "Target: Postgres from DATABASE_URL" : "Target: local PGlite (./.pglite)");
  const db = await getDb();

  for (const [key, original] of Object.entries(ORIGINAL)) {
    const set = await db.query.templateSets.findFirst({
      where: and(eq(templateSets.boardId, original.board), eq(templateSets.key, key)),
      with: { tasks: { orderBy: [asc(templateTasks.position)] } },
    });
    if (!set) {
      console.log(`${key}: not present (already upgraded or never seeded).`);
      continue;
    }
    const titles = set.tasks.map((t) => t.title);
    const untouched = titles.length === original.titles.length && titles.every((t, i) => t === original.titles[i]);
    if (untouched) {
      await db.delete(templateSets).where(eq(templateSets.id, set.id));
      console.log(`${key}: unedited, replaced by per-stage sets.`);
    } else {
      console.log(`${key}: was edited by hand, so it was kept as is. Review it on the Templates page.`);
    }
  }

  await seedConfiguration(db); // adds any missing sets, never overwrites existing ones
  const sets = await db.query.templateSets.findMany({ with: { tasks: true, triggerStage: true }, orderBy: [asc(templateSets.boardId), asc(templateSets.position)] });
  for (const s of sets) {
    const when = [s.applyOnCreate ? "new case" : null, s.triggerStage ? `enters ${s.triggerStage.name}` : null].filter(Boolean).join(" + ") || "manual";
    console.log(`  ${s.boardId.padEnd(13)} ${s.name.padEnd(38)} ${String(s.tasks.length).padStart(2)} tasks  (${when})`);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
