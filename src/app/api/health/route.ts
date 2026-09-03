import { sql } from "drizzle-orm";
import { getDb, isPostgresConfigured, projectRoot } from "@/db";
import { boards, cases, lanes } from "@/db/schema";
import { authMode } from "@/lib/auth/mode";

export async function GET() {
  try {
    const db = await getDb();
    const count = sql<number>`count(*)::int`;
    const [[b], [c], [l]] = await Promise.all([
      db.select({ n: count }).from(boards),
      db.select({ n: count }).from(cases),
      db.select({ n: count }).from(lanes),
    ]);
    return Response.json({
      ok: true,
      database: isPostgresConfigured() ? "postgres" : "pglite",
      auth: authMode(),
      root: projectRoot(),
      cwd: process.cwd(),
      dataDir: process.env.PGLITE_DATA_DIR ?? null,
      counts: { boards: b.n, cases: c.n, lanes: l.n },
    });
  } catch (err) {
    return Response.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
