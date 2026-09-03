"use client";

import { useMemo, useState } from "react";
import clsx from "clsx";
import { DndContext, DragOverlay, PointerSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent, type DragStartEvent } from "@dnd-kit/core";
import type { Lane, Stage } from "@/db/schema";
import type { BoardConfig, CaseSummary, StageNode } from "@/lib/data/types";
import { CaseCard } from "./case-card";

const NO_LANE = "none";

export type CaseDrop = { caseId: string; stageId: string; laneId: string | null };

export function CaseBoard({
  config,
  cases,
  selectedCaseId,
  onSelect,
  onDrop,
  onAdvance,
}: {
  config: BoardConfig;
  cases: CaseSummary[];
  selectedCaseId: string | null;
  onSelect: (id: string | null) => void;
  onDrop: (drop: CaseDrop) => void;
  onAdvance: (c: CaseSummary) => void;
}) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const leaves = config.leafStages;
  const hasUnlaned = cases.some((c) => !c.laneId);
  const laneRows: (Lane | null)[] = useMemo(
    () => [...config.lanes, ...(hasUnlaned || config.lanes.length === 0 ? [null] : [])],
    [config.lanes, hasUnlaned],
  );

  const byCell = useMemo(() => {
    const map = new Map<string, CaseSummary[]>();
    for (const c of cases) {
      const key = `${c.stageId}::${c.laneId ?? NO_LANE}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(c);
    }
    for (const list of map.values()) {
      list.sort((a, b) => rank(b) - rank(a) || b.metrics.daysInStage - a.metrics.daysInStage);
    }
    return map;
  }, [cases]);

  const countByStage = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of cases) m.set(c.stageId, (m.get(c.stageId) ?? 0) + 1);
    return m;
  }, [cases]);

  const active = activeId ? cases.find((c) => c.id === activeId) ?? null : null;

  function handleDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
  }
  function handleDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const over = e.over?.id;
    if (!over) return;
    const [stageId, laneKey] = String(over).split("::");
    const laneId = laneKey === NO_LANE ? null : laneKey;
    const c = cases.find((x) => x.id === e.active.id);
    if (!c) return;
    if (c.stageId === stageId && (c.laneId ?? null) === laneId) return;
    onDrop({ caseId: c.id, stageId, laneId });
  }

  const nextStageName = (c: CaseSummary): string | null => {
    const i = leaves.findIndex((s) => s.id === c.stageId);
    const next = leaves[i + 1];
    return next && !next.isArchive ? next.name : null;
  };

  const columnTemplate = `112px repeat(${leaves.length}, 236px)`;

  return (
    <DndContext id="case-board" sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="min-h-0 flex-1 overflow-auto">
        <div className="grid min-w-max gap-x-1.5" style={{ gridTemplateColumns: columnTemplate }}>
          {/* Row 1: phase groups */}
          <div className="sticky left-0 top-0 z-30 bg-canvas" />
          {config.stageTree.map((node) => (
            <GroupHeader key={node.id} node={node} />
          ))}

          {/* Row 2: stages */}
          <div className="sticky left-0 top-8 z-30 bg-canvas" />
          {leaves.map((s) => (
            <StageHeader key={s.id} stage={s} count={countByStage.get(s.id) ?? 0} />
          ))}

          {/* Lane rows */}
          {laneRows.map((lane) => (
            <LaneRow
              key={lane?.id ?? NO_LANE}
              lane={lane}
              leaves={leaves}
              cellCases={(stageId) => byCell.get(`${stageId}::${lane?.id ?? NO_LANE}`) ?? []}
              selectedCaseId={selectedCaseId}
              onSelect={onSelect}
              onAdvance={onAdvance}
              nextStageName={nextStageName}
              activeId={activeId}
              showLabel={config.lanes.length > 0}
            />
          ))}
        </div>
      </div>
      <DragOverlay dropAnimation={null}>
        {active ? (
          <div className="w-[228px] rotate-1">
            <CaseCard c={active} selected={false} nextStageName={null} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

function rank(c: CaseSummary): number {
  return c.metrics.health === "red" ? 2 : c.metrics.health === "yellow" ? 1 : 0;
}

function GroupHeader({ node }: { node: StageNode }) {
  const span = Math.max(1, node.children.length);
  const isGroup = node.children.length > 0;
  return (
    <div className="sticky top-0 z-20 h-8 bg-canvas pb-1" style={{ gridColumn: `span ${span}` }}>
      {isGroup ? (
        <div className="flex h-full items-center justify-center rounded-md bg-brand/90 px-2 text-[11px] font-bold uppercase tracking-wider text-white/90">
          {node.name}
        </div>
      ) : (
        <div className="h-full" />
      )}
    </div>
  );
}

function StageHeader({ stage, count }: { stage: Stage; count: number }) {
  return (
    <div className="sticky top-8 z-20 bg-canvas pb-1.5">
      <div
        className={clsx(
          "flex items-center justify-between rounded-md border border-line bg-surface px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wider",
          stage.isClosed && "text-ok",
          stage.isArchive && "text-faint",
        )}
        title={stage.policy ?? undefined}
      >
        <span className="truncate">{stage.name}</span>
        <span className="ml-2 rounded-full bg-surface-2 px-1.5 py-px text-[10px] text-muted">{count}</span>
      </div>
    </div>
  );
}

function LaneRow({
  lane,
  leaves,
  cellCases,
  selectedCaseId,
  onSelect,
  onAdvance,
  nextStageName,
  activeId,
  showLabel,
}: {
  lane: Lane | null;
  leaves: Stage[];
  cellCases: (stageId: string) => CaseSummary[];
  selectedCaseId: string | null;
  onSelect: (id: string | null) => void;
  onAdvance: (c: CaseSummary) => void;
  nextStageName: (c: CaseSummary) => string | null;
  activeId: string | null;
  showLabel: boolean;
}) {
  return (
    <>
      <div className="sticky left-0 z-10 flex items-start bg-canvas pr-1.5 pt-1">
        {showLabel && (
          <div className="flex min-h-24 w-full items-center justify-center rounded-md border border-line bg-surface-2 px-1 py-2 text-center text-[11px] font-bold uppercase tracking-wider text-muted [writing-mode:vertical-rl] rotate-180">
            {lane?.name ?? "No lane"}
          </div>
        )}
      </div>
      {leaves.map((s) => (
        <DropCell key={s.id} id={`${s.id}::${lane?.id ?? NO_LANE}`} closed={s.isClosed || s.isArchive}>
          {cellCases(s.id).map((c) => (
            <DraggableCase key={c.id} c={c} dragging={activeId === c.id}>
              <CaseCard
                c={c}
                selected={selectedCaseId === c.id}
                nextStageName={nextStageName(c)}
                onSelect={() => onSelect(selectedCaseId === c.id ? null : c.id)}
                onAdvance={() => onAdvance(c)}
                dragging={activeId === c.id}
              />
            </DraggableCase>
          ))}
        </DropCell>
      ))}
    </>
  );
}

function DropCell({ id, closed, children }: { id: string; closed: boolean; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className={clsx(
        "mb-1.5 flex min-h-24 flex-col gap-1.5 rounded-md border border-dashed border-transparent p-1.5 transition",
        closed ? "bg-black/[0.03]" : "bg-black/[0.02]",
        isOver && "drop-target",
      )}
    >
      {children}
    </div>
  );
}

function DraggableCase({ c, dragging, children }: { c: CaseSummary; dragging: boolean; children: React.ReactNode }) {
  const { setNodeRef, attributes, listeners } = useDraggable({ id: c.id });
  return (
    <div ref={setNodeRef} {...attributes} {...listeners} className={clsx(dragging && "invisible")}>
      {children}
    </div>
  );
}
