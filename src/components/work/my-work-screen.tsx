"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { CalendarClock, Check, ChevronDown, ChevronRight, ClipboardCheck, Inbox } from "lucide-react";
import type { MyWork, WorkTask } from "@/lib/data/work";
import { bucketFor, WORK_BUCKETS, type WorkBucket } from "@/lib/domain/work";
import { updateChecklistItem, updateTask } from "@/lib/actions/tasks";
import { dueLabel, fmtDate } from "@/lib/format";
import { useToast } from "@/components/ui/toast";
import { TaskDrawer } from "@/components/tasks/task-drawer";
import { WorkTaskRow } from "@/components/tasks/work-task-row";

const BUCKET_TONE: Record<WorkBucket, string> = {
  overdue: "text-bad",
  today: "text-amber-700",
  follow_up: "text-amber-700",
  week: "text-ink",
  in_review: "text-violet-700",
  later: "text-muted",
};

export function MyWorkScreen({ data, currentUserId }: { data: MyWork; currentUserId: string }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  const [showLater, setShowLater] = useState(true);
  const self = data.person.id === currentUserId;

  const grouped = useMemo(() => {
    const m = new Map<WorkBucket, WorkTask[]>();
    for (const t of data.tasks) {
      const b = bucketFor(t, data.today);
      if (!m.has(b)) m.set(b, []);
      m.get(b)!.push(t);
    }
    return m;
  }, [data.tasks, data.today]);

  const complete = (t: WorkTask) =>
    start(async () => {
      const res = await updateTask(t.id, { status: "done" });
      if (!res.ok) return toast.error(res.error);
      toast.notify(`Done: ${t.title}`);
      router.refresh();
    });

  const urgent = (grouped.get("overdue")?.length ?? 0) + (grouped.get("today")?.length ?? 0) + (grouped.get("follow_up")?.length ?? 0);
  const firstName = data.person.fullName.split(" ")[0];

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-5xl px-5 py-4">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <Inbox size={18} className="text-brand" />
          <h1 className="text-lg font-semibold">{self ? "My work" : `${firstName}'s work`}</h1>
          <span className="text-sm text-muted">
            {data.tasks.length} open task{data.tasks.length === 1 ? "" : "s"}
            {urgent > 0 && <span className="font-semibold text-bad"> · {urgent} need attention today</span>}
          </span>
          <label className="ml-auto flex items-center gap-2 text-xs text-muted">
            Viewing
            <select
              className="select h-8 w-auto"
              value={data.person.id}
              onChange={(e) => router.push(e.target.value === currentUserId ? "/my" : `/my?user=${e.target.value}`)}
            >
              {data.people
                .filter((p) => p.isActive)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.id === currentUserId ? `${p.fullName} (me)` : p.fullName}
                  </option>
                ))}
            </select>
          </label>
        </div>

        {self && data.reviewWaiting > 0 && (
          <Link href="/review" className="card mb-4 flex items-center gap-3 border-violet-200 bg-violet-50 px-4 py-3 text-sm hover:bg-violet-100">
            <ClipboardCheck size={16} className="text-violet-700" />
            <span className="font-medium text-violet-900">
              {data.reviewWaiting} task{data.reviewWaiting === 1 ? " is" : "s are"} waiting for your review
            </span>
            <ChevronRight size={14} className="ml-auto text-violet-700" />
          </Link>
        )}

        {data.tasks.length === 0 && data.checklist.length === 0 && (
          <div className="card px-5 py-10 text-center text-sm text-muted">Nothing assigned right now.</div>
        )}

        <div className="grid gap-4">
          {WORK_BUCKETS.filter((b) => b.id !== "later").map((b) => {
            const list = grouped.get(b.id);
            if (!list?.length) return null;
            return (
              <section key={b.id} className="card overflow-hidden">
                <h2 className={clsx("flex items-center gap-2 border-b border-line bg-surface-2 px-3 py-2 text-xs font-bold uppercase tracking-wider", BUCKET_TONE[b.id])}>
                  {b.label} <span className="rounded-full bg-surface px-1.5 text-[10px] text-muted">{list.length}</span>
                  {b.hint && <span className="font-normal normal-case tracking-normal text-faint">{b.hint}</span>}
                </h2>
                <ul className="divide-y divide-line">
                  {list.map((t) => (
                    <WorkTaskRow key={t.id} t={t} onOpen={() => setOpenTaskId(t.id)} onComplete={() => complete(t)} pending={pending} />
                  ))}
                </ul>
              </section>
            );
          })}

          {data.checklist.length > 0 && (
            <section className="card overflow-hidden">
              <h2 className="flex items-center gap-2 border-b border-line bg-surface-2 px-3 py-2 text-xs font-bold uppercase tracking-wider">
                Checklist items assigned {self ? "to me" : `to ${firstName}`}
                <span className="rounded-full bg-surface px-1.5 text-[10px] text-muted">{data.checklist.length}</span>
              </h2>
              <ul className="divide-y divide-line">
                {data.checklist.map((c) => {
                  const due = dueLabel(c.dueDate);
                  return (
                    <li key={c.id} className="flex items-center gap-3 px-3 py-2 hover:bg-surface-2">
                      <button
                        className="flex h-4 w-4 shrink-0 items-center justify-center rounded border border-line-strong text-transparent hover:border-ok hover:text-ok"
                        disabled={pending}
                        aria-label={`Mark "${c.text}" done`}
                        onClick={() =>
                          start(async () => {
                            const res = await updateChecklistItem(c.id, { isDone: true });
                            if (!res.ok) return toast.error(res.error);
                            router.refresh();
                          })
                        }
                      >
                        <Check size={11} />
                      </button>
                      <button className="min-w-0 flex-1 text-left" onClick={() => setOpenTaskId(c.taskId)}>
                        <div className="truncate text-sm">{c.text}</div>
                        <div className="truncate text-[11px] text-muted">
                          {c.taskTitle} · {c.caseTitle}
                        </div>
                      </button>
                      {due.text && (
                        <span className={clsx("text-[11px] font-semibold", due.tone === "bad" && "text-bad", due.tone === "warn" && "text-amber-700", due.tone === "muted" && "font-normal text-muted")}>
                          {due.text}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {data.events.length > 0 && (
            <section className="card overflow-hidden">
              <h2 className="flex items-center gap-2 border-b border-line bg-surface-2 px-3 py-2 text-xs font-bold uppercase tracking-wider">
                <CalendarClock size={12} /> Hearings and deadlines on {self ? "my" : `${firstName}'s`} cases · next 14 days
              </h2>
              <ul className="divide-y divide-line">
                {data.events.map((e) => {
                  const due = dueLabel(e.date);
                  return (
                    <li key={e.id}>
                      <Link href={`/cases/${e.caseId}`} className="flex items-center gap-3 px-3 py-2 text-sm hover:bg-surface-2">
                        <span className={clsx("badge", e.kind === "hearing" ? "bg-violet-100 text-violet-700" : "bg-red-50 text-red-700")}>{e.kind}</span>
                        <span className="min-w-0 flex-1 truncate">
                          {e.title} <span className="text-muted">· {e.caseTitle}</span>
                        </span>
                        <span className="font-mono text-xs">
                          {fmtDate(e.date, "EEE M/d")}
                          {e.time ? ` ${e.time}` : ""}
                        </span>
                        <span className={clsx("w-20 text-right text-[11px] font-semibold", due.tone === "bad" && "text-bad", due.tone === "warn" && "text-amber-700", due.tone === "muted" && "font-normal text-faint")}>
                          {due.text}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {(grouped.get("later")?.length ?? 0) > 0 && (
            <section className="card overflow-hidden">
              <button
                className="flex w-full items-center gap-2 border-b border-line bg-surface-2 px-3 py-2 text-left text-xs font-bold uppercase tracking-wider text-muted"
                onClick={() => setShowLater((s) => !s)}
              >
                {showLater ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                Everything else
                <span className="rounded-full bg-surface px-1.5 text-[10px]">{grouped.get("later")!.length}</span>
                <span className="font-normal normal-case tracking-normal text-faint">No due date yet, or due later.</span>
              </button>
              {showLater && (
                <ul className="divide-y divide-line">
                  {grouped.get("later")!.map((t) => (
                    <WorkTaskRow key={t.id} t={t} onOpen={() => setOpenTaskId(t.id)} onComplete={() => complete(t)} pending={pending} />
                  ))}
                </ul>
              )}
            </section>
          )}
        </div>
      </div>
      <TaskDrawer taskId={openTaskId} onClose={() => setOpenTaskId(null)} people={data.people} canDelete />
    </div>
  );
}
