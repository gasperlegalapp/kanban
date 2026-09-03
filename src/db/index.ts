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

/** Project root: set by next.config.ts for the app, otherwise the working directory (scripts). */
export function projectRoot(): string {
  return process.env.CASECONTROL_ROOT || process.cwd();
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
    const client = postgres(process.env.DATABASE_URL!, { prepare: false, max: 10 });
    const db = drizzle(client, { schema: fullSchema, casing: "snake_case" });
    if (process.env.AUTO_MIGRATE !== "false") {
      await migrate(db, { migrationsFolder });
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
