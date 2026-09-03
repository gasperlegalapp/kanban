// Dependency-free so it can run inside proxy.ts as well as on the server.

export type AuthMode = "supabase" | "dev";

/**
 * "supabase": real sign-in through Supabase Auth (production).
 * "dev": pick a user from a list, no password. Used for local development
 *        when Supabase is not configured, or when AUTH_MODE=dev is set.
 */
export function authMode(): AuthMode {
  if (process.env.AUTH_MODE === "dev") return "dev";
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return "supabase";
  return "dev";
}

export const DEV_SESSION_COOKIE = "cc_dev_user";
