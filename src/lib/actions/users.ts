"use server";

import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/db";
import { profiles } from "@/db/schema";
import { authMode } from "@/lib/auth/mode";
import { requireActor, requireAttorneyActor } from "@/lib/auth/session";
import { runAction, type ActionResult } from "./result";

const userInput = z.object({
  fullName: z.string().trim().min(1).max(120),
  email: z.string().trim().email().nullable().optional().or(z.literal("")),
  role: z.enum(["attorney", "staff"]),
  isActive: z.boolean().optional(),
});

export async function createUser(raw: z.input<typeof userInput> & { sendInvite?: boolean }): Promise<ActionResult<{ id: string; invited: boolean }>> {
  return runAction(async () => {
    await requireAttorneyActor();
    const input = userInput.parse(raw);
    const email = input.email ? input.email.toLowerCase() : null;
    const db = await getDb();
    if (email) {
      const dupe = await db.query.profiles.findFirst({ where: sql`lower(${profiles.email}) = ${email}` });
      if (dupe) throw new Error("A user with that email already exists.");
    }
    const [row] = await db.insert(profiles).values({ fullName: input.fullName, email, role: input.role, isActive: input.isActive ?? true }).returning({ id: profiles.id });
    let invited = false;
    if (email && raw.sendInvite && authMode() === "supabase") {
      invited = await sendInvite(email, input.fullName);
    }
    revalidatePath("/users");
    return { id: row.id, invited };
  });
}

export async function updateUser(id: string, raw: Partial<z.input<typeof userInput>>): Promise<ActionResult> {
  return runAction(async () => {
    const actor = await requireAttorneyActor();
    const patch = userInput.partial().parse(raw);
    const db = await getDb();
    if (id === actor.id && (patch.role === "staff" || patch.isActive === false)) {
      throw new Error("You cannot demote or deactivate yourself.");
    }
    await db
      .update(profiles)
      .set({
        ...(patch.fullName !== undefined ? { fullName: patch.fullName } : {}),
        ...(patch.email !== undefined ? { email: patch.email ? patch.email.toLowerCase() : null } : {}),
        ...(patch.role !== undefined ? { role: patch.role } : {}),
        ...(patch.isActive !== undefined ? { isActive: patch.isActive } : {}),
      })
      .where(eq(profiles.id, id));
    revalidatePath("/users");
    revalidatePath("/", "layout");
    return undefined;
  });
}

export async function inviteUser(id: string): Promise<ActionResult<{ invited: boolean }>> {
  return runAction(async () => {
    await requireAttorneyActor();
    if (authMode() !== "supabase") throw new Error("Invitations need Supabase sign-in to be configured.");
    const db = await getDb();
    const p = await db.query.profiles.findFirst({ where: eq(profiles.id, id) });
    if (!p?.email) throw new Error("Add an email address first.");
    return { invited: await sendInvite(p.email, p.fullName) };
  });
}

async function sendInvite(email: string, fullName: string): Promise<boolean> {
  const { createSupabaseAdminClient } = await import("@/lib/supabase/server");
  const admin = createSupabaseAdminClient();
  const origin = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");
  const { error } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { full_name: fullName },
    redirectTo: `${origin}/auth/callback?next=/account`,
  });
  if (error) {
    if (/already/i.test(error.message)) {
      // Existing auth user: send a password reset instead so they can sign in.
      const { error: e2 } = await admin.auth.resetPasswordForEmail(email, { redirectTo: `${origin}/auth/callback?next=/account` });
      if (e2) throw new Error(e2.message);
      return true;
    }
    throw new Error(error.message);
  }
  return true;
}

/** Lets the signed-in person set or change their own password (Supabase mode). */
export async function setOwnPassword(_prev: { error?: string; done?: boolean }, formData: FormData): Promise<{ error?: string; done?: boolean }> {
  try {
    await requireActor();
    if (authMode() !== "supabase") return { error: "Passwords are not used in development mode." };
    const password = String(formData.get("password") ?? "");
    const confirmPw = String(formData.get("confirm") ?? "");
    if (password.length < 8) return { error: "Use at least 8 characters." };
    if (password !== confirmPw) return { error: "Passwords do not match." };
    const { createSupabaseServerClient } = await import("@/lib/supabase/server");
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.updateUser({ password });
    if (error) return { error: error.message };
    return { done: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed" };
  }
}
