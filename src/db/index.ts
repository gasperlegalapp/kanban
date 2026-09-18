import fs from "node:fs";
import path from "node:path";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "./schema";
import * as relations from "./relations";

export const fullSchema = { ...schema, ...relations };
export type Db = PgDatabase<PgQueryResultHKT, typeof fullSchema>;

type Cached = {
  db?: Db;
  ready?: Promise<Db>;
};

// Survives Next.js hot reloads in development.
const cache: Cached = ((globalThis as unknown as { __casecontrol_db?: Cached }).__casecontrol_db ??= {});

export function isPostgresConfigured(): boolean {
  return !!process.env.DATABASE_URL;
}

/**
 * Returns the application database. With DATABASE_URL set this is Postgres
 * (Supabase in production). Without it, an embedded PGlite database is used
 * under ./.pglite so the app runs locally with no services to install.
 *
 * Migrations and the initial seed run automatically on first use.
 */
export function getDb(): Promise<Db> {
  if (cache.db) return Promise.resolve(cache.db);
  if (!cache.ready) {
    cache.ready = open().then((db) => {
      cache.db = db;
      return db;
    });
    cache.ready.catch(() => {
      cache.ready = undefined;
    });
  }
  return cache.ready;
}

/**
 * Project root. next.config.ts records the build-time directory; on Vercel
 * that path does not exist at runtime, so fall back to the working directory
 * (where traced files such as ./drizzle are placed).
 */
export function projectRoot(): string {
  const configured = process.env.CASECONTROL_ROOT;
  if (configured && fs.existsSync(configured)) return configured;
  return process.cwd();
}

async function open(): Promise<Db> {
  const migrationsFolder = path.join(projectRoot(), "drizzle");
  const { ensureSeeded } = await import("./seed");

  if (isPostgresConfigured()) {
    const [{ drizzle }, { migrate }, postgres] = await Promise.all([
      import("drizzle-orm/postgres-js"),
      import("drizzle-orm/postgres-js/migrator"),
      import("postgres").then((m) => m.default),
    ]);
    // Use the Supabase *session* pooler (port 5432). The transaction pooler
    // (6543) stalls on parameterised queries with this driver. Session mode
    // caps clients at 15, so on serverless every instance keeps a single
    // connection and drops it as soon as it goes idle.
    const serverless = !!process.env.VERCEL;
    const client = postgres(process.env.DATABASE_URL!, {
      prepare: false,
      max: serverless ? 1 : 10,
      idle_timeout: serverless ? 5 : 60,
      max_lifetime: serverless ? 60 * 5 : undefined,
      connect_timeout: 15,
    });
    const db = drizzle(client, { schema: fullSchema, casing: "snake_case" });
    if (process.env.AUTO_MIGRATE !== "false") {
      if (fs.existsSync(path.join(migrationsFolder, "meta", "_journal.json"))) {
        await migrate(db, { migrationsFolder });
      } else {
        // Migrations are applied from a developer machine with `pnpm db:migrate`.
        console.warn(`Migrations folder not found at ${migrationsFolder}; skipping auto-migrate.`);
      }
    }
    await ensureSeeded(db as unknown as Db);
    return db as unknown as Db;
  }

  const [{ drizzle }, { migrate }, { PGlite }] = await Promise.all([
    import("drizzle-orm/pglite"),
    import("drizzle-orm/pglite/migrator"),
    import("@electric-sql/pglite"),
  ]);
  const dataDir = process.env.PGLITE_DATA_DIR ?? path.join(projectRoot(), ".pglite");
  const client = new PGlite(dataDir);
  const db = drizzle(client, { schema: fullSchema, casing: "snake_case" });
  await migrate(db, { migrationsFolder });
  await ensureSeeded(db as unknown as Db);
  return db as unknown as Db;
}
