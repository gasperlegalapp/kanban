import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { profiles, type Profile } from "@/db/schema";
import { authMode, DEV_SESSION_COOKIE } from "./mode";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class AuthError extends Error {}

/** The signed-in user's profile, or null. Cached per request. */
export const getCurrentUser = cache(async (): Promise<Profile | null> => {
  const db = await getDb();

  if (authMode() === "dev") {
    const store = await cookies();
    const id = store.get(DEV_SESSION_COOKIE)?.value;
    if (!id || !UUID_RE.test(id)) return null;
    const p = await db.query.profiles.findFirst({ where: eq(profiles.id, id) });
    return p && p.isActive ? p : null;
  }

  const { createSupabaseServerClient } = await import("@/lib/supabase/server");
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  let p = await db.query.profiles.findFirst({ where: eq(profiles.authUserId, user.id) });
  if (!p && user.email) {
    // First sign-in: link the auth account to the profile with the same email.
    p = await db.query.profiles.findFirst({ where: sql`lower(${profiles.email}) = ${user.email.toLowerCase()}` });
    if (p) {
      await db.update(profiles).set({ authUserId: user.id }).where(eq(profiles.id, p.id));
    }
  }
  return p && p.isActive ? p : null;
});

export async function requireUser(): Promise<Profile> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export function isAttorney(user: Pick<Profile, "role"> | null | undefined): boolean {
  return user?.role === "attorney";
}

/** For server actions: throws instead of redirecting. */
export async function requireActor(): Promise<Profile> {
  const user = await getCurrentUser();
  if (!user) throw new AuthError("You are signed out. Please sign in again.");
  return user;
}

export async function requireAttorneyActor(): Promise<Profile> {
  const user = await requireActor();
  if (!isAttorney(user)) throw new AuthError("Only attorneys can do this.");
  return user;
}
