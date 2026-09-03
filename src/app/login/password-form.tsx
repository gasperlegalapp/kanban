"use client";

import { useActionState, useState } from "react";
import { sendPasswordReset, signInWithPassword, type LoginState } from "@/lib/auth/actions";

export function PasswordLoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(signInWithPassword, {});
  const [resetState, resetAction, resetPending] = useActionState<LoginState, FormData>(sendPasswordReset, {});
  const [showReset, setShowReset] = useState(false);

  if (showReset) {
    return (
      <form action={resetAction} className="grid gap-3">
        <p className="text-sm text-muted">Enter your email and we will send a link to set a new password.</p>
        <div>
          <label className="label" htmlFor="reset-email">Email</label>
          <input id="reset-email" name="email" type="email" className="input" required autoComplete="email" />
        </div>
        {resetState.error && <p className="text-sm text-bad">{resetState.error}</p>}
        {resetState.error === undefined && "error" in resetState && (
          <p className="text-sm text-ok">If that email belongs to a user, a reset link is on its way.</p>
        )}
        <button className="btn btn-primary" type="submit" disabled={resetPending}>
          {resetPending ? "Sending…" : "Send reset link"}
        </button>
        <button className="btn btn-ghost" type="button" onClick={() => setShowReset(false)}>
          Back to sign in
        </button>
      </form>
    );
  }

  return (
    <form action={action} className="grid gap-3">
      <div>
        <label className="label" htmlFor="email">Email</label>
        <input id="email" name="email" type="email" className="input" required autoComplete="email" />
      </div>
      <div>
        <label className="label" htmlFor="password">Password</label>
        <input id="password" name="password" type="password" className="input" required autoComplete="current-password" />
      </div>
      {state.error && <p className="text-sm text-bad">{state.error}</p>}
      <button className="btn btn-primary" type="submit" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </button>
      <button className="btn btn-ghost text-muted" type="button" onClick={() => setShowReset(true)}>
        Forgot password?
      </button>
    </form>
  );
}
