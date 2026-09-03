"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { ArrowLeft, CalendarPlus, Check, ExternalLink, Pencil, Plus, RefreshCw, Sparkles, Trash2 } from "lucide-react";
import type { CaseEvent, TaskLane } from "@/db/schema";
import type { BoardConfig, CaseDetail, TaskSummary } from "@/lib/data/types";
import { applyTemplateToCase, deleteCase, moveCase, recalculateDeadlines } from "@/lib/actions/cases";
import { addComment, deleteComment } from "@/lib/actions/comments";
import { updateEvent } from "@/lib/actions/events";
import { BOARD_TASK_LANES, HEALTH_COLORS, TASK_LANE_MAP, TASK_STATUS_MAP, WILL_STATUS_LABELS } from "@/lib/domain/constants";
import { dueLabel, fmtDate, relTime } from "@/lib/format";
import { useToast } from "@/components/ui/toast";
import { SkipReasonModal, SKIP_REASON_MIN } from "@/components/board/skip-reason-modal";
import { NewTaskDialog } from "@/components/tasks/new-task-dialog";
import { TaskDrawer } from "@/components/tasks/task-drawer";
import { ActivityTimeline } from "./activity-timeline";
import { AttachmentsPanel } from "./attachments-panel";
import { EditCaseDialog } from "./edit-case-dialog";
import { EventDialog } from "./event-dialog";
import { StageStepper } from "./stage-stepper";

export function CaseDetailScreen({ detail, config, isAttorney, currentUserId }: { detail: CaseDetail; config: BoardConfig; isAttorney: boolean; currentUserId: string }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const [editOpen, setEditOpen] = useState(false);
  const [taskOpen, setTaskOpen] = useState(false);
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  const [eventTarget, setEventTarget] = useState<CaseEvent | null | "new">(null);
  const [pendingStage, setPendingStage] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [showDone, setShowDone] = useState(false);
  const [templateId, setTemplateId] = useState("");

  const leaves = config.leafStages;
  const taskLanes = useMemo<TaskLane[]>(() => BOARD_TASK_LANES[config.board.id] ?? ["core", "assets", "litigation"], [config.board.id]);
  const m = detail.metrics;

  const tasksByLane = useMemo(() => {
    const groups = new Map<TaskLane, TaskSummary[]>();
    const roots = detail.tasks.filter((t) => !t.parentTaskId && (showDone || t.status !== "done"));
    for (const t of roots) {
      if (!groups.has(t.lane)) groups.set(t.lane, []);
      groups.get(t.lane)!.push(t);
    }
    return [...taskLanes, ...[...groups.keys()].filter((l) => !taskLanes.includes(l))].filter((l) => groups.has(l)).map((l) => [l, groups.get(l)!] as const);
  }, [detail.tasks, showDone, taskLanes]);

  function requestStage(stageId: string) {
    const fromIdx = leaves.findIndex((s) => s.id === detail.stageId);
    const toIdx = leaves.findIndex((s) => s.id === stageId);
    const target = leaves[toIdx];
    if (!target || stageId === detail.stageId) return;
    if ((target.isClosed || target.isArchive) && !isAttorney) return toast.error("Only an attorney can close or archive a case.");
    if (toIdx - fromIdx !== 1) return setPendingStage(stageId);
    if ((target.isClosed || target.isArchive) && !confirm(`Move this case to ${target.name}?`)) return;
    void doMove(stageId);
  }

  function doMove(stageId: string, reason?: string) {
    start(async () => {
      const res = await moveCase(detail.id, stageId, reason);
      if (!res.ok) return toast.error(res.error);
      toast.notify(`Moved to ${leaves.find((s) => s.id === stageId)?.name}.`);
      router.refresh();
    });
  }

  const pendingEvents = detail.events.filter((e) => e.status === "pending");
  const pastEvents = detail.events.filter((e) => e.status !== "pending");

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-7xl px-5 py-4">
        <Link href={`/boards/${detail.boardId}?case=${detail.id}`} className="mb-2 inline-flex items-center gap-1 text-xs text-muted hover:text-ink">
          <ArrowLeft size={12} /> {config.board.name}
        </Link>

        {/* Header */}
        <div className="card p-4">
          <div className="flex flex-wrap items-start gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-block h-3 w-3 rounded-full" style={{ background: HEALTH_COLORS[m.health] }} title={m.reasons.join("\n") || "On track"} />
                <h1 className="text-xl font-semibold">{detail.title}</h1>
                {detail.caseType && (
                  <span className="badge" style={{ background: detail.caseType.color + "22", color: detail.caseType.color }}>
                    {detail.caseType.name}
                  </span>
                )}
                {detail.status !== "active" && <span className="badge bg-surface-2 text-muted uppercase">{detail.status}</span>}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
                {detail.caseNumber && <span className="font-mono">{detail.caseNumber}</span>}
                {detail.county && <span>{detail.county} County</span>}
                {detail.lane && <span>{detail.lane.name}</span>}
                <span>
                  {detail.ownerName ?? "Unassigned"} · in {detail.stage.name} for {m.daysInStage} day{m.daysInStage === 1 ? "" : "s"}
                </span>
                {m.reasons.length > 0 && <span className={clsx("font-medium", m.health === "red" ? "text-bad" : "text-amber-700")}>{m.reasons.join(" · ")}</span>}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {detail.actionstepUrl && (
                <a href={detail.actionstepUrl} target="_blank" rel="noreferrer" className="btn btn-sm">
                  <ExternalLink size={12} /> Open in Actionstep
                </a>
              )}
              {detail.externalRef?.url && (
                <a href={detail.externalRef.url} target="_blank" rel="noreferrer" className="btn btn-sm text-muted" title="Original card in Businessmap">
                  Businessmap
                </a>
              )}
              <button className="btn btn-sm" onClick={() => setEditOpen(true)}>
                <Pencil size={12} /> Edit details
              </button>
              {isAttorney && (
                <button
                  className="btn btn-sm btn-danger"
                  disabled={pending}
                  onClick={() => {
                    if (!confirm(`Delete "${detail.title}" and all of its tasks? This cannot be undone.`)) return;
                    start(async () => {
                      const res = await deleteCase(detail.id);
                      if (!res.ok) return toast.error(res.error);
                      router.push(`/boards/${res.data.boardId}`);
                    });
                  }}
                >
                  <Trash2 size={12} />
                </button>
              )}
            </div>
          </div>
          <div className="mt-4">
            <StageStepper stageTree={config.stageTree} leaves={leaves} currentId={detail.stageId} onPick={requestStage} />
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-4">
          {/* Left column */}
          <div className="col-span-2 grid gap-4">
            {/* Tasks */}
            <section className="card p-4">
              <div className="mb-3 flex items-center gap-2">
                <h2 className="panel-title">Tasks</h2>
                <span className="text-xs text-muted">
                  {m.openTasks} open · {m.overdueTasks} overdue · {m.reviewTasks} in review
                </span>
                <label className="ml-auto flex items-center gap-1 text-xs text-muted">
                  <input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} /> Show done
                </label>
                <div className="flex items-center gap-1">
                  <select className="select h-7 w-auto text-xs" value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
                    <option value="">Add from template…</option>
                    {config.templateSets.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                  <button
                    className="btn btn-sm"
                    disabled={!templateId || pending}
                    onClick={() =>
                      start(async () => {
                        const res = await applyTemplateToCase(detail.id, templateId);
                        if (!res.ok) return toast.error(res.error);
                        toast.notify(`Added ${res.data.created} task${res.data.created === 1 ? "" : "s"}.`);
                        setTemplateId("");
                        router.refresh();
                      })
                    }
                  >
                    <Sparkles size={12} /> Apply
                  </button>
                </div>
                <button className="btn btn-primary btn-sm" onClick={() => setTaskOpen(true)}>
                  <Plus size={12} /> Task
                </button>
              </div>
              {tasksByLane.length === 0 ? (
                <p className="text-sm text-faint">No open tasks.</p>
              ) : (
                tasksByLane.map(([lane, list]) => (
                  <div key={lane} className="mb-3 last:mb-0">
                    <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-muted">{TASK_LANE_MAP.get(lane)?.label ?? lane}</div>
                    <ul className="divide-y divide-line rounded-md border border-line">
                      {list.map((t) => (
                        <TaskRow key={t.id} t={t} subtasks={detail.tasks.filter((s) => s.parentTaskId === t.id)} onOpen={setOpenTaskId} />
                      ))}
                    </ul>
                  </div>
                ))
              )}
            </section>

            {/* Deadlines & hearings */}
            <section className="card p-4">
              <div className="mb-3 flex items-center gap-2">
                <h2 className="panel-title">Hearings and deadlines</h2>
                <button
                  className="btn btn-ghost btn-sm ml-auto text-muted"
                  disabled={pending}
                  title="Recalculate rule-based deadlines from the appointment date"
                  onClick={() =>
                    start(async () => {
                      const res = await recalculateDeadlines(detail.id);
                      if (!res.ok) return toast.error(res.error);
                      toast.notify(res.data.created + res.data.updated ? `${res.data.created} added, ${res.data.updated} moved.` : "Deadlines are up to date.");
                      router.refresh();
                    })
                  }
                >
                  <RefreshCw size={12} /> Recalculate
                </button>
                <button className="btn btn-sm" onClick={() => setEventTarget("new")}>
                  <CalendarPlus size={12} /> Add
                </button>
              </div>
              {!detail.appointmentDate && <p className="mb-2 rounded bg-warn/10 px-2 py-1 text-xs text-amber-800">Set the appointment date in Edit details to generate statutory deadlines automatically.</p>}
              {pendingEvents.length === 0 && pastEvents.length === 0 ? (
                <p className="text-sm text-faint">Nothing scheduled.</p>
              ) : (
                <ul className="divide-y divide-line rounded-md border border-line">
                  {[...pendingEvents, ...pastEvents].map((e) => {
                    const due = dueLabel(e.date);
                    const done = e.status !== "pending";
                    return (
                      <li key={e.id} className={clsx("flex items-center gap-2 px-2 py-1.5 text-sm", done && "text-muted")}>
                        <button
                          className={clsx("flex h-4 w-4 items-center justify-center rounded border", done ? "border-ok bg-ok text-white" : "border-line-strong hover:border-accent")}
                          title={done ? "Mark pending" : "Mark done"}
                          disabled={pending}
                          onClick={() =>
                            start(async () => {
                              const res = await updateEvent(e.id, { status: done ? "pending" : "done" });
                              if (!res.ok) return toast.error(res.error);
                              router.refresh();
                            })
                          }
                        >
                          {done && <Check size={11} />}
                        </button>
                        <span className={clsx("badge", e.kind === "hearing" ? "bg-violet-100 text-violet-700" : "bg-red-50 text-red-700")}>{e.kind}</span>
                        <button className={clsx("flex-1 text-left hover:underline", done && "line-through")} onClick={() => setEventTarget(e)}>
                          {e.title}
                        </button>
                        <span className="font-mono text-xs">{fmtDate(e.date)}{e.time ? ` ${e.time}` : ""}</span>
                        {!done && due.text && (
                          <span className={clsx("rounded px-1 text-[11px] font-semibold", due.tone === "bad" && "bg-bad/10 text-bad", due.tone === "warn" && "bg-warn/15 text-amber-700", due.tone === "muted" && "text-faint font-normal")}>
                            {due.text}
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            {/* Comments */}
            <section className="card p-4">
              <h2 className="panel-title mb-3">Notes and comments</h2>
              {detail.description && <pre className="mb-3 whitespace-pre-wrap rounded-md bg-surface-2 p-3 font-sans text-sm leading-relaxed">{detail.description}</pre>}
              <div className="grid gap-2">
                {detail.comments
                  .filter((c) => !c.taskId)
                  .map((c) => (
                    <div key={c.id} className="group rounded-md border border-line px-3 py-2 text-sm">
                      <div className="mb-0.5 flex items-center justify-between text-[11px] text-muted">
                        <span className="font-semibold text-ink-2">{c.authorName}</span>
                        <span className="flex items-center gap-2">
                          {relTime(c.createdAt)}
                          {(c.authorId === currentUserId || isAttorney) && (
                            <button
                              className="text-faint opacity-0 hover:text-bad group-hover:opacity-100"
                              onClick={() =>
                                start(async () => {
                                  if (!confirm("Delete this comment?")) return;
                                  const res = await deleteComment(c.id);
                                  if (!res.ok) return toast.error(res.error);
                                  router.refresh();
                                })
                              }
                            >
                              <Trash2 size={12} />
                            </button>
                          )}
                        </span>
                      </div>
                      <p className="whitespace-pre-wrap">{c.body}</p>
                    </div>
                  ))}
                <div className="flex gap-2">
                  <textarea className="textarea min-h-16 flex-1" placeholder="Add a note for the team…" value={comment} onChange={(e) => setComment(e.target.value)} disabled={pending} />
                  <button
                    className="btn btn-primary self-end"
                    disabled={pending || !comment.trim()}
                    onClick={() =>
                      start(async () => {
                        const res = await addComment({ caseId: detail.id, body: comment });
                        if (!res.ok) return toast.error(res.error);
                        setComment("");
                        router.refresh();
                      })
                    }
                  >
                    Post
                  </button>
                </div>
              </div>
            </section>
          </div>

          {/* Right column */}
          <div className="grid content-start gap-4">
            <section className="card p-4">
              <h2 className="panel-title mb-3">Details</h2>
              <dl className="grid grid-cols-[110px_1fr] gap-y-1.5 text-sm">
                <Row k="Client">{detail.clientName}</Row>
                <Row k="Case number">{detail.caseNumber && <span className="font-mono">{detail.caseNumber}</span>}</Row>
                <Row k="County">{detail.county}</Row>
                <Row k="Court">{detail.court}</Row>
                {config.board.id === "probate" && (
                  <>
                    <Row k="Fiduciary">{detail.fiduciary}</Row>
                    <Row k="Will">{WILL_STATUS_LABELS[detail.willStatus]}</Row>
                    <Row k="Date of death">{fmtDate(detail.dateOfDeath)}</Row>
                  </>
                )}
                <Row k="Appointment">{fmtDate(detail.appointmentDate)}</Row>
                <Row k="Responsible">{detail.ownerName}</Row>
                <Row k="Opened">{fmtDate(detail.createdAt)}</Row>
                <Row k="Last activity">{relTime(detail.lastActivityAt)}</Row>
              </dl>
            </section>
            <section className="card p-4">
              <h2 className="panel-title mb-3">Files</h2>
              <AttachmentsPanel caseId={detail.id} items={detail.attachments} canDelete={(a) => a.uploadedBy === currentUserId || isAttorney} />
            </section>
            <section className="card p-4">
              <h2 className="panel-title mb-3">History</h2>
              <ActivityTimeline entries={detail.audit} />
            </section>
          </div>
        </div>
      </div>

      {pendingStage && (
        <SkipReasonModal
          open
          caseTitle={detail.title}
          fromStage={detail.stage.name}
          toStage={leaves.find((s) => s.id === pendingStage)?.name ?? ""}
          backward={leaves.findIndex((s) => s.id === pendingStage) < leaves.findIndex((s) => s.id === detail.stageId)}
          onClose={() => setPendingStage(null)}
          onConfirm={(reason) => {
            if (reason.length < SKIP_REASON_MIN) return;
            const s = pendingStage;
            setPendingStage(null);
            doMove(s, reason);
          }}
        />
      )}
      <EditCaseDialog open={editOpen} onClose={() => setEditOpen(false)} detail={detail} config={config} />
      <NewTaskDialog open={taskOpen} onClose={() => setTaskOpen(false)} caseOptions={[{ id: detail.id, title: detail.title }]} defaultCaseId={detail.id} lanes={taskLanes} people={config.people} />
      {eventTarget && <EventDialog open onClose={() => setEventTarget(null)} caseId={detail.id} event={eventTarget === "new" ? null : eventTarget} />}
      <TaskDrawer taskId={openTaskId} onClose={() => setOpenTaskId(null)} people={config.people} lanes={taskLanes} canDelete />
    </div>
  );
}

function Row({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="text-muted">{k}</dt>
      <dd className="min-w-0 truncate">{children || <span className="text-faint">—</span>}</dd>
    </>
  );
}

function TaskRow({ t, subtasks, onOpen }: { t: TaskSummary; subtasks: TaskSummary[]; onOpen: (id: string) => void }) {
  const st = TASK_STATUS_MAP.get(t.status)!;
  const due = dueLabel(t.dueDate);
  return (
    <li>
      <button className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-sm hover:bg-surface-2" onClick={() => onOpen(t.id)}>
        <span className="badge shrink-0" style={{ background: st.color + "22", color: st.color }}>
          {st.label}
        </span>
        <span className={clsx("min-w-0 flex-1 truncate", t.status === "done" && "text-muted line-through")}>{t.title}</span>
        {t.checklistTotal > 0 && (
          <span className={clsx("text-[11px]", t.checklistDone === t.checklistTotal ? "text-ok" : "text-muted")}>
            {t.checklistDone}/{t.checklistTotal}
          </span>
        )}
        <span className="w-24 truncate text-right text-[11px] text-muted">{t.assigneeName ?? ""}</span>
        {t.status !== "done" && due.text && (
          <span className={clsx("w-20 text-right text-[11px] font-semibold", due.tone === "bad" && "text-bad", due.tone === "warn" && "text-amber-700", due.tone === "muted" && "font-normal text-faint")}>
            {due.text}
          </span>
        )}
      </button>
      {subtasks.length > 0 && (
        <ul className="border-t border-dashed border-line bg-surface-2/60">
          {subtasks.map((s) => {
            const sst = TASK_STATUS_MAP.get(s.status)!;
            return (
              <li key={s.id}>
                <button className="flex w-full items-center gap-2 py-1 pl-8 pr-2 text-left text-xs hover:bg-surface-2" onClick={() => onOpen(s.id)}>
                  <span className="h-2 w-2 rounded-full" style={{ background: sst.color }} />
                  <span className={clsx("flex-1 truncate", s.status === "done" && "text-muted line-through")}>{s.title}</span>
                  <span className="text-muted">{sst.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </li>
  );
}
