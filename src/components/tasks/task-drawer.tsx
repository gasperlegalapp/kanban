"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { Check, ExternalLink, Plus, Trash2 } from "lucide-react";
import { Drawer } from "@/components/ui/modal";
import { Field, Spinner } from "@/components/ui/fields";
import { useToast } from "@/components/ui/toast";
import { addChecklistItem, deleteChecklistItem, deleteTask, getTaskDetail, updateChecklistItem, updateTask, type TaskDetailData } from "@/lib/actions/tasks";
import { addComment } from "@/lib/actions/comments";
import type { PersonLite } from "@/lib/data/types";
import type { TaskLane } from "@/db/schema";
import { PRIORITIES, TASK_LANES, TASK_STATUSES } from "@/lib/domain/constants";
import { fmtDate, relTime } from "@/lib/format";
import { NewTaskDialog } from "./new-task-dialog";

export function TaskDrawer({
  taskId,
  onClose,
  people,
  lanes,
  canDelete,
}: {
  taskId: string | null;
  onClose: () => void;
  people: PersonLite[];
  lanes: TaskLane[];
  canDelete: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [task, setTask] = useState<TaskDetailData | null>(null);
  const [pending, start] = useTransition();
  const [newItem, setNewItem] = useState("");
  const [comment, setComment] = useState("");
  const [subtaskOpen, setSubtaskOpen] = useState(false);
  const [openSubtaskId, setOpenSubtaskId] = useState<string | null>(null);

  const [version, setVersion] = useState(0);

  // Reset the drawer when it is pointed at a different task.
  const [shownTaskId, setShownTaskId] = useState(taskId);
  if (shownTaskId !== taskId) {
    setShownTaskId(taskId);
    setTask(null);
    setOpenSubtaskId(null);
  }

  useEffect(() => {
    if (!taskId) return;
    let cancelled = false;
    getTaskDetail(taskId).then((res) => {
      if (cancelled) return;
      if (!res.ok) {
        toast.error(res.error);
        onClose();
        return;
      }
      setTask(res.data);
    });
    return () => {
      cancelled = true;
    };
  }, [taskId, version, toast, onClose]);

  const loading = !!taskId && !task;

  const refresh = useCallback(() => {
    setVersion((v) => v + 1);
    router.refresh();
  }, [router]);

  const patch = (p: Parameters<typeof updateTask>[1]) => {
    if (!task) return;
    start(async () => {
      const res = await updateTask(task.id, p);
      if (!res.ok) return toast.error(res.error);
      refresh();
    });
  };

  const title = task ? (
    <div className="min-w-0">
      <div className="truncate">{task.title}</div>
      <Link href={`/cases/${task.case.id}`} className="flex items-center gap-1 text-xs font-normal text-accent hover:underline" onClick={onClose}>
        {task.case.title}
        {task.case.caseNumber && <span className="font-mono text-muted">· {task.case.caseNumber}</span>}
        <ExternalLink size={11} />
      </Link>
    </div>
  ) : (
    "Task"
  );

  return (
    <Drawer open={!!taskId} onClose={onClose} title={title}>
      {loading && !task && (
        <div className="flex items-center gap-2 text-sm text-muted">
          <Spinner /> Loading…
        </div>
      )}
      {task && (
        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Status">
              <select className="select" value={task.status} onChange={(e) => patch({ status: e.target.value as typeof task.status })} disabled={pending}>
                {TASK_STATUSES.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Lane">
              <select className="select" value={task.lane} onChange={(e) => patch({ lane: e.target.value as TaskLane })} disabled={pending}>
                {TASK_LANES.filter((l) => lanes.includes(l.id) || l.id === task.lane).map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Assignee">
              <select className="select" value={task.assigneeId ?? ""} onChange={(e) => patch({ assigneeId: e.target.value || null })} disabled={pending}>
                <option value="">Unassigned</option>
                {people
                  .filter((p) => p.isActive || p.id === task.assigneeId)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.fullName}
                    </option>
                  ))}
              </select>
            </Field>
            <Field label="Due date">
              <input type="date" className="input" value={task.dueDate ?? ""} onChange={(e) => patch({ dueDate: e.target.value || null })} disabled={pending} />
            </Field>
            <Field label="Priority">
              <select className="select" value={task.priority} onChange={(e) => patch({ priority: e.target.value as typeof task.priority })} disabled={pending}>
                {PRIORITIES.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Title">
              <input className="input" defaultValue={task.title} onBlur={(e) => e.target.value.trim() !== task.title && patch({ title: e.target.value.trim() })} disabled={pending} />
            </Field>
          </div>

          <Field label="Details">
            <textarea
              className="textarea"
              defaultValue={task.description}
              onBlur={(e) => e.target.value !== task.description && patch({ description: e.target.value })}
              disabled={pending}
            />
          </Field>

          <section>
            <div className="mb-1.5 flex items-center justify-between">
              <span className="label mb-0">
                Checklist{task.checklist.length > 0 && ` · ${task.checklist.filter((i) => i.isDone).length}/${task.checklist.length}`}
              </span>
            </div>
            <ul className="divide-y divide-line rounded-md border border-line">
              {task.checklist.map((item) => (
                <li key={item.id} className="group flex items-center gap-2 px-2 py-1.5 text-sm">
                  <button
                    className={clsx(
                      "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                      item.isDone ? "border-ok bg-ok text-white" : "border-line-strong bg-surface hover:border-accent",
                    )}
                    onClick={() =>
                      start(async () => {
                        const res = await updateChecklistItem(item.id, { isDone: !item.isDone });
                        if (!res.ok) return toast.error(res.error);
                        refresh();
                      })
                    }
                    disabled={pending}
                    aria-label={item.isDone ? "Mark not done" : "Mark done"}
                  >
                    {item.isDone && <Check size={11} />}
                  </button>
                  <span className={clsx("flex-1", item.isDone && "text-muted line-through")}>{item.text}</span>
                  {item.assignee?.fullName && <span className="text-[11px] text-muted">{item.assignee.fullName}</span>}
                  {item.dueDate && <span className="text-[11px] text-muted">{fmtDate(item.dueDate, "M/d")}</span>}
                  <button
                    className="text-faint opacity-0 hover:text-bad group-hover:opacity-100"
                    onClick={() =>
                      start(async () => {
                        const res = await deleteChecklistItem(item.id);
                        if (!res.ok) return toast.error(res.error);
                        refresh();
                      })
                    }
                    aria-label="Delete item"
                  >
                    <Trash2 size={13} />
                  </button>
                </li>
              ))}
              <li className="flex items-center gap-2 px-2 py-1.5">
                <Plus size={14} className="text-faint" />
                <input
                  className="flex-1 bg-transparent text-sm outline-none placeholder:text-faint"
                  placeholder="Add an item and press Enter"
                  value={newItem}
                  onChange={(e) => setNewItem(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && newItem.trim()) {
                      e.preventDefault();
                      const text = newItem.trim();
                      setNewItem("");
                      start(async () => {
                        const res = await addChecklistItem(task.id, text);
                        if (!res.ok) return toast.error(res.error);
                        refresh();
                      });
                    }
                  }}
                  disabled={pending}
                />
              </li>
            </ul>
          </section>

          <section>
            <div className="mb-1.5 flex items-center justify-between">
              <span className="label mb-0">Sub-tasks{task.subtasks.length > 0 && ` · ${task.subtasks.length}`}</span>
              <button className="btn btn-sm" onClick={() => setSubtaskOpen(true)}>
                <Plus size={12} /> Sub-task
              </button>
            </div>
            {task.subtasks.length === 0 ? (
              <p className="text-xs text-faint">None. Use sub-tasks for things like individual accounts under an assets task.</p>
            ) : (
              <ul className="divide-y divide-line rounded-md border border-line text-sm">
                {task.subtasks.map((s) => {
                  const st = TASK_STATUSES.find((x) => x.id === s.status);
                  return (
                    <li key={s.id} className="flex items-center gap-2 px-2 py-1.5">
                      <span className="h-2 w-2 rounded-full" style={{ background: st?.color }} />
                      <button className="flex-1 text-left hover:underline" onClick={() => setOpenSubtaskId(s.id)}>
                        {s.title}
                      </button>
                      <span className="text-[11px] text-muted">{st?.label}</span>
                      {s.assignee?.fullName && <span className="text-[11px] text-muted">· {s.assignee.fullName}</span>}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section>
            <span className="label">Comments</span>
            <div className="grid gap-2">
              {task.comments.map((c) => (
                <div key={c.id} className="rounded-md bg-surface-2 px-3 py-2 text-sm">
                  <div className="mb-0.5 flex items-center justify-between text-[11px] text-muted">
                    <span className="font-semibold text-ink-2">{c.authorName}</span>
                    <span>{relTime(c.createdAt)}</span>
                  </div>
                  <p className="whitespace-pre-wrap">{c.body}</p>
                </div>
              ))}
              <div className="flex gap-2">
                <textarea className="textarea min-h-14 flex-1" placeholder="Add a comment…" value={comment} onChange={(e) => setComment(e.target.value)} disabled={pending} />
                <button
                  className="btn btn-primary self-end"
                  disabled={pending || !comment.trim()}
                  onClick={() =>
                    start(async () => {
                      const res = await addComment({ taskId: task.id, body: comment });
                      if (!res.ok) return toast.error(res.error);
                      setComment("");
                      refresh();
                    })
                  }
                >
                  Post
                </button>
              </div>
            </div>
          </section>

          <div className="flex items-center justify-between border-t border-line pt-3 text-[11px] text-faint">
            <span>
              Created {fmtDate(task.createdAt)} · Updated {relTime(task.updatedAt)}
            </span>
            {canDelete && (
              <button
                className="btn btn-sm btn-danger"
                disabled={pending}
                onClick={() => {
                  if (!confirm(`Delete task "${task.title}"? Sub-tasks are kept.`)) return;
                  start(async () => {
                    const res = await deleteTask(task.id);
                    if (!res.ok) return toast.error(res.error);
                    toast.notify("Task deleted.");
                    onClose();
                    router.refresh();
                  });
                }}
              >
                <Trash2 size={12} /> Delete
              </button>
            )}
          </div>
        </div>
      )}
      {task && (
        <NewTaskDialog
          open={subtaskOpen}
          onClose={() => setSubtaskOpen(false)}
          caseOptions={[{ id: task.case.id, title: task.case.title }]}
          defaultCaseId={task.case.id}
          parentTaskId={task.id}
          lanes={lanes}
          people={people}
          onCreated={() => refresh()}
        />
      )}
      {openSubtaskId && <TaskDrawer taskId={openSubtaskId} onClose={() => setOpenSubtaskId(null)} people={people} lanes={lanes} canDelete={canDelete} />}
    </Drawer>
  );
}
