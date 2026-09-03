import { getDb } from "@/db";
import { runReminders } from "@/lib/services/reminders";

/**
 * Daily reminder job. Vercel Cron calls this with "Authorization: Bearer
 * $CRON_SECRET" (see vercel.json). It can also be triggered manually with the
 * same header.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (secret && auth !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  if (!secret && process.env.NODE_ENV === "production") {
    return new Response("CRON_SECRET is not configured", { status: 500 });
  }
  const db = await getDb();
  const result = await runReminders(db);
  return Response.json({ ok: true, ...result, ranAt: new Date().toISOString() });
}
