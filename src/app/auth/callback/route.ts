import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Completes Supabase email links. A PKCE `code` is exchanged here on the
 * server; every other link shape (tokens in the URL fragment, token_hash) is
 * handed to /auth/confirm, which finishes it in the browser.
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/";
  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, url.origin));
  }
  const confirm = new URL("/auth/confirm", url.origin);
  url.searchParams.forEach((v, k) => confirm.searchParams.set(k, v));
  return NextResponse.redirect(confirm);
}
