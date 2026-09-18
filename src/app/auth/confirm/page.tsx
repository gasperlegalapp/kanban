"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

/**
 * Finishes an email link from Supabase (invitation, password reset, magic
 * link). Supabase can hand the session back three ways depending on how the
 * link was generated; all three are handled here:
 *   1. #access_token=…&refresh_token=…   (default email templates)
 *   2. ?token_hash=…&type=…              (custom templates)
 *   3. ?code=…                           (PKCE flow started in this browser)
 */
export default function ConfirmPage() {
  return (
    <Suspense fallback={<Status text="Signing you in…" />}>
      <Confirm />
    </Suspense>
  );
}

function Confirm() {
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const next = params.get("next") ?? "/";
    const supabase = createSupabaseBrowserClient();

    async function run() {
      const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const accessToken = hash.get("access_token");
      const refreshToken = hash.get("refresh_token");
      const tokenHash = params.get("token_hash");
      const type = params.get("type") as EmailOtpType | null;
      const code = params.get("code");

      if (hash.get("error_description")) throw new Error(hash.get("error_description")!);
      if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
        if (error) throw error;
      } else if (tokenHash && type) {
        const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
        if (error) throw error;
      } else if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) throw error;
      } else {
        throw new Error("This link is missing its sign-in token. Ask for a new invitation or use “Forgot password?”.");
      }
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
      router.replace(next);
      router.refresh();
    }

    run().catch((e: unknown) => setError(e instanceof Error ? e.message : "The link could not be verified."));
  }, [params, router]);

  if (error) {
    return (
      <Status text={error} tone="error">
        <a href="/login" className="btn btn-primary mt-3">
          Go to sign in
        </a>
      </Status>
    );
  }
  return <Status text="Signing you in…" />;
}

function Status({ text, tone, children }: { text: string; tone?: "error"; children?: React.ReactNode }) {
  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="card max-w-md p-8 text-center">
        <p className={tone === "error" ? "text-bad" : "text-muted"}>{text}</p>
        {children}
      </div>
    </main>
  );
}
