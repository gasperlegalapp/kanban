"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { ArrowDown, ArrowUp, CalendarClock, Columns3, List, Pencil, Plus, Repeat, Sparkles, Trash2, User } from "lucide-react";
import type { Board, DeadlineAnchor, TaskLane, TemplateRepeat, TemplateSet, TemplateTask } from "@/db/schema";
import type { PersonLite } from "@/lib/data/types";
import { Modal } from "@/components/ui/modal";
import { Field } from "@/components/ui/fields";
import { useToast } from "@/components/ui/toast";
import {
  createTemplateSet,
  createTemplateTask,
  deleteTemplateSet,
  deleteTemplateTask,
  ensureStageTemplateSet,
  moveTemplateTask,
  updateTemplateSet,
  updateTemplateTask,
} from "@/lib/actions/templates";
import { BOARD_TASK_LANES, TASK_LANES, TASK_LANE_MAP } from "@/lib/domain/constants";

type SetWithTasks = TemplateSet & { tasks: TemplateTask[] };
type StageOption = { id: string; name: string; group: string | null };
type Result = { ok: boolean; error?: string };

const ANCHOR_LABELS: Record<DeadlineAnchor, string> = {
  appointment_date: "Appointment date",
  date_of_death: "Date of death",
  case_opened: "Case opened",
};

/** Due-date choice in the task dialog: "created" = the day the tasks are created. */
type DueChoice = "" | "created" | DeadlineAnchor;

type TaskInput = {
  title: string;
  description: string;
  lane: TaskLane;
  checklist: string[];
  dueAnchor: DeadlineAnchor | null;
  dueFromCreation: boolean;
  dueOffsetDays: number | null;
  assigneeId: string | null;
  assignToOwner: boolean;
};

const REPEAT_LABELS: Record<TemplateRepeat, { short: string; long: string }> = {
  once: { short: "Once per case", long: "Only the first time a case enters. Moving out and back in adds nothing." },
  every_time: { short: "Every time", long: "Each time a case enters. Tasks still open from last time are not doubled." },
};

export function TemplatesScreen({
  boards,
  sets,
  stagesByBoard,
  people,
}: {
  boards: Board[];
  sets: SetWithTasks[];
  stagesByBoard: Record<string, StageOption[]>;
  people: PersonLite[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const [boardId, setBoardId] = useState(boards[0]?.id ?? "probate");
  const [view, setView] = useState<"columns" | "sets">("columns");
  const [setDialog, setSetDialog] = useState<SetWithTasks | "new" | null>(null);
  // `setId` null + `stageId` = first task for a column that has no set yet.
  const [taskDialog, setTaskDialog] = useState<{ setId: string | null; stageId?: string; task: TemplateTask | null; heading: string } | null>(null);

  const stages = stagesByBoard[boardId] ?? [];
  const visible = sets.filter((s) => s.boardId === boardId);
  const peopleById = new Map(people.map((p) => [p.id, p]));

  const run = (fn: () => Promise<Result>, okMsg?: string) =>
    start(async () => {
      const res = await fn();
      if (!res.ok) return toast.error(res.error ?? "Failed");
      if (okMsg) toast.notify(okMsg);
      router.refresh();
    });

  const saveTask = (input: TaskInput) => {
    const d = taskDialog!;
    run(async () => {
      if (d.task) return updateTemplateTask(d.task.id, input);
      let setId = d.setId;
      if (!setId) {
        const res = await ensureStageTemplateSet(d.stageId!);
        if (!res.ok) return res;
        setId = res.data.id;
      }
      return createTemplateTask({ setId, ...input });
    }, "Saved.");
  };

  const rowProps = {
    pending,
    peopleById,
    onEdit: (set: SetWithTasks, task: TemplateTask) => setTaskDialog({ setId: set.id, task, heading: set.name }),
    onDelete: (t: TemplateTask) => confirm(`Remove "${t.title}" from the template?`) && run(() => deleteTemplateTask(t.id)),
    onMove: (t: TemplateTask, dir: "up" | "down") => run(() => moveTemplateTask(t.id, dir)),
  };

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-5xl px-5 py-4">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <h1 className="text-lg font-semibold">Task templates</h1>
          <Segmented value={boardId} onChange={setBoardId} options={boards.map((b) => ({ value: b.id, label: b.name }))} />
          <Segmented
            value={view}
            onChange={(v) => setView(v as "columns" | "sets")}
            options={[
              { value: "columns", label: "By column", icon: <Columns3 size={12} /> },
              { value: "sets", label: "All template sets", icon: <List size={12} /> },
            ]}
          />
          <button className="btn btn-primary btn-sm ml-auto" onClick={() => setSetDialog("new")}>
            <Plus size={12} /> New template set
          </button>
        </div>

        {view === "columns" ? (
          <>
            <p className="mb-4 text-sm text-muted">
              The tasks each column creates automatically when a case enters it. Each column can create its tasks once per case, or every time a case enters.
            </p>
            <div className="grid gap-3">
              <ColumnSection
                title="Every new case"
                subtitle="Created when a case is added to the board"
                sets={visible.filter((s) => s.applyOnCreate)}
                onAdd={(set) => (set ? setTaskDialog({ setId: set.id, task: null, heading: set.name }) : setSetDialog("new"))}
                addLabel="New set for new cases"
                onRepeat={null}
                rowProps={rowProps}
              />
              {stages.map((st, i) => {
                const stageSets = visible.filter((s) => s.triggerStageId === st.id);
                const showGroup = st.group && st.group !== stages[i - 1]?.group;
                return (
                  <div key={st.id} className="grid gap-3">
                    {showGroup && <h2 className="mt-2 text-[11px] font-bold uppercase tracking-wider text-muted">{st.group}</h2>}
                    <ColumnSection
                      title={st.name}
                      subtitle="When a case enters this column"
                      sets={stageSets}
                      onAdd={(set) => setTaskDialog({ setId: set?.id ?? null, stageId: st.id, task: null, heading: set?.name ?? st.name })}
                      addLabel="Add task"
                      onRepeat={(set, repeat) => run(() => updateTemplateSet(set.id, { repeat }), repeat === "once" ? "Tasks will be created once per case." : "Tasks will be created every time.")}
                      rowProps={rowProps}
                    />
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <>
            <p className="mb-4 text-sm text-muted">
              A template set is a bundle of tasks with checklists. A set can be created automatically on every new case, whenever a case enters a particular column, or added to a
              case by hand from its page.
            </p>
            {visible.length === 0 && <p className="text-sm text-faint">No templates for this board yet.</p>}
            <div className="grid gap-4">
              {visible.map((set) => (
                <section key={set.id} className="card">
                  <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-2.5">
                    <h2 className="font-semibold">{set.name}</h2>
                    {set.applyOnCreate && (
                      <span className="badge bg-brand-soft text-brand">
                        <Sparkles size={10} /> every new case
                      </span>
                    )}
                    {set.triggerStageId && (
                      <span className="badge bg-brand-soft text-brand">
                        <Sparkles size={10} /> when a case enters {stages.find((st) => st.id === set.triggerStageId)?.name ?? "a column"}
                      </span>
                    )}
                    {(set.applyOnCreate || set.triggerStageId) && (
                      <span className="badge bg-surface-2 text-muted">
                        <Repeat size={10} /> {REPEAT_LABELS[set.repeat].short.toLowerCase()}
                      </span>
                    )}
                    <span className="text-xs text-muted">{set.tasks.length} tasks</span>
                    <div className="ml-auto flex items-center gap-1">
                      <button className="btn btn-sm" onClick={() => setTaskDialog({ setId: set.id, task: null, heading: set.name })}>
                        <Plus size={12} /> Task
                      </button>
                      <button className="btn btn-ghost btn-sm" onClick={() => setSetDialog(set)} aria-label="Edit set">
                        <Pencil size={12} />
                      </button>
                      <button
                        className="btn btn-ghost btn-sm text-bad"
                        disabled={pending}
                        onClick={() => confirm(`Delete template set "${set.name}"?`) && run(() => deleteTemplateSet(set.id), "Template set deleted.")}
                        aria-label="Delete set"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                  {set.description && <p className="px-4 pt-2 text-xs text-muted">{set.description}</p>}
                  <TaskList set={set} {...rowProps} />
                </section>
              ))}
            </div>
          </>
        )}
      </div>

      {setDialog && (
        <SetDialog
          boardId={boardId}
          stages={stages}
          set={setDialog === "new" ? null : setDialog}
          onClose={() => setSetDialog(null)}
          onSave={(input) => run(() => (setDialog === "new" ? createTemplateSet({ boardId, ...input }) : updateTemplateSet(setDialog.id, input)), "Saved.")}
        />
      )}
      {taskDialog && (
        <TaskDialog boardId={boardId} heading={taskDialog.heading} task={taskDialog.task} people={people} onClose={() => setTaskDialog(null)} onSave={saveTask} />
      )}
    </div>
  );
}

function Segmented({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { value: string; label: string; icon?: React.ReactNode }[] }) {
  return (
    <div className="flex rounded-md border border-line bg-surface p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          className={clsx("flex items-center gap-1.5 rounded px-3 py-1 text-sm", value === o.value ? "bg-brand text-white" : "text-muted hover:text-ink")}
          onClick={() => onChange(o.value)}
        >
          {o.icon}
          {o.label}
        </button>
      ))}
    </div>
  );
}

type RowProps = {
  pending: boolean;
  peopleById: Map<string, PersonLite>;
  onEdit: (set: SetWithTasks, task: TemplateTask) => void;
  onDelete: (t: TemplateTask) => void;
  onMove: (t: TemplateTask, dir: "up" | "down") => void;
};

/** One column (or "every new case") and the tasks it creates. */
function ColumnSection({
  title,
  subtitle,
  sets,
  onAdd,
  addLabel,
  onRepeat,
  rowProps,
}: {
  title: string;
  subtitle: string;
  sets: SetWithTasks[];
  onAdd: (set: SetWithTasks | null) => void;
  addLabel: string;
  /** Null hides the once/every-time switch (new cases only happen once). */
  onRepeat: ((set: SetWithTasks, repeat: TemplateRepeat) => void) | null;
  rowProps: RowProps;
}) {
  const count = sets.reduce((n, s) => n + s.tasks.length, 0);
  return (
    <section className="card overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b border-line bg-surface-2 px-4 py-2">
        <h3 className="font-semibold">{title}</h3>
        <span className="text-xs text-muted">{subtitle}</span>
        <span className={clsx("rounded-full px-1.5 text-[10px] font-semibold", count ? "bg-brand-soft text-brand" : "bg-surface text-faint")}>
          {count} task{count === 1 ? "" : "s"}
        </span>
        {sets.length <= 1 && (
          <button className="btn btn-sm ml-auto" onClick={() => onAdd(sets[0] ?? null)}>
            <Plus size={12} /> {sets[0] ? "Add task" : addLabel}
          </button>
        )}
      </div>
      {sets.length === 0 ? (
        <p className="px-4 py-3 text-sm text-faint">No automatic tasks.</p>
      ) : (
        sets.map((set) => (
          <div key={set.id} className="border-b border-line last:border-b-0">
            {(sets.length > 1 || onRepeat) && (
              <div className="flex flex-wrap items-center gap-2 px-4 pt-2">
                {sets.length > 1 && <span className="text-xs font-semibold text-ink-2">{set.name}</span>}
                {onRepeat && <RepeatSwitch value={set.repeat} disabled={rowProps.pending} onChange={(r) => onRepeat(set, r)} />}
                {sets.length > 1 && (
                  <button className="btn btn-sm ml-auto" onClick={() => onAdd(set)}>
                    <Plus size={12} /> Add task
                  </button>
                )}
              </div>
            )}
            {set.tasks.length === 0 ? <p className="px-4 py-3 text-sm text-faint">No tasks in this set yet.</p> : <TaskList set={set} {...rowProps} />}
          </div>
        ))
      )}
    </section>
  );
}

function RepeatSwitch({ value, onChange, disabled }: { value: TemplateRepeat; onChange: (r: TemplateRepeat) => void; disabled: boolean }) {
  return (
    <div className="flex items-center gap-1.5 text-xs text-muted">
      <Repeat size={11} /> Create tasks:
      <div className="flex rounded border border-line bg-surface p-px">
        {(["once", "every_time"] as const).map((r) => (
          <button
            key={r}
            type="button"
            disabled={disabled}
            title={REPEAT_LABELS[r].long}
            onClick={() => r !== value && onChange(r)}
            className={clsx("rounded-sm px-2 py-0.5 text-[11px] font-medium", value === r ? "bg-brand text-white" : "text-muted hover:text-ink")}
          >
            {REPEAT_LABELS[r].short}
          </button>
        ))}
      </div>
    </div>
  );
}

function TaskList({ set, pending, peopleById, onEdit, onDelete, onMove }: { set: SetWithTasks } & RowProps) {
  return (
    <ul className="divide-y divide-line">
      {set.tasks.map((t, i) => (
        <li key={t.id} className="flex items-start gap-3 px-4 py-2.5">
          <div className="flex flex-col gap-0.5 pt-0.5">
            <button className="text-faint hover:text-ink disabled:opacity-30" disabled={i === 0 || pending} onClick={() => onMove(t, "up")} aria-label="Move up">
              <ArrowUp size={12} />
            </button>
            <button className="text-faint hover:text-ink disabled:opacity-30" disabled={i === set.tasks.length - 1 || pending} onClick={() => onMove(t, "down")} aria-label="Move down">
              <ArrowDown size={12} />
            </button>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{t.title}</span>
              <span className="badge bg-surface-2 text-muted">{TASK_LANE_MAP.get(t.lane)?.label}</span>
              <span className={clsx("badge", t.assignToOwner || t.assigneeId ? "bg-brand-soft text-brand" : "bg-surface-2 text-faint")}>
                <User size={10} /> {assigneeLabel(t, peopleById)}
              </span>
              {dueLabel(t) && (
                <span className="badge bg-surface-2 text-muted">
                  <CalendarClock size={10} /> {dueLabel(t)}
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
            <button className="btn btn-ghost btn-sm" onClick={() => onEdit(set, t)} aria-label="Edit task">
              <Pencil size={12} />
            </button>
            <button className="btn btn-ghost btn-sm text-bad" disabled={pending} onClick={() => onDelete(t)} aria-label="Remove task">
              <Trash2 size={12} />
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}

function assigneeLabel(t: TemplateTask, peopleById: Map<string, PersonLite>): string {
  if (t.assignToOwner) return "Case owner";
  if (t.assigneeId) return peopleById.get(t.assigneeId)?.fullName ?? "Former staff";
  return "Unassigned";
}

function dueLabel(t: TemplateTask): string | null {
  const n = t.dueOffsetDays ?? 0;
  const days = `${n} day${Math.abs(n) === 1 ? "" : "s"}`;
  if (t.dueFromCreation) return `due ${days} after created`;
  if (t.dueAnchor) return `due ${days} after ${ANCHOR_LABELS[t.dueAnchor].toLowerCase()}`;
  return null;
}

function SetDialog({
  boardId,
  stages,
  set,
  onClose,
  onSave,
}: {
  boardId: string;
  stages: StageOption[];
  set: SetWithTasks | null;
  onClose: () => void;
  onSave: (i: { name: string; description: string; applyOnCreate: boolean; triggerStageId: string | null; repeat: TemplateRepeat }) => void;
}) {
  return (
    <Modal open onClose={onClose} title={set ? "Edit template set" : `New template set (${boardId})`}>
      <form
        action={(fd) => {
          onSave({
            name: String(fd.get("name") ?? ""),
            description: String(fd.get("description") ?? ""),
            applyOnCreate: fd.get("applyOnCreate") === "on",
            triggerStageId: String(fd.get("triggerStageId") ?? "") || null,
            repeat: (String(fd.get("repeat") ?? "once") as TemplateRepeat) || "once",
          });
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
        <Field label="Also create them when a case enters">
          <select name="triggerStageId" className="select" defaultValue={set?.triggerStageId ?? ""}>
            <option value="">No column (manual or new case only)</option>
            {stages.map((st) => (
              <option key={st.id} value={st.id}>
                {st.group ? `${st.group} › ` : ""}
                {st.name}
              </option>
            ))}
          </select>
        </Field>
        <fieldset className="grid gap-1.5">
          <legend className="mb-1 text-xs font-medium text-muted">How often</legend>
          {(["once", "every_time"] as const).map((r) => (
            <label key={r} className="flex items-start gap-2 text-sm">
              <input type="radio" name="repeat" value={r} defaultChecked={(set?.repeat ?? "once") === r} className="mt-1" />
              <span>
                <span className="font-medium">{REPEAT_LABELS[r].short}</span>
                <span className="block text-xs text-muted">{REPEAT_LABELS[r].long}</span>
              </span>
            </label>
          ))}
        </fieldset>
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
  heading,
  task,
  people,
  onClose,
  onSave,
}: {
  boardId: string;
  heading: string;
  task: TemplateTask | null;
  people: PersonLite[];
  onClose: () => void;
  onSave: (i: TaskInput) => void;
}) {
  const lanes = BOARD_TASK_LANES[boardId] ?? ["core", "assets", "litigation"];
  const initialDue: DueChoice = task?.dueFromCreation ? "created" : (task?.dueAnchor ?? "");
  const [due, setDue] = useState<DueChoice>(initialDue);
  const initialAssign = task?.assignToOwner ? "owner" : (task?.assigneeId ?? "");
  return (
    <Modal open onClose={onClose} title={`${task ? "Edit task" : "New task"} · ${heading}`} width="max-w-xl">
      <form
        action={(fd) => {
          const assign = String(fd.get("assign") ?? "");
          onSave({
            title: String(fd.get("title") ?? ""),
            description: String(fd.get("description") ?? ""),
            lane: String(fd.get("lane") ?? "core") as TaskLane,
            checklist: String(fd.get("checklist") ?? "")
              .split("\n")
              .map((s) => s.trim())
              .filter(Boolean),
            dueFromCreation: due === "created",
            dueAnchor: due && due !== "created" ? due : null,
            dueOffsetDays: due ? Number(fd.get("dueOffsetDays") ?? 0) : null,
            assignToOwner: assign === "owner",
            assigneeId: assign && assign !== "owner" ? assign : null,
          });
          onClose();
        }}
        className="grid grid-cols-2 gap-3"
      >
        <Field label="Title" className="col-span-2">
          <input name="title" className="input" defaultValue={task?.title ?? ""} required autoFocus />
        </Field>
        <Field label="Assign to">
          <select name="assign" className="select" defaultValue={initialAssign}>
            <option value="">Unassigned</option>
            <option value="owner">Case owner (responsible attorney or staff)</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.fullName}
              </option>
            ))}
          </select>
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
        <Field label="Due">
          <select className="select" value={due} onChange={(e) => setDue(e.target.value as DueChoice)}>
            <option value="">No due date</option>
            <option value="created">Days after the task is created</option>
            {Object.entries(ANCHOR_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                Days after {v.toLowerCase()}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Days" hint={due === "created" ? "Counted from the day the case enters the column." : undefined}>
          <input name="dueOffsetDays" type="number" className="input" defaultValue={task?.dueOffsetDays ?? 7} disabled={!due} />
        </Field>
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
