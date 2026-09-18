import { createBrowserClient } from "@supabase/ssr";

/** Supabase client for the browser; stores the session in cookies the server can read. */
export function createSupabaseBrowserClient() {
  return createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}
