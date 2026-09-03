"use client";

import { useActionState } from "react";
import Link from "next/link";
import { setOwnPassword } from "@/lib/actions/users";

export function PasswordForm() {
  const [state, action, pending] = useActionState(setOwnPassword, {});
  if (state.done) {
    return (
      <p className="text-sm text-ok">
        Password saved. <Link href="/" className="text-accent underline">Go to the boards</Link>.
      </p>
    );
  }
  return (
    <form action={action} className="grid gap-3">
      <label className="block">
        <span className="label">New password</span>
        <input name="password" type="password" className="input" minLength={8} required autoComplete="new-password" />
      </label>
      <label className="block">
        <span className="label">Confirm</span>
        <input name="confirm" type="password" className="input" minLength={8} required autoComplete="new-password" />
      </label>
      {state.error && <p className="text-sm text-bad">{state.error}</p>}
      <button className="btn btn-primary justify-self-start" disabled={pending}>
        {pending ? "Saving…" : "Save password"}
      </button>
    </form>
  );
}
