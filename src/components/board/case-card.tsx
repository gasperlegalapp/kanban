"use client";

import Link from "next/link";
import clsx from "clsx";
import { AlertCircle, ArrowRight, CalendarClock, CheckSquare, Clock, ExternalLink, Eye } from "lucide-react";
import type { CaseSummary } from "@/lib/data/types";
import { HEALTH_COLORS } from "@/lib/domain/constants";
import { fmtDateShort, relTime } from "@/lib/format";

export function CaseCard({
  c,
  selected,
  nextStageName,
  onSelect,
  onAdvance,
  dragging,
}: {
  c: CaseSummary;
  selected: boolean;
  nextStageName: string | null;
  onSelect?: () => void;
  onAdvance?: () => void;
  dragging?: boolean;
}) {
  const m = c.metrics;
  const next = m.nextEvent;
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
            {c.county && <span>· {c.county}</span>}
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

      <div className="mt-2 grid grid-cols-4 gap-1 text-[11px] text-muted">
        <Stat icon={<Clock size={11} />} value={m.daysInStage} label="days" tone={m.reasons.some((r) => r.includes("days in stage")) ? (m.health === "red" ? "bad" : "warn") : undefined} />
        <Stat icon={<CheckSquare size={11} />} value={m.openTasks} label="open" />
        <Stat icon={<AlertCircle size={11} />} value={m.overdueTasks} label="late" tone={m.overdueTasks ? "bad" : undefined} />
        <Stat icon={<Eye size={11} />} value={m.reviewTasks} label="review" tone={m.reviewTasks ? "warn" : undefined} />
      </div>

      {next && (
        <div
          className={clsx(
            "mt-2 flex items-center gap-1 truncate rounded px-1.5 py-1 text-[11px]",
            m.daysToNextEvent !== null && m.daysToNextEvent < 0
              ? "bg-bad/10 text-bad"
              : m.daysToNextEvent !== null && m.daysToNextEvent <= 7
                ? "bg-warn/15 text-amber-700"
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

      <div className="mt-2 flex items-center justify-between text-[11px] text-faint">
        <span className="truncate">{c.ownerName ?? "Unassigned"}</span>
        <span className="shrink-0">{relTime(c.lastActivityAt)}</span>
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

function Stat({ icon, value, label, tone }: { icon: React.ReactNode; value: number; label: string; tone?: "warn" | "bad" }) {
  return (
    <div className={clsx("flex items-center gap-1", tone === "bad" && "text-bad font-semibold", tone === "warn" && "text-amber-600 font-semibold")}>
      {icon}
      <span>{value}</span>
      <span className="text-faint">{label}</span>
    </div>
  );
}
