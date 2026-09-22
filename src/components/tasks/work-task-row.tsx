"use client";

import Link from "next/link";
import clsx from "clsx";
import { Check, CheckSquare, Clock, User } from "lucide-react";
import type { WorkTask } from "@/lib/data/work";
import { PRIORITY_MAP, TASK_STATUS_MAP } from "@/lib/domain/constants";
import { dueLabel, fmtDateShort } from "@/lib/format";

/** One task in a cross-case list (My work, Review, dashboard). */
export function WorkTaskRow({
  t,
  onOpen,
  onComplete,
  showAssignee,
  pending,
  right,
}: {
  t: WorkTask;
  onOpen: () => void;
  onComplete?: () => void;
  showAssignee?: boolean;
  pending?: boolean;
  right?: React.ReactNode;
}) {
  const st = TASK_STATUS_MAP.get(t.status)!;
  const due = dueLabel(t.dueDate);
  const pr = PRIORITY_MAP.get(t.priority)!;
  const followUpDue = t.status === "waiting" && t.followUpDate;
  return (
    <li className="group flex items-center gap-3 px-3 py-2 hover:bg-surface-2" style={{ borderLeft: `3px solid ${pr.color}` }}>
      {onComplete && (
        <button
          type="button"
          className="flex h-4 w-4 shrink-0 items-center justify-center rounded border border-line-strong bg-surface text-transparent hover:border-ok hover:text-ok disabled:opacity-40"
          onClick={onComplete}
          disabled={pending}
          title="Mark done"
          aria-label={`Mark "${t.title}" done`}
        >
          <Check size={11} />
        </button>
      )}
      <button type="button" className="min-w-0 flex-1 text-left" onClick={onOpen}>
        <div className="truncate text-sm font-medium">{t.title}</div>
        <div className="flex flex-wrap items-center gap-x-2 text-[11px] text-muted">
          <span className="truncate">
            {t.caseTitle}
            {t.caseNumber && <span className="font-mono"> · {t.caseNumber}</span>}
          </span>
          {t.status === "waiting" && t.waitingOn && <span>· waiting on {t.waitingOn}</span>}
          {t.checklistTotal > 0 && (
            <span className={clsx("flex items-center gap-0.5", t.checklistDone === t.checklistTotal && "text-ok")}>
              · <CheckSquare size={10} /> {t.checklistDone}/{t.checklistTotal}
            </span>
          )}
        </div>
      </button>
      {showAssignee && (
        <span className="hidden w-32 shrink-0 items-center gap-1 truncate text-xs text-muted sm:flex">
          <User size={11} /> {t.assigneeName ?? <span className="text-faint">Unassigned</span>}
        </span>
      )}
      <span className="badge shrink-0" style={{ background: st.color + "1f", color: st.color }}>
        {st.label}
      </span>
      <span className="w-28 shrink-0 text-right text-[11px]">
        {due.text ? (
          <span className={clsx("font-semibold", due.tone === "bad" && "text-bad", due.tone === "warn" && "text-amber-700", due.tone === "muted" && "font-normal text-muted")}>{due.text}</span>
        ) : followUpDue ? (
          <span className="flex items-center justify-end gap-1 text-muted">
            <Clock size={11} /> follow up {fmtDateShort(t.followUpDate)}
          </span>
        ) : (
          <span className="text-faint">No due date</span>
        )}
      </span>
      {right}
      <Link href={`/cases/${t.caseId}`} className="hidden shrink-0 text-[11px] text-accent hover:underline group-hover:inline" onClick={(e) => e.stopPropagation()}>
        Case
      </Link>
    </li>
  );
}
