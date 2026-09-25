"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import clsx from "clsx";
import type { TaskSummary } from "@/lib/data/types";
import { TASK_STATUSES, TASK_STATUS_MAP } from "@/lib/domain/constants";
import { dotFlags, sortForDots, type DotFlags } from "@/lib/domain/task-dots";
import { firmTodayIso } from "@/lib/dates";
import { dueLabel, fmtDateShort } from "@/lib/format";

export type DotTaskInfo = Pick<TaskSummary, "id" | "title" | "status" | "dueDate" | "followUpDate" | "waitingOn" | "assigneeName" | "parentTaskId"> & {
  checklistDone?: number;
  checklistTotal?: number;
};

const OVERDUE_RING = "#dc2626";
const FOLLOW_UP_RING = "#d97706";

/** The dot itself. Filled = started or done, hollow = not started; a ring marks overdue or follow-up due. */
export function Dot({ color, flags, size = 10 }: { color: string; flags: DotFlags; size?: number }) {
  const ring = flags.overdue ? OVERDUE_RING : flags.followUpDue ? FOLLOW_UP_RING : null;
  return (
    <span
      className="block rounded-full"
      style={{
        width: size,
        height: size,
        background: flags.notStarted ? "var(--color-surface, #fff)" : color,
        border: `2px solid ${color}`,
        boxShadow: ring ? `0 0 0 1.5px var(--color-surface, #fff), 0 0 0 3px ${ring}` : undefined,
      }}
    />
  );
}

/**
 * One dot per task on a case, in progress order. Each dot opens its task
 * (via `onOpen`) or links to it on the case page (via `caseId`).
 */
export function TaskDots({
  tasks,
  onOpen,
  caseId,
  max = 40,
  size = 10,
}: {
  tasks: DotTaskInfo[];
  onOpen?: (taskId: string) => void;
  caseId?: string;
  max?: number;
  size?: number;
}) {
  const [hover, setHover] = useState<{ t: DotTaskInfo; x: number; y: number } | null>(null);
  const today = firmTodayIso();
  const sorted = sortForDots(tasks);
  const shown = sorted.slice(0, max);
  const hidden = sorted.length - shown.length;

  const show = (t: DotTaskInfo, el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    setHover({ t, x: r.left + r.width / 2, y: r.top });
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-[3px]" onMouseLeave={() => setHover(null)}>
        {shown.map((t) => {
          const st = TASK_STATUS_MAP.get(t.status)!;
          const flags = dotFlags(t, today);
          const label = `${t.title}: ${st.label}${flags.overdue ? ", overdue" : ""}${flags.followUpDue ? ", follow-up due" : ""}`;
          const common = {
            className: "flex h-[16px] w-[16px] items-center justify-center rounded-full outline-none transition hover:scale-125 focus-visible:ring-2 focus-visible:ring-accent",
            "aria-label": label,
            onMouseEnter: (e: React.MouseEvent<HTMLElement>) => show(t, e.currentTarget),
            onFocus: (e: React.FocusEvent<HTMLElement>) => show(t, e.currentTarget),
            onBlur: () => setHover(null),
          };
          const dot = <Dot color={st.color} flags={flags} size={size} />;
          if (onOpen) {
            return (
              <button
                key={t.id}
                type="button"
                {...common}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  setHover(null);
                  onOpen(t.id);
                }}
              >
                {dot}
              </button>
            );
          }
          if (caseId) {
            return (
              <Link key={t.id} href={`/cases/${caseId}?task=${t.id}`} {...common} onClick={(e) => e.stopPropagation()}>
                {dot}
              </Link>
            );
          }
          return (
            <span key={t.id} {...common}>
              {dot}
            </span>
          );
        })}
        {hidden > 0 && <span className="text-[10px] font-semibold text-muted">+{hidden}</span>}
      </div>
      {hover && typeof document !== "undefined" && createPortal(<DotCard {...hover} today={today} />, document.body)}
    </>
  );
}

function DotCard({ t, x, y, today }: { t: DotTaskInfo; x: number; y: number; today: string }) {
  const st = TASK_STATUS_MAP.get(t.status)!;
  const flags = dotFlags(t, today);
  const due = dueLabel(t.dueDate);
  const left = Math.min(Math.max(x - 110, 8), (typeof window !== "undefined" ? window.innerWidth : 1200) - 228);
  return (
    <div className="pointer-events-none fixed z-[200] w-[220px] rounded-md border border-line bg-surface p-2 text-xs shadow-pop" style={{ left, top: y - 8, transform: "translateY(-100%)" }} role="tooltip">
      <div className="font-semibold leading-snug text-ink">{t.title}</div>
      <div className="mt-1 flex items-center gap-1.5">
        <Dot color={st.color} flags={flags} size={9} />
        <span className="font-medium" style={{ color: st.color }}>
          {st.label}
        </span>
        {t.parentTaskId && <span className="text-faint">· sub-task</span>}
      </div>
      <div className="mt-1 space-y-0.5 text-muted">
        <div>{t.assigneeName ?? "Unassigned"}</div>
        {t.status !== "done" && due.text && <div className={clsx(flags.overdue && "font-semibold text-bad")}>{flags.overdue ? due.text : `Due ${fmtDateShort(t.dueDate)}`}</div>}
        {t.status === "waiting" && (
          <div className={clsx(flags.followUpDue && "font-semibold text-amber-700")}>
            {t.waitingOn ? `Waiting on ${t.waitingOn}` : "Waiting"}
            {t.followUpDate && ` · follow up ${fmtDateShort(t.followUpDate)}`}
          </div>
        )}
        {!!t.checklistTotal && (
          <div>
            Checklist {t.checklistDone}/{t.checklistTotal}
          </div>
        )}
      </div>
      <div className="mt-1 text-[10px] text-faint">Click to open</div>
    </div>
  );
}

/** Key to the dot colors and rings, shown from a small button on the board. */
export function TaskDotLegend() {
  const [open, setOpen] = useState(false);
  const none = { notStarted: false, overdue: false, followUpDue: false };
  return (
    <div className="relative">
      <button type="button" className="btn btn-sm" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span className="flex gap-0.5">
          <Dot color={TASK_STATUS_MAP.get("done")!.color} flags={none} size={7} />
          <Dot color={TASK_STATUS_MAP.get("in_progress")!.color} flags={none} size={7} />
          <Dot color={TASK_STATUS_MAP.get("requested")!.color} flags={{ ...none, notStarted: true }} size={7} />
        </span>
        Dot key
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-8 z-40 w-64 rounded-lg border border-line bg-surface p-3 text-xs shadow-pop">
            <p className="mb-2 text-muted">Each dot on a case card is one task. Hover for details, click to open it.</p>
            <ul className="grid gap-1.5">
              {[...TASK_STATUSES].reverse().map((s) => (
                <li key={s.id} className="flex items-center gap-2">
                  <Dot color={s.color} flags={{ ...none, notStarted: s.id === "backlog" || s.id === "requested" }} />
                  <span>{s.label}</span>
                  {(s.id === "backlog" || s.id === "requested") && <span className="text-faint">(hollow: not started)</span>}
                </li>
              ))}
              <li className="mt-1 flex items-center gap-2 border-t border-line pt-2">
                <Dot color={TASK_STATUS_MAP.get("in_progress")!.color} flags={{ ...none, overdue: true }} />
                <span>Red ring: past its due date</span>
              </li>
              <li className="flex items-center gap-2">
                <Dot color={TASK_STATUS_MAP.get("waiting")!.color} flags={{ ...none, followUpDue: true }} />
                <span>Amber ring: follow-up due</span>
              </li>
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
