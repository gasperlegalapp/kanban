import { AuthError } from "@/lib/auth/session";

export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

/**
 * Wraps a server action body so the client always receives a serializable
 * result instead of an opaque server error.
 */
export async function runAction<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    const data = await fn();
    return { ok: true, data };
  } catch (err) {
    if (err && typeof err === "object" && "digest" in err && String((err as { digest?: string }).digest).startsWith("NEXT_")) {
      throw err; // redirect() / notFound() must propagate
    }
    const message = err instanceof AuthError ? err.message : err instanceof Error ? err.message : "Something went wrong.";
    if (!(err instanceof AuthError)) console.error(err);
    return { ok: false, error: message };
  }
}
