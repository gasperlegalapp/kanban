"use client";

import clsx from "clsx";
import { CheckSquare, GitBranch, User } from "lucide-react";
import type { TaskSummary } from "@/lib/data/types";
import { PRIORITY_MAP } from "@/lib/domain/constants";
import { dueLabel } from "@/lib/format";

export function TaskCard({
  t,
  caseTitle,
  onOpen,
  dragging,
}: {
  t: TaskSummary;
  caseTitle?: string | null;
  onOpen?: () => void;
  dragging?: boolean;
}) {
  const due = dueLabel(t.dueDate);
  const pr = PRIORITY_MAP.get(t.priority)!;
  const done = t.status === "done";
  return (
    <div
      onClick={onOpen}
      className={clsx(
        "group cursor-pointer select-none rounded-md border border-line bg-surface p-2 text-left shadow-card transition hover:-translate-y-px hover:shadow-card-hover",
        dragging && "opacity-60",
        done && "opacity-70",
      )}
      style={{ borderLeftWidth: 3, borderLeftColor: pr.color }}
    >
      <div className={clsx("text-[12.5px] font-medium leading-snug", done && "line-through text-muted")}>{t.title}</div>
      {caseTitle && <div className="mt-0.5 truncate text-[11px] text-muted">{caseTitle}</div>}
      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted">
        {t.assigneeName ? (
          <span className="flex items-center gap-1">
            <User size={11} /> {t.assigneeName}
          </span>
        ) : (
          <span className="flex items-center gap-1 text-faint">
            <User size={11} /> Unassigned
          </span>
        )}
        {t.checklistTotal > 0 && (
          <span className={clsx("flex items-center gap-1", t.checklistDone === t.checklistTotal && "text-ok")}>
            <CheckSquare size={11} /> {t.checklistDone}/{t.checklistTotal}
          </span>
        )}
        {t.subtaskCount > 0 && (
          <span className="flex items-center gap-1">
            <GitBranch size={11} /> {t.subtaskCount}
          </span>
        )}
        {due.text && !done && (
          <span
            className={clsx(
              "ml-auto rounded px-1 py-px font-semibold",
              due.tone === "bad" && "bg-bad/10 text-bad",
              due.tone === "warn" && "bg-warn/15 text-amber-700",
              due.tone === "muted" && "text-faint font-normal",
            )}
          >
            {due.text}
          </span>
        )}
      </div>
    </div>
  );
}
