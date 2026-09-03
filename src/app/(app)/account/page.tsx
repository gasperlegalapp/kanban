import { authMode } from "@/lib/auth/mode";
import { requireUser } from "@/lib/auth/session";
import { ROLE_LABELS } from "@/lib/domain/constants";
import { PasswordForm } from "./password-form";

export const metadata = { title: "My account" };

export default async function AccountPage() {
  const user = await requireUser();
  const supabase = authMode() === "supabase";
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-lg px-5 py-6">
        <h1 className="mb-1 text-lg font-semibold">My account</h1>
        <p className="mb-4 text-sm text-muted">
          {user.fullName} · {ROLE_LABELS[user.role]}
          {user.email ? ` · ${user.email}` : ""}
        </p>
        <div className="card p-5">
          <h2 className="panel-title mb-3">{supabase ? "Set your password" : "Password"}</h2>
          {supabase ? (
            <PasswordForm />
          ) : (
            <p className="text-sm text-muted">Passwords are not used in development mode. Configure Supabase to enable sign-in.</p>
          )}
        </div>
      </div>
    </div>
  );
}
