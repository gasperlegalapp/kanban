"use client";

import clsx from "clsx";
import type { Stage } from "@/db/schema";
import type { StageNode } from "@/lib/data/types";

export function StageStepper({
  stageTree,
  leaves,
  currentId,
  onPick,
}: {
  stageTree: StageNode[];
  leaves: Stage[];
  currentId: string;
  onPick?: (stageId: string) => void;
}) {
  const currentIdx = leaves.findIndex((s) => s.id === currentId);
  return (
    <div className="flex items-stretch gap-1 overflow-x-auto pb-1">
      {stageTree.map((node) => {
        const items = node.children.length ? node.children : [node];
        return (
          <div key={node.id} className="flex shrink-0 flex-col gap-1">
            {node.children.length > 0 ? (
              <div className="rounded bg-brand/10 px-2 py-0.5 text-center text-[10px] font-bold uppercase tracking-wider text-brand">{node.name}</div>
            ) : (
              <div className="h-[18px]" />
            )}
            <div className="flex gap-1">
              {items.map((s) => {
                const idx = leaves.findIndex((l) => l.id === s.id);
                const state = idx === currentIdx ? "current" : idx < currentIdx ? "done" : "todo";
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => onPick?.(s.id)}
                    disabled={!onPick || state === "current"}
                    title={s.policy ?? s.name}
                    className={clsx(
                      "rounded-md border px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap transition",
                      state === "current" && "border-brand bg-brand text-white shadow",
                      state === "done" && "border-line bg-surface-2 text-muted",
                      state === "todo" && "border-line bg-surface text-ink-2 hover:border-brand/50",
                    )}
                  >
                    {s.name}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
