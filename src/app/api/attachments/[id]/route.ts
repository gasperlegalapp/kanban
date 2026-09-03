import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { attachments } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth/session";
import { getStorage } from "@/lib/storage";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const { id } = await ctx.params;
  const db = await getDb();
  const row = await db.query.attachments.findFirst({ where: eq(attachments.id, id) });
  if (!row) return new Response("Not found", { status: 404 });
  const file = await getStorage().get(row.storageKey);
  if (!file) return new Response("File missing", { status: 404 });
  const inline = /^(image\/|application\/pdf|text\/)/.test(row.contentType);
  return new Response(new Uint8Array(file.data), {
    headers: {
      "Content-Type": row.contentType,
      "Content-Length": String(file.data.length),
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${encodeURIComponent(row.fileName)}"`,
      "Cache-Control": "private, max-age=0",
    },
  });
}
