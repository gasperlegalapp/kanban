"use client";

import { useState, useTransition } from "react";
import { setEmailNotifications } from "@/lib/actions/users";
import { useToast } from "@/components/ui/toast";

export function EmailToggle({ initial, hasEmail }: { initial: boolean; hasEmail: boolean }) {
  const toast = useToast();
  const [on, setOn] = useState(initial);
  const [pending, start] = useTransition();
  return (
    <label className="flex items-start gap-3 text-sm">
      <input
        type="checkbox"
        className="mt-0.5"
        checked={on}
        disabled={pending || !hasEmail}
        onChange={(e) => {
          const next = e.target.checked;
          setOn(next);
          start(async () => {
            const res = await setEmailNotifications(next);
            if (!res.ok) {
              setOn(!next);
              return toast.error(res.error);
            }
            toast.notify(next ? "Email notifications on." : "Email notifications off.");
          });
        }}
      />
      <span>
        Email me when a task is assigned to me, sent to me for review, approved or returned, when someone @mentions me, and for daily deadline and follow-up reminders.
        <span className="block text-xs text-muted">
          {hasEmail ? "Notifications always appear under the bell in the app either way." : "Add an email address on the Users page to receive emails."}
        </span>
      </span>
    </label>
  );
}
