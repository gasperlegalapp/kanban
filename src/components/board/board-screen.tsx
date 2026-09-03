"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { AlertTriangle, Briefcase, Eye, EyeOff, Plus, X } from "lucide-react";
import type { TaskLane } from "@/db/schema";
import type { BoardConfig, CaseSummary } from "@/lib/data/types";
import { moveCase, updateCase } from "@/lib/actions/cases";
import { updateTask } from "@/lib/actions/tasks";
import { BOARD_TASK_LANES } from "@/lib/domain/constants";
import { useToast } from "@/components/ui/toast";
import { CaseBoard, type CaseDrop } from "./case-board";
import { TaskBoard, type TaskDrop } from "./task-board";
import { FilterBar, EMPTY_FILTERS, type CaseFilters } from "./filter-bar";
import { SkipReasonModal, SKIP_REASON_MIN } from "./skip-reason-modal";
import { NewCaseDialog } from "@/components/cases/new-case-dialog";
import { NewTaskDialog } from "@/components/tasks/new-task-dialog";
import { TaskDrawer } from "@/components/tasks/task-drawer";

type PendingMove = { c: CaseSummary; stageId: string; laneId: string | null; backward: boolean };

export function BoardScreen({
  config,
  cases: initialCases,
  showClosed,
  isAttorney,
  initialCaseId,
}: {
  config: BoardConfig;
  cases: CaseSummary[];
  showClosed: boolean;
  isAttorney: boolean;
  initialCaseId: string | null;
}) {
  const router = useRouter();
  const toast = useToast();
  const [, start] = useTransition();
  const [cases, setCases] = useState(initialCases);
  // Adopt fresh server data after router.refresh() without an effect.
  const [seenInitial, setSeenInitial] = useState(initialCases);
  if (seenInitial !== initialCases) {
    setSeenInitial(initialCases);
    setCases(initialCases);
  }

  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(initialCaseId);
  const [filters, setFilters] = useState<CaseFilters>(EMPTY_FILTERS);
  const [pendingMove, setPendingMove] = useState<PendingMove | null>(null);
  const [newCaseOpen, setNewCaseOpen] = useState(false);
  const [newTaskOpen, setNewTaskOpen] = useState(false);
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  const [hideDone, setHideDone] = useState(true);

  const leaves = config.leafStages;
  const taskLanes: TaskLane[] = BOARD_TASK_LANES[config.board.id] ?? ["core", "assets", "litigation"];

  const filtered = useMemo(() => {
    const q = filters.search.trim().toLowerCase();
    return cases.filter((c) => {
      if (q && ![c.title, c.caseNumber, c.clientName, c.county, c.fiduciary].some((v) => v?.toLowerCase().includes(q))) return false;
      if (filters.ownerId && c.ownerId !== filters.ownerId) return false;
      if (filters.health && c.metrics.health !== filters.health) return false;
      if (filters.stuckDays && c.metrics.daysInStage < filters.stuckDays) return false;
      if (filters.caseTypeId && c.caseTypeId !== filters.caseTypeId) return false;
      if (filters.laneId && c.laneId !== filters.laneId) return false;
      return true;
    });
  }, [cases, filters]);

  const selected = selectedCaseId ? cases.find((c) => c.id === selectedCaseId) ?? null : null;
  const tasks = useMemo(() => {
    const source = selected ? [selected] : filtered;
    return source.flatMap((c) => c.tasks);
  }, [selected, filtered]);
  const caseTitleFor = (caseId: string) => cases.find((c) => c.id === caseId)?.title ?? null;

  const stats = useMemo(
    () => ({
      active: cases.filter((c) => c.status === "active").length,
      red: cases.filter((c) => c.metrics.health === "red").length,
      yellow: cases.filter((c) => c.metrics.health === "yellow").length,
      overdue: cases.reduce((n, c) => n + c.metrics.overdueTasks, 0),
      review: cases.reduce((n, c) => n + c.metrics.reviewTasks, 0),
    }),
    [cases],
  );

  function requestMove(c: CaseSummary, stageId: string, laneId: string | null) {
    const fromIdx = leaves.findIndex((s) => s.id === c.stageId);
    const toIdx = leaves.findIndex((s) => s.id === stageId);
    const target = leaves[toIdx];
    if (!target) return;
    if ((target.isClosed || target.isArchive) && !isAttorney) {
      toast.error("Only an attorney can close or archive a case.");
      return;
    }
    const stageChanged = stageId !== c.stageId;
    const isSkip = stageChanged && toIdx - fromIdx !== 1;
    if (isSkip) {
      setPendingMove({ c, stageId, laneId, backward: toIdx < fromIdx });
      return;
    }
    if ((target.isClosed || target.isArchive) && !confirm(`Move "${c.title}" to ${target.name}?`)) return;
    void performMove(c, stageId, laneId);
  }

  async function performMove(c: CaseSummary, stageId: string, laneId: string | null, reason?: string) {
    const stageChanged = stageId !== c.stageId;
    const laneChanged = (laneId ?? null) !== (c.laneId ?? null);
    const stage = leaves.find((s) => s.id === stageId)!;
    // Optimistic update
    setCases((prev) =>
      prev.map((x) =>
        x.id === c.id
          ? {
              ...x,
              stageId,
              stage,
              laneId,
              lane: config.lanes.find((l) => l.id === laneId) ?? null,
              stageEnteredAt: stageChanged ? new Date() : x.stageEnteredAt,
              metrics: stageChanged ? { ...x.metrics, daysInStage: 0 } : x.metrics,
            }
          : x,
      ),
    );
    start(async () => {
      if (stageChanged) {
        const res = await moveCase(c.id, stageId, reason);
        if (!res.ok) {
          toast.error(res.error);
          setCases(initialCases);
          return;
        }
      }
      if (laneChanged) {
        const res = await updateCase(c.id, { laneId });
        if (!res.ok) {
          toast.error(res.error);
          setCases(initialCases);
          return;
        }
      }
      router.refresh();
    });
  }

  function onCaseDrop(drop: CaseDrop) {
    const c = cases.find((x) => x.id === drop.caseId);
    if (c) requestMove(c, drop.stageId, drop.laneId);
  }

  function onAdvance(c: CaseSummary) {
    const i = leaves.findIndex((s) => s.id === c.stageId);
    const next = leaves[i + 1];
    if (next) requestMove(c, next.id, c.laneId ?? null);
  }

  function onTaskDrop(drop: TaskDrop) {
    setCases((prev) =>
      prev.map((c) => ({
        ...c,
        tasks: c.tasks.map((t) => (t.id === drop.taskId ? { ...t, status: drop.status, lane: drop.lane } : t)),
      })),
    );
    start(async () => {
      const res = await updateTask(drop.taskId, { status: drop.status, lane: drop.lane });
      if (!res.ok) {
        toast.error(res.error);
        setCases(initialCases);
        return;
      }
      router.refresh();
    });
  }

  const pendingFrom = pendingMove ? leaves.find((s) => s.id === pendingMove.c.stageId)?.name ?? "" : "";
  const pendingTo = pendingMove ? leaves.find((s) => s.id === pendingMove.stageId)?.name ?? "" : "";

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Case board */}
      <section className="flex min-h-0 flex-col border-b border-line" style={{ flexBasis: "56%" }}>
        <div className="flex flex-wrap items-center gap-3 px-4 pb-2 pt-3">
          <div className="flex items-center gap-2">
            <Briefcase size={16} className="text-brand" />
            <h1 className="text-base font-semibold">{config.board.name}</h1>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <StatPill label="Active" value={stats.active} />
            <StatPill label="Red" value={stats.red} tone={stats.red ? "bad" : undefined} />
            <StatPill label="Yellow" value={stats.yellow} tone={stats.yellow ? "warn" : undefined} />
            <StatPill label="Overdue tasks" value={stats.overdue} tone={stats.overdue ? "bad" : undefined} />
            <StatPill label="In review" value={stats.review} tone={stats.review ? "warn" : undefined} />
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Link href={showClosed ? `/boards/${config.board.id}` : `/boards/${config.board.id}?closed=1`} className="btn btn-sm">
              {showClosed ? <EyeOff size={12} /> : <Eye size={12} />}
              {showClosed ? "Hide closed" : "Show closed"}
            </Link>
            <button className="btn btn-primary btn-sm" onClick={() => setNewCaseOpen(true)}>
              <Plus size={12} /> New case
            </button>
          </div>
        </div>
        <div className="px-4 pb-2">
          <FilterBar config={config} filters={filters} onChange={setFilters} />
        </div>
        <div className="flex min-h-0 flex-1 flex-col px-4 pb-2">
          <CaseBoard config={config} cases={filtered} selectedCaseId={selectedCaseId} onSelect={setSelectedCaseId} onDrop={onCaseDrop} onAdvance={onAdvance} />
        </div>
      </section>

      {/* Task board */}
      <section className="flex min-h-0 flex-1 flex-col bg-canvas">
        <div className="flex flex-wrap items-center gap-3 px-4 pb-2 pt-2.5">
          <h2 className="text-sm font-semibold">
            {selected ? (
              <span className="flex items-center gap-2">
                Tasks · <span className="text-brand">{selected.title}</span>
                {selected.caseNumber && <span className="font-mono text-xs text-muted">{selected.caseNumber}</span>}
                <Link href={`/cases/${selected.id}`} className="text-xs font-normal text-accent hover:underline">
                  Open case
                </Link>
                <button className="btn btn-ghost btn-sm text-muted" onClick={() => setSelectedCaseId(null)}>
                  <X size={12} /> Clear
                </button>
              </span>
            ) : (
              <span className="text-muted">
                Tasks · all {filtered.length === cases.length ? "" : "filtered "}cases
                <span className="ml-2 text-xs font-normal text-faint">Click a case above to focus its tasks</span>
              </span>
            )}
          </h2>
          <div className="ml-auto flex items-center gap-2">
            <label className="flex items-center gap-1.5 text-xs text-muted">
              <input type="checkbox" checked={hideDone} onChange={(e) => setHideDone(e.target.checked)} /> Hide done
            </label>
            <button className="btn btn-sm" onClick={() => setNewTaskOpen(true)} disabled={cases.length === 0}>
              <Plus size={12} /> New task
            </button>
          </div>
        </div>
        <div className="flex min-h-0 flex-1 flex-col px-4 pb-3">
          <TaskBoard tasks={tasks} lanes={taskLanes} caseTitleFor={caseTitleFor} showCase={!selected} onOpen={setOpenTaskId} onDrop={onTaskDrop} hideDone={hideDone} />
        </div>
      </section>

      {pendingMove && (
        <SkipReasonModal
          open
          caseTitle={pendingMove.c.title}
          fromStage={pendingFrom}
          toStage={pendingTo}
          backward={pendingMove.backward}
          onClose={() => setPendingMove(null)}
          onConfirm={(reason) => {
            if (reason.length < SKIP_REASON_MIN) return;
            const m = pendingMove;
            setPendingMove(null);
            void performMove(m.c, m.stageId, m.laneId, reason);
          }}
        />
      )}
      <NewCaseDialog open={newCaseOpen} onClose={() => setNewCaseOpen(false)} config={config} />
      <NewTaskDialog
        open={newTaskOpen}
        onClose={() => setNewTaskOpen(false)}
        caseOptions={cases.map((c) => ({ id: c.id, title: c.caseNumber ? `${c.title} (${c.caseNumber})` : c.title }))}
        defaultCaseId={selectedCaseId}
        lanes={taskLanes}
        people={config.people}
      />
      <TaskDrawer taskId={openTaskId} onClose={() => setOpenTaskId(null)} people={config.people} lanes={taskLanes} canDelete />
      {cases.length === 0 && (
        <div className="pointer-events-none absolute inset-x-0 top-40 flex justify-center">
          <div className="pointer-events-auto card flex items-center gap-3 px-5 py-4 text-sm">
            <AlertTriangle size={16} className="text-warn" /> No cases yet.{" "}
            <button className="btn btn-primary btn-sm" onClick={() => setNewCaseOpen(true)}>
              Create the first case
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function StatPill({ label, value, tone }: { label: string; value: number; tone?: "bad" | "warn" }) {
  return (
    <span className={clsx("badge border border-line bg-surface text-muted", tone === "bad" && "border-bad/30 text-bad", tone === "warn" && "border-warn/40 text-amber-700")}>
      <span className="font-bold">{value}</span> {label}
    </span>
  );
}
