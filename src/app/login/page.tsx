import { redirect } from "next/navigation";
import { Scale } from "lucide-react";
import { getDb } from "@/db";
import { authMode } from "@/lib/auth/mode";
import { getCurrentUser } from "@/lib/auth/session";
import { devLogin } from "@/lib/auth/actions";
import { ROLE_LABELS } from "@/lib/domain/constants";
import { PasswordLoginForm } from "./password-form";

export const metadata = { title: "Sign in" };

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect("/");

  const mode = authMode();
  const db = await getDb();
  const people = mode === "dev" ? await db.query.profiles.findMany({ orderBy: (p, { asc }) => [asc(p.fullName)] }) : [];

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="card w-full max-w-md p-8">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-brand text-white shadow-card">
            <Scale size={22} />
          </div>
          <div>
            <h1 className="text-xl font-semibold">Case Control</h1>
            <p className="text-sm text-muted">Gasper Legal workflow</p>
          </div>
        </div>

        {mode === "dev" ? (
          <div>
            <p className="mb-3 text-sm text-muted">
              Development mode: choose who you are. Real sign-in turns on once Supabase is configured.
            </p>
            <div className="grid gap-2">
              {people
                .filter((p) => p.isActive)
                .map((p) => (
                  <form key={p.id} action={devLogin}>
                    <input type="hidden" name="profileId" value={p.id} />
                    <button className="btn w-full justify-between" type="submit">
                      <span>{p.fullName}</span>
                      <span className="badge bg-brand-soft text-brand">{ROLE_LABELS[p.role]}</span>
                    </button>
                  </form>
                ))}
            </div>
          </div>
        ) : (
          <PasswordLoginForm />
        )}
      </div>
    </main>
  );
}
