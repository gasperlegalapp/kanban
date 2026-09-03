"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { profiles } from "@/db/schema";
import { authMode, DEV_SESSION_COOKIE } from "./mode";

export type LoginState = { error?: string };

/** Development sign-in: pick a profile, no password. */
export async function devLogin(formData: FormData): Promise<void> {
  if (authMode() !== "dev") throw new Error("Dev login is disabled.");
  const id = String(formData.get("profileId") ?? "");
  const db = await getDb();
  const p = await db.query.profiles.findFirst({ where: eq(profiles.id, id) });
  if (!p || !p.isActive) throw new Error("Unknown user.");
  const store = await cookies();
  store.set(DEV_SESSION_COOKIE, p.id, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30 });
  redirect("/");
}

export async function signInWithPassword(_prev: LoginState, formData: FormData): Promise<LoginState> {
  if (authMode() !== "supabase") return { error: "Password sign-in is not configured." };
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "Enter your email and password." };
  const { createSupabaseServerClient } = await import("@/lib/supabase/server");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: error.message };
  redirect("/");
}

export async function sendPasswordReset(_prev: LoginState, formData: FormData): Promise<LoginState> {
  if (authMode() !== "supabase") return { error: "Not available in development mode." };
  const email = String(formData.get("email") ?? "").trim();
  if (!email) return { error: "Enter your email." };
  const { createSupabaseServerClient } = await import("@/lib/supabase/server");
  const supabase = await createSupabaseServerClient();
  const origin = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${origin}/auth/callback?next=/account` });
  if (error) return { error: error.message };
  return { error: undefined };
}

export async function signOut(): Promise<void> {
  const store = await cookies();
  if (authMode() === "dev") {
    store.delete(DEV_SESSION_COOKIE);
  } else {
    const { createSupabaseServerClient } = await import("@/lib/supabase/server");
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
  }
  redirect("/login");
}
