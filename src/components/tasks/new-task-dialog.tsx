"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/modal";
import { Field } from "@/components/ui/fields";
import { useToast } from "@/components/ui/toast";
import { createTask } from "@/lib/actions/tasks";
import type { TaskLane, TaskStatus } from "@/db/schema";
import type { PersonLite } from "@/lib/data/types";
import { PRIORITIES, TASK_LANES, TASK_STATUSES } from "@/lib/domain/constants";

export function NewTaskDialog({
  open,
  onClose,
  caseOptions,
  defaultCaseId,
  parentTaskId,
  lanes,
  people,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  caseOptions: { id: string; title: string }[];
  defaultCaseId?: string | null;
  parentTaskId?: string | null;
  lanes: TaskLane[];
  people: PersonLite[];
  onCreated?: (id: string) => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();

  function submit(form: FormData) {
    const v = (k: string) => String(form.get(k) ?? "").trim();
    const checklist = v("checklist")
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    start(async () => {
      const res = await createTask({
        caseId: v("caseId"),
        parentTaskId: parentTaskId ?? null,
        title: v("title"),
        description: v("description"),
        status: v("status") as TaskStatus,
        lane: v("lane") as TaskLane,
        assigneeId: v("assigneeId") || null,
        dueDate: v("dueDate") || null,
        priority: v("priority") as "low" | "normal" | "high" | "urgent",
        checklist,
      });
      if (!res.ok) return toast.error(res.error);
      toast.notify("Task added.");
      onClose();
      onCreated?.(res.data.id);
      router.refresh();
    });
  }

  return (
    <Modal open={open} onClose={onClose} title={parentTaskId ? "New sub-task" : "New task"} width="max-w-xl">
      <form action={submit} className="grid grid-cols-2 gap-3">
        <Field label="Case" className="col-span-2">
          <select name="caseId" className="select" defaultValue={defaultCaseId ?? caseOptions[0]?.id ?? ""} required disabled={!!parentTaskId}>
            {caseOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
          {parentTaskId && <input type="hidden" name="caseId" value={defaultCaseId ?? ""} />}
        </Field>
        <Field label="Title" className="col-span-2">
          <input name="title" className="input" required autoFocus />
        </Field>
        <Field label="Status">
          <select name="status" className="select" defaultValue="requested">
            {TASK_STATUSES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Lane">
          <select name="lane" className="select" defaultValue={lanes[0] ?? "core"}>
            {TASK_LANES.filter((l) => lanes.includes(l.id)).map((l) => (
              <option key={l.id} value={l.id}>
                {l.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Assignee">
          <select name="assigneeId" className="select" defaultValue="">
            <option value="">Unassigned</option>
            {people
              .filter((p) => p.isActive)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.fullName}
                </option>
              ))}
          </select>
        </Field>
        <Field label="Due date">
          <input name="dueDate" type="date" className="input" />
        </Field>
        <Field label="Priority">
          <select name="priority" className="select" defaultValue="normal">
            {PRIORITIES.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </Field>
        <div />
        <Field label="Details" className="col-span-2">
          <textarea name="description" className="textarea min-h-16" />
        </Field>
        <Field label="Checklist" className="col-span-2" hint="One item per line.">
          <textarea name="checklist" className="textarea min-h-16" placeholder={"Draft document\nAttorney review\nFile with court"} />
        </Field>
        <div className="col-span-2 flex justify-end gap-2 pt-1">
          <button type="button" className="btn" onClick={onClose} disabled={pending}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={pending}>
            {pending ? "Adding…" : "Add task"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
