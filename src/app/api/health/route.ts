import { sql } from "drizzle-orm";
import { getDb, isPostgresConfigured } from "@/db";
import { boards, cases } from "@/db/schema";
import { authMode } from "@/lib/auth/mode";

/** Liveness check: confirms the database is reachable and migrated. */
export async function GET() {
  try {
    const db = await getDb();
    const count = sql<number>`count(*)::int`;
    const [[b], [c]] = await Promise.all([db.select({ n: count }).from(boards), db.select({ n: count }).from(cases)]);
    return Response.json({
      ok: true,
      database: isPostgresConfigured() ? "postgres" : "pglite",
      auth: authMode(),
      boards: b.n,
      cases: c.n,
    });
  } catch (err) {
    return Response.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
