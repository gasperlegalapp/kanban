"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/modal";
import { Field } from "@/components/ui/fields";
import { useToast } from "@/components/ui/toast";
import { createEvent, deleteEvent, updateEvent } from "@/lib/actions/events";
import type { CaseEvent } from "@/db/schema";

export function EventDialog({
  open,
  onClose,
  caseId,
  event,
}: {
  open: boolean;
  onClose: () => void;
  caseId: string;
  event?: CaseEvent | null;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();

  function submit(form: FormData) {
    const v = (k: string) => String(form.get(k) ?? "").trim();
    start(async () => {
      const payload = {
        kind: v("kind") as "hearing" | "deadline",
        title: v("title"),
        date: v("date"),
        time: v("time") || null,
        notes: v("notes"),
      };
      const res = event ? await updateEvent(event.id, { ...payload, status: v("status") as CaseEvent["status"] }) : await createEvent({ caseId, ...payload });
      if (!res.ok) return toast.error(res.error);
      toast.notify(event ? "Updated." : "Added to the calendar.");
      onClose();
      router.refresh();
    });
  }

  return (
    <Modal open={open} onClose={onClose} title={event ? "Edit hearing / deadline" : "New hearing or deadline"}>
      <form action={submit} className="grid grid-cols-2 gap-3">
        <Field label="Type">
          <select name="kind" className="select" defaultValue={event?.kind ?? "deadline"}>
            <option value="deadline">Deadline</option>
            <option value="hearing">Hearing</option>
          </select>
        </Field>
        {event ? (
          <Field label="Status">
            <select name="status" className="select" defaultValue={event.status}>
              <option value="pending">Pending</option>
              <option value="done">Done</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </Field>
        ) : (
          <div />
        )}
        <Field label="Title" className="col-span-2">
          <input name="title" className="input" defaultValue={event?.title ?? ""} required autoFocus placeholder="Inventory due, Hearing on application…" />
        </Field>
        <Field label="Date">
          <input name="date" type="date" className="input" defaultValue={event?.date ?? ""} required />
        </Field>
        <Field label="Time (optional)">
          <input name="time" type="time" className="input" defaultValue={event?.time ?? ""} />
        </Field>
        <Field label="Notes" className="col-span-2">
          <textarea name="notes" className="textarea min-h-16" defaultValue={event?.notes ?? ""} />
        </Field>
        {event?.ruleKey && <p className="col-span-2 text-xs text-muted">Generated from a deadline rule. It moves automatically if the anchor date changes while it is pending.</p>}
        <div className="col-span-2 flex items-center justify-between pt-1">
          {event ? (
            <button
              type="button"
              className="btn btn-danger btn-sm"
              disabled={pending}
              onClick={() => {
                if (!confirm("Remove this from the calendar?")) return;
                start(async () => {
                  const res = await deleteEvent(event.id);
                  if (!res.ok) return toast.error(res.error);
                  onClose();
                  router.refresh();
                });
              }}
            >
              Remove
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button type="button" className="btn" onClick={onClose} disabled={pending}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={pending}>
              {pending ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
