"use client";

import { ArrowRight, FileText, MessageSquare, Paperclip, SkipForward, Sparkles, Trash2, Upload, Wrench } from "lucide-react";
import type { AuditEntry } from "@/db/schema";
import { fmtDate } from "@/lib/format";

function iconFor(kind: AuditEntry["kind"]) {
  switch (kind) {
    case "stage_change":
    case "case_closed":
    case "case_reopened":
    case "case_archived":
    case "lane_change":
      return <ArrowRight size={12} className="text-accent" />;
    case "stage_skip":
      return <SkipForward size={12} className="text-warn" />;
    case "comment":
      return <MessageSquare size={12} className="text-muted" />;
    case "attachment":
      return <Paperclip size={12} className="text-muted" />;
    case "template_applied":
      return <Sparkles size={12} className="text-brand" />;
    case "import":
      return <Upload size={12} className="text-muted" />;
    case "task_deleted":
    case "event_deleted":
      return <Trash2 size={12} className="text-bad" />;
    case "task_created":
    case "task_status":
    case "task_updated":
      return <Wrench size={12} className="text-muted" />;
    default:
      return <FileText size={12} className="text-muted" />;
  }
}

export function ActivityTimeline({ entries }: { entries: AuditEntry[] }) {
  if (!entries.length) return <p className="text-xs text-faint">No activity yet.</p>;
  return (
    <ol className="relative ml-2 border-l border-line pl-4">
      {entries.map((e) => (
        <li key={e.id} className="relative mb-3 text-xs">
          <span className="absolute -left-[23px] top-0.5 flex h-4 w-4 items-center justify-center rounded-full border border-line bg-surface">{iconFor(e.kind)}</span>
          <div className="text-ink">{e.description}</div>
          {e.reason && (
            <div className="mt-1 rounded border border-warn/40 bg-warn/10 px-2 py-1 text-[11px] text-amber-800">
              <span className="font-semibold">Reason:</span> {e.reason}
            </div>
          )}
          <div className="mt-0.5 text-[10px] uppercase tracking-wide text-faint">
            {e.actorName} · {fmtDate(e.createdAt, "MMM d, yyyy h:mm a")}
          </div>
        </li>
      ))}
    </ol>
  );
}
