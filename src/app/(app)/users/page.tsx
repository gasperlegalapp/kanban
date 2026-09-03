import { asc } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { profiles } from "@/db/schema";
import { authMode } from "@/lib/auth/mode";
import { isAttorney, requireUser } from "@/lib/auth/session";
import { UsersScreen } from "@/components/users/users-screen";

export const dynamic = "force-dynamic";
export const metadata = { title: "Users" };

export default async function UsersPage() {
  const user = await requireUser();
  if (!isAttorney(user)) redirect("/");
  const db = await getDb();
  const people = await db.select().from(profiles).orderBy(asc(profiles.fullName));
  return <UsersScreen people={people} currentUserId={user.id} supabase={authMode() === "supabase"} />;
}
