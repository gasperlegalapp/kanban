"use client";

import Link from "next/link";
import clsx from "clsx";
import { AlertCircle, ArrowRight, Ban, CalendarClock, Clock, ExternalLink, Eye, Hourglass, Moon } from "lucide-react";
import type { CaseSummary } from "@/lib/data/types";
import { HEALTH_COLORS } from "@/lib/domain/constants";
import { initials } from "@/lib/domain/task-dots";
import { daysUntil, fmtDateShort, relTime } from "@/lib/format";
import { TaskDots } from "./task-dots";

/** Days without any activity before a case gets the "quiet" sticker. */
const QUIET_DAYS = 30;

type Sticker = { key: string; label: string; icon: typeof Clock; tone: "bad" | "warn" | "review" | "muted"; title: string };

function stickers(c: CaseSummary): Sticker[] {
  const m = c.metrics;
  const out: Sticker[] = [];
  const stageTone = m.reasons.some((r) => r.includes("days in stage")) ? (m.health === "red" ? "bad" : "warn") : "muted";
  out.push({ key: "days", label: `${m.daysInStage}d in stage`, icon: Clock, tone: stageTone, title: `In ${c.stage.name} for ${m.daysInStage} days` });
  if (m.overdueTasks) out.push({ key: "late", label: `${m.overdueTasks} late`, icon: AlertCircle, tone: "bad", title: "Tasks past their due date" });
  if (m.blockedTasks) out.push({ key: "blocked", label: `${m.blockedTasks} blocked`, icon: Ban, tone: "bad", title: "Tasks blocked by an internal issue" });
  if (m.reviewTasks) out.push({ key: "review", label: `${m.reviewTasks} review`, icon: Eye, tone: "review", title: "Tasks waiting for attorney review" });
  if (m.followUpsDue) out.push({ key: "follow", label: `${m.followUpsDue} follow-up`, icon: Clock, tone: "warn", title: "Waiting tasks due for a follow-up" });
  else if (m.waitingTasks) out.push({ key: "waiting", label: `${m.waitingTasks} waiting`, icon: Hourglass, tone: "muted", title: "Tasks waiting on someone outside the firm" });
  const quiet = -(daysUntil(c.lastActivityAt) ?? 0);
  if (quiet >= QUIET_DAYS) out.push({ key: "quiet", label: `quiet ${quiet}d`, icon: Moon, tone: "muted", title: `No activity for ${quiet} days` });
  return out;
}

const TONE: Record<Sticker["tone"], string> = {
  bad: "bg-bad/10 text-bad",
  warn: "bg-warn/15 text-amber-800",
  review: "bg-violet-100 text-violet-700",
  muted: "bg-surface-2 text-muted",
};

export function CaseCard({
  c,
  selected,
  nextStageName,
  onSelect,
  onAdvance,
  onOpenTask,
  dragging,
}: {
  c: CaseSummary;
  selected: boolean;
  nextStageName: string | null;
  onSelect?: () => void;
  onAdvance?: () => void;
  /** Called when a task dot is clicked. */
  onOpenTask?: (taskId: string) => void;
  dragging?: boolean;
}) {
  const m = c.metrics;
  const next = m.nextEvent;
  const total = c.tasks.length;
  const done = c.tasks.filter((t) => t.status === "done").length;
  const people = [...new Set(c.tasks.filter((t) => t.status !== "done" && t.assigneeName).map((t) => t.assigneeName!))];

  return (
    <div
      onClick={onSelect}
      className={clsx(
        "group relative cursor-pointer select-none rounded-md border bg-surface p-2.5 text-left shadow-card transition",
        "hover:-translate-y-px hover:shadow-card-hover",
        selected ? "border-accent ring-2 ring-accent/30" : "border-line",
        dragging && "opacity-60",
      )}
      style={{ borderLeftWidth: 3, borderLeftColor: HEALTH_COLORS[m.health] }}
      title={m.reasons.join("\n") || "On track"}
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-semibold leading-tight text-ink">{c.title}</div>
          <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted">
            {c.caseType && (
              <span className="badge" style={{ background: c.caseType.color + "22", color: c.caseType.color }}>
                {c.caseType.prefix ?? c.caseType.name}
              </span>
            )}
            {c.caseNumber && <span className="font-mono">{c.caseNumber}</span>}
            {c.county && <span className="truncate">· {c.county}</span>}
          </div>
        </div>
        <Link
          href={`/cases/${c.id}`}
          onClick={(e) => e.stopPropagation()}
          className="rounded p-1 text-faint opacity-0 transition hover:bg-surface-2 hover:text-ink group-hover:opacity-100"
          title="Open case"
        >
          <ExternalLink size={13} />
        </Link>
      </div>

      {/* One dot per task */}
      <div className="mt-2">
        {total > 0 ? (
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <TaskDots tasks={c.tasks} onOpen={onOpenTask} />
            </div>
            <span className="shrink-0 pt-px text-[10px] font-semibold tabular-nums text-muted" title={`${done} of ${total} tasks done`}>
              {done}/{total}
            </span>
          </div>
        ) : (
          <div className="text-[11px] text-faint">No tasks yet</div>
        )}
      </div>

      {/* Stickers */}
      <div className="mt-2 flex flex-wrap gap-1">
        {stickers(c).map((s) => (
          <span key={s.key} className={clsx("inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold leading-none", TONE[s.tone])} title={s.title}>
            <s.icon size={10} /> {s.label}
          </span>
        ))}
      </div>

      {next && (
        <div
          className={clsx(
            "mt-1.5 flex items-center gap-1 truncate rounded px-1.5 py-1 text-[11px]",
            m.daysToNextEvent !== null && m.daysToNextEvent < 0
              ? "bg-bad/10 text-bad"
              : m.daysToNextEvent !== null && m.daysToNextEvent <= 7
                ? "bg-warn/15 text-amber-800"
                : "bg-surface-2 text-muted",
          )}
        >
          <CalendarClock size={11} className="shrink-0" />
          <span className="truncate">
            {next.title} · {fmtDateShort(next.date)}
            {m.daysToNextEvent !== null && m.daysToNextEvent < 0 && ` (${-m.daysToNextEvent}d late)`}
          </span>
        </div>
      )}

      <div className="mt-2 flex items-center gap-1.5 text-[11px] text-faint">
        <span className="min-w-0 flex-1 truncate" title="Responsible attorney or staff">
          {c.ownerName ?? "Unassigned"}
        </span>
        {people.length > 0 && (
          <span className="flex -space-x-1" title={`Working on it: ${people.join(", ")}`}>
            {people.slice(0, 3).map((p) => (
              <span key={p} className="flex h-4 min-w-4 items-center justify-center rounded-full border border-surface bg-brand-soft px-0.5 text-[8px] font-bold text-brand">
                {initials(p)}
              </span>
            ))}
            {people.length > 3 && <span className="flex h-4 items-center pl-1.5 text-[9px] font-semibold text-muted">+{people.length - 3}</span>}
          </span>
        )}
        <span className="shrink-0 group-hover:invisible">{relTime(c.lastActivityAt)}</span>
      </div>

      {nextStageName && onAdvance && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onAdvance();
          }}
          className="absolute bottom-1.5 right-1.5 hidden items-center gap-1 rounded bg-brand px-1.5 py-0.5 text-[10px] font-semibold text-white shadow group-hover:flex"
          title={`Move to ${nextStageName}`}
        >
          {nextStageName} <ArrowRight size={10} />
        </button>
      )}
    </div>
  );
}
