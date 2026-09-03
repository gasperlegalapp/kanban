"use client";

import { useMemo, useState } from "react";
import clsx from "clsx";
import { DndContext, DragOverlay, PointerSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent, type DragStartEvent } from "@dnd-kit/core";
import type { TaskLane, TaskStatus } from "@/db/schema";
import type { TaskSummary } from "@/lib/data/types";
import { TASK_LANE_MAP, TASK_STATUSES } from "@/lib/domain/constants";
import { TaskCard } from "./task-card";

export type TaskDrop = { taskId: string; status: TaskStatus; lane: TaskLane };

export function TaskBoard({
  tasks,
  lanes,
  caseTitleFor,
  showCase,
  onOpen,
  onDrop,
  hideDone,
}: {
  tasks: TaskSummary[];
  lanes: TaskLane[];
  caseTitleFor: (caseId: string) => string | null;
  showCase: boolean;
  onOpen: (taskId: string) => void;
  onDrop: (drop: TaskDrop) => void;
  hideDone?: boolean;
}) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const statuses = TASK_STATUSES;

  const visibleLanes = useMemo(() => {
    const used = new Set(tasks.map((t) => t.lane));
    const base = lanes.filter((l) => used.has(l) || true);
    for (const l of used) if (!base.includes(l)) base.push(l);
    return base;
  }, [lanes, tasks]);

  const byCell = useMemo(() => {
    const m = new Map<string, TaskSummary[]>();
    for (const t of tasks) {
      const key = `${t.status}::${t.lane}`;
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(t);
    }
    return m;
  }, [tasks]);

  const countByStatus = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of tasks) m.set(t.status, (m.get(t.status) ?? 0) + 1);
    return m;
  }, [tasks]);

  const active = activeId ? tasks.find((t) => t.id === activeId) ?? null : null;

  function handleDragEnd(e: DragEndEvent) {
    setActiveId(null);
    if (!e.over) return;
    const [status, lane] = String(e.over.id).split("::") as [TaskStatus, TaskLane];
    const t = tasks.find((x) => x.id === e.active.id);
    if (!t || (t.status === status && t.lane === lane)) return;
    onDrop({ taskId: t.id, status, lane });
  }

  const cols = hideDone ? statuses.filter((s) => s.id !== "done") : statuses;
  const template = `96px repeat(${cols.length}, minmax(200px, 1fr))`;

  return (
    <DndContext id="task-board" sensors={sensors} onDragStart={(e: DragStartEvent) => setActiveId(String(e.active.id))} onDragEnd={handleDragEnd}>
      <div className="min-h-0 flex-1 overflow-auto">
        <div className="grid min-w-max gap-x-1.5" style={{ gridTemplateColumns: template }}>
          <div className="sticky left-0 top-0 z-30 bg-canvas" />
          {cols.map((s) => (
            <div key={s.id} className="sticky top-0 z-20 bg-canvas pb-1.5">
              <div className="flex items-center justify-between rounded-md border border-line bg-surface px-2.5 py-1.5" title={s.hint}>
                <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider">
                  <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
                  {s.label}
                </span>
                <span className="rounded-full bg-surface-2 px-1.5 py-px text-[10px] text-muted">{countByStatus.get(s.id) ?? 0}</span>
              </div>
            </div>
          ))}

          {visibleLanes.map((lane) => (
            <LaneRow key={lane} lane={lane}>
              {cols.map((s) => (
                <DropCell key={s.id} id={`${s.id}::${lane}`}>
                  {(byCell.get(`${s.id}::${lane}`) ?? []).map((t) => (
                    <DraggableTask key={t.id} id={t.id} dragging={activeId === t.id}>
                      <TaskCard t={t} caseTitle={showCase ? caseTitleFor(t.caseId) : null} onOpen={() => onOpen(t.id)} dragging={activeId === t.id} />
                    </DraggableTask>
                  ))}
                </DropCell>
              ))}
            </LaneRow>
          ))}
        </div>
      </div>
      <DragOverlay dropAnimation={null}>
        {active ? (
          <div className="w-[220px] rotate-1">
            <TaskCard t={active} caseTitle={showCase ? caseTitleFor(active.caseId) : null} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

function LaneRow({ lane, children }: { lane: TaskLane; children: React.ReactNode }) {
  const meta = TASK_LANE_MAP.get(lane);
  return (
    <>
      <div className="sticky left-0 z-10 bg-canvas pr-1.5 pt-1">
        <div
          className="flex min-h-20 w-full items-center justify-center rounded-md border border-line bg-surface-2 px-1 py-2 text-center text-[10px] font-bold uppercase tracking-wider text-muted [writing-mode:vertical-rl] rotate-180"
          title={meta?.hint}
        >
          {meta?.label ?? lane}
        </div>
      </div>
      {children}
    </>
  );
}

function DropCell({ id, children }: { id: string; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div ref={setNodeRef} className={clsx("mb-1.5 flex min-h-20 flex-col gap-1.5 rounded-md border border-dashed border-transparent bg-black/[0.02] p-1.5", isOver && "drop-target")}>
      {children}
    </div>
  );
}

function DraggableTask({ id, dragging, children }: { id: string; dragging: boolean; children: React.ReactNode }) {
  const { setNodeRef, attributes, listeners } = useDraggable({ id });
  return (
    <div ref={setNodeRef} {...attributes} {...listeners} className={clsx(dragging && "invisible")}>
      {children}
    </div>
  );
}
