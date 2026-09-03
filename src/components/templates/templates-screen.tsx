"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { ArrowDown, ArrowUp, Pencil, Plus, Sparkles, Trash2 } from "lucide-react";
import type { Board, DeadlineAnchor, TaskLane, TemplateSet, TemplateTask } from "@/db/schema";
import { Modal } from "@/components/ui/modal";
import { Field } from "@/components/ui/fields";
import { useToast } from "@/components/ui/toast";
import { createTemplateSet, createTemplateTask, deleteTemplateSet, deleteTemplateTask, moveTemplateTask, updateTemplateSet, updateTemplateTask } from "@/lib/actions/templates";
import { BOARD_TASK_LANES, TASK_LANES, TASK_LANE_MAP } from "@/lib/domain/constants";

type SetWithTasks = TemplateSet & { tasks: TemplateTask[] };

const ANCHOR_LABELS: Record<DeadlineAnchor, string> = {
  appointment_date: "Appointment date",
  date_of_death: "Date of death",
  case_opened: "Case opened",
};

export function TemplatesScreen({ boards, sets }: { boards: Board[]; sets: SetWithTasks[] }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const [boardId, setBoardId] = useState(boards[0]?.id ?? "probate");
  const [setDialog, setSetDialog] = useState<SetWithTasks | "new" | null>(null);
  const [taskDialog, setTaskDialog] = useState<{ set: SetWithTasks; task: TemplateTask | null } | null>(null);

  const visible = sets.filter((s) => s.boardId === boardId);

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, okMsg?: string) =>
    start(async () => {
      const res = await fn();
      if (!res.ok) return toast.error(res.error ?? "Failed");
      if (okMsg) toast.notify(okMsg);
      router.refresh();
    });

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-5xl px-5 py-4">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <h1 className="text-lg font-semibold">Task templates</h1>
          <div className="flex rounded-md border border-line bg-surface p-0.5">
            {boards.map((b) => (
              <button key={b.id} className={clsx("rounded px-3 py-1 text-sm", boardId === b.id ? "bg-brand text-white" : "text-muted hover:text-ink")} onClick={() => setBoardId(b.id)}>
                {b.name}
              </button>
            ))}
          </div>
          <button className="btn btn-primary btn-sm ml-auto" onClick={() => setSetDialog("new")}>
            <Plus size={12} /> New template set
          </button>
        </div>
        <p className="mb-4 text-sm text-muted">
          A template set is a bundle of tasks with checklists. Sets marked <span className="font-medium text-ink">auto</span> are created for every new case on this board; the others can be
          added to a case from its page.
        </p>

        {visible.length === 0 && <p className="text-sm text-faint">No templates for this board yet.</p>}

        <div className="grid gap-4">
          {visible.map((set) => (
            <section key={set.id} className="card">
              <div className="flex items-center gap-2 border-b border-line px-4 py-2.5">
                <h2 className="font-semibold">{set.name}</h2>
                {set.applyOnCreate && (
                  <span className="badge bg-brand-soft text-brand">
                    <Sparkles size={10} /> auto on new case
                  </span>
                )}
                <span className="text-xs text-muted">{set.tasks.length} tasks</span>
                <div className="ml-auto flex items-center gap-1">
                  <button className="btn btn-sm" onClick={() => setTaskDialog({ set, task: null })}>
                    <Plus size={12} /> Task
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={() => setSetDialog(set)}>
                    <Pencil size={12} />
                  </button>
                  <button
                    className="btn btn-ghost btn-sm text-bad"
                    disabled={pending}
                    onClick={() => confirm(`Delete template set "${set.name}"?`) && run(() => deleteTemplateSet(set.id), "Template set deleted.")}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
              {set.description && <p className="px-4 pt-2 text-xs text-muted">{set.description}</p>}
              <ul className="divide-y divide-line">
                {set.tasks.map((t, i) => (
                  <li key={t.id} className="flex items-start gap-3 px-4 py-2.5">
                    <div className="flex flex-col gap-0.5 pt-0.5">
                      <button className="text-faint hover:text-ink disabled:opacity-30" disabled={i === 0 || pending} onClick={() => run(() => moveTemplateTask(t.id, "up"))} aria-label="Move up">
                        <ArrowUp size={12} />
                      </button>
                      <button className="text-faint hover:text-ink disabled:opacity-30" disabled={i === set.tasks.length - 1 || pending} onClick={() => run(() => moveTemplateTask(t.id, "down"))} aria-label="Move down">
                        <ArrowDown size={12} />
                      </button>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{t.title}</span>
                        <span className="badge bg-surface-2 text-muted">{TASK_LANE_MAP.get(t.lane)?.label}</span>
                        {t.dueAnchor && (
                          <span className="badge bg-surface-2 text-muted">
                            due {t.dueOffsetDays ?? 0}d after {ANCHOR_LABELS[t.dueAnchor].toLowerCase()}
                          </span>
                        )}
                      </div>
                      {t.description && <p className="mt-0.5 text-xs text-muted">{t.description}</p>}
                      {t.checklist.length > 0 && (
                        <ol className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-ink-2">
                          {t.checklist.map((c, ci) => (
                            <li key={ci} className="before:mr-1 before:text-faint before:content-['☐']">
                              {c}
                            </li>
                          ))}
                        </ol>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <button className="btn btn-ghost btn-sm" onClick={() => setTaskDialog({ set, task: t })}>
                        <Pencil size={12} />
                      </button>
                      <button className="btn btn-ghost btn-sm text-bad" disabled={pending} onClick={() => confirm(`Remove "${t.title}" from the template?`) && run(() => deleteTemplateTask(t.id))}>
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>

      {setDialog && (
        <SetDialog
          boardId={boardId}
          set={setDialog === "new" ? null : setDialog}
          onClose={() => setSetDialog(null)}
          onSave={(input) =>
            run(
              () => (setDialog === "new" ? createTemplateSet({ boardId, ...input }) : updateTemplateSet(setDialog.id, input)),
              "Saved.",
            )
          }
        />
      )}
      {taskDialog && (
        <TaskDialog
          boardId={boardId}
          task={taskDialog.task}
          onClose={() => setTaskDialog(null)}
          onSave={(input) =>
            run(() => (taskDialog.task ? updateTemplateTask(taskDialog.task.id, input) : createTemplateTask({ setId: taskDialog.set.id, ...input })), "Saved.")
          }
        />
      )}
    </div>
  );
}

function SetDialog({ boardId, set, onClose, onSave }: { boardId: string; set: SetWithTasks | null; onClose: () => void; onSave: (i: { name: string; description: string; applyOnCreate: boolean }) => void }) {
  return (
    <Modal open onClose={onClose} title={set ? "Edit template set" : `New template set (${boardId})`}>
      <form
        action={(fd) => {
          onSave({ name: String(fd.get("name") ?? ""), description: String(fd.get("description") ?? ""), applyOnCreate: fd.get("applyOnCreate") === "on" });
          onClose();
        }}
        className="grid gap-3"
      >
        <Field label="Name">
          <input name="name" className="input" defaultValue={set?.name ?? ""} required autoFocus />
        </Field>
        <Field label="Description">
          <input name="description" className="input" defaultValue={set?.description ?? ""} />
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="applyOnCreate" defaultChecked={set?.applyOnCreate ?? false} /> Create these tasks automatically on every new case
        </label>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary">
            Save
          </button>
        </div>
      </form>
    </Modal>
  );
}

function TaskDialog({
  boardId,
  task,
  onClose,
  onSave,
}: {
  boardId: string;
  task: TemplateTask | null;
  onClose: () => void;
  onSave: (i: { title: string; description: string; lane: TaskLane; checklist: string[]; dueAnchor: DeadlineAnchor | null; dueOffsetDays: number | null }) => void;
}) {
  const lanes = BOARD_TASK_LANES[boardId] ?? ["core", "assets", "litigation"];
  return (
    <Modal open onClose={onClose} title={task ? "Edit template task" : "New template task"} width="max-w-xl">
      <form
        action={(fd) => {
          const anchor = String(fd.get("dueAnchor") ?? "") as DeadlineAnchor | "";
          onSave({
            title: String(fd.get("title") ?? ""),
            description: String(fd.get("description") ?? ""),
            lane: String(fd.get("lane") ?? "core") as TaskLane,
            checklist: String(fd.get("checklist") ?? "")
              .split("\n")
              .map((s) => s.trim())
              .filter(Boolean),
            dueAnchor: anchor || null,
            dueOffsetDays: anchor ? Number(fd.get("dueOffsetDays") ?? 0) : null,
          });
          onClose();
        }}
        className="grid grid-cols-2 gap-3"
      >
        <Field label="Title" className="col-span-2">
          <input name="title" className="input" defaultValue={task?.title ?? ""} required autoFocus />
        </Field>
        <Field label="Lane">
          <select name="lane" className="select" defaultValue={task?.lane ?? lanes[0]}>
            {TASK_LANES.filter((l) => lanes.includes(l.id)).map((l) => (
              <option key={l.id} value={l.id}>
                {l.label}
              </option>
            ))}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Due relative to">
            <select name="dueAnchor" className="select" defaultValue={task?.dueAnchor ?? ""}>
              <option value="">No due date</option>
              {Object.entries(ANCHOR_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Days after">
            <input name="dueOffsetDays" type="number" className="input" defaultValue={task?.dueOffsetDays ?? 0} />
          </Field>
        </div>
        <Field label="Instructions" className="col-span-2">
          <textarea name="description" className="textarea min-h-16" defaultValue={task?.description ?? ""} />
        </Field>
        <Field label="Checklist" className="col-span-2" hint="One item per line.">
          <textarea name="checklist" className="textarea min-h-28" defaultValue={task?.checklist.join("\n") ?? ""} />
        </Field>
        <div className="col-span-2 flex justify-end gap-2">
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary">
            Save
          </button>
        </div>
      </form>
    </Modal>
  );
}
