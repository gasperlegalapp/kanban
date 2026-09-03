"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { Mail, Plus } from "lucide-react";
import type { Profile } from "@/db/schema";
import { Modal } from "@/components/ui/modal";
import { Field } from "@/components/ui/fields";
import { useToast } from "@/components/ui/toast";
import { createUser, inviteUser, updateUser } from "@/lib/actions/users";
import { ROLE_LABELS } from "@/lib/domain/constants";

export function UsersScreen({ people, currentUserId, supabase }: { people: Profile[]; currentUserId: string; supabase: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const [dialog, setDialog] = useState<Profile | "new" | null>(null);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-4xl px-5 py-4">
        <div className="mb-3 flex items-center gap-3">
          <h1 className="text-lg font-semibold">Users</h1>
          <button className="btn btn-primary btn-sm ml-auto" onClick={() => setDialog("new")}>
            <Plus size={12} /> Add user
          </button>
        </div>
        <p className="mb-4 text-sm text-muted">
          Attorneys can close cases, manage templates, users and settings. Staff can do everything else.
          {supabase ? " Sending an invitation emails a link to set a password." : " Sign-in by email and password turns on once Supabase is configured; until then everyone picks their name on the login page."}
        </p>
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-surface-2 text-left text-[11px] font-bold uppercase tracking-wider text-muted">
              <tr>
                <th className="px-4 py-2">Name</th>
                <th className="px-4 py-2">Email</th>
                <th className="px-4 py-2">Role</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {people.map((p) => (
                <tr key={p.id} className={clsx(!p.isActive && "text-muted")}>
                  <td className="px-4 py-2 font-medium">
                    {p.fullName}
                    {p.id === currentUserId && <span className="ml-2 text-xs font-normal text-faint">(you)</span>}
                  </td>
                  <td className="px-4 py-2">{p.email ?? <span className="text-faint">—</span>}</td>
                  <td className="px-4 py-2">
                    <span className={clsx("badge", p.role === "attorney" ? "bg-brand-soft text-brand" : "bg-surface-2 text-muted")}>{ROLE_LABELS[p.role]}</span>
                  </td>
                  <td className="px-4 py-2">
                    {p.isActive ? <span className="text-ok">Active</span> : <span>Deactivated</span>}
                    {supabase && p.isActive && !p.authUserId && <span className="ml-2 text-xs text-faint">never signed in</span>}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <div className="flex justify-end gap-1">
                      {supabase && p.email && p.isActive && (
                        <button
                          className="btn btn-sm"
                          disabled={pending}
                          onClick={() =>
                            start(async () => {
                              const res = await inviteUser(p.id);
                              if (!res.ok) return toast.error(res.error);
                              toast.notify(`Invitation sent to ${p.email}.`);
                            })
                          }
                        >
                          <Mail size={12} /> {p.authUserId ? "Reset password" : "Invite"}
                        </button>
                      )}
                      <button className="btn btn-sm" onClick={() => setDialog(p)}>
                        Edit
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {dialog && (
        <Modal open onClose={() => setDialog(null)} title={dialog === "new" ? "Add user" : `Edit ${dialog.fullName}`}>
          <form
            action={(fd) => {
              const input = {
                fullName: String(fd.get("fullName") ?? ""),
                email: String(fd.get("email") ?? "").trim() || null,
                role: String(fd.get("role") ?? "staff") as "attorney" | "staff",
                isActive: fd.get("isActive") === "on",
              };
              start(async () => {
                const res = dialog === "new" ? await createUser({ ...input, sendInvite: fd.get("sendInvite") === "on" }) : await updateUser(dialog.id, input);
                if (!res.ok) return toast.error(res.error);
                const invited = dialog === "new" && !!(res.data as { invited?: boolean } | undefined)?.invited;
                toast.notify(dialog === "new" ? (invited ? "User added and invited." : "User added.") : "Saved.");
                setDialog(null);
                router.refresh();
              });
            }}
            className="grid gap-3"
          >
            <Field label="Full name">
              <input name="fullName" className="input" defaultValue={dialog === "new" ? "" : dialog.fullName} required autoFocus />
            </Field>
            <Field label="Email" hint="Used to sign in and for reminder emails.">
              <input name="email" type="email" className="input" defaultValue={dialog === "new" ? "" : (dialog.email ?? "")} />
            </Field>
            <Field label="Role">
              <select name="role" className="select" defaultValue={dialog === "new" ? "staff" : dialog.role}>
                <option value="staff">Staff</option>
                <option value="attorney">Attorney</option>
              </select>
            </Field>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="isActive" defaultChecked={dialog === "new" ? true : dialog.isActive} /> Active
            </label>
            {dialog === "new" && supabase && (
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="sendInvite" defaultChecked /> Email an invitation now
              </label>
            )}
            <div className="flex justify-end gap-2">
              <button type="button" className="btn" onClick={() => setDialog(null)}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={pending}>
                Save
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
