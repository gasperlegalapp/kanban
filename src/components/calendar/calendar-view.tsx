"use client";

import Link from "next/link";
import clsx from "clsx";
import { addDays, addMonths, differenceInCalendarDays, format, isSameDay, isSameMonth, parseISO, startOfDay } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { CaseEvent, Task } from "@/db/schema";

type EventRow = { event: CaseEvent; caseTitle: string; boardId: string; caseNumber: string | null };
type TaskRow = { task: Task; caseTitle: string; boardId: string; assigneeName: string | null };

type Item = { id: string; date: string; kind: "hearing" | "deadline" | "task"; title: string; sub: string; href: string; done: boolean; time?: string | null };

export function CalendarView({ month, gridStart, gridEnd, events, tasks }: { month: string; gridStart: string; gridEnd: string; events: EventRow[]; tasks: TaskRow[] }) {
  const base = parseISO(month + "-01");
  const today = startOfDay(new Date());
  const items: Item[] = [
    ...events.map((r) => ({
      id: "e" + r.event.id,
      date: r.event.date,
      kind: r.event.kind,
      title: r.event.title,
      sub: r.caseTitle,
      href: `/cases/${r.event.caseId}`,
      done: r.event.status !== "pending",
      time: r.event.time,
    })),
    ...tasks.map((r) => ({
      id: "t" + r.task.id,
      date: r.task.dueDate!,
      kind: "task" as const,
      title: r.task.title,
      sub: r.caseTitle + (r.assigneeName ? ` · ${r.assigneeName}` : ""),
      href: `/cases/${r.task.caseId}`,
      done: r.task.status === "done",
      time: null,
    })),
  ].sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? "").localeCompare(b.time ?? ""));

  const days: Date[] = [];
  for (let d = parseISO(gridStart); d <= parseISO(gridEnd); d = addDays(d, 1)) days.push(d);
  const byDay = new Map<string, Item[]>();
  for (const it of items) {
    if (!byDay.has(it.date)) byDay.set(it.date, []);
    byDay.get(it.date)!.push(it);
  }

  const upcoming = items.filter((i) => !i.done && differenceInCalendarDays(parseISO(i.date), today) >= -30 && differenceInCalendarDays(parseISO(i.date), today) <= 30);

  return (
    <div className="flex min-h-0 flex-1 gap-4 p-4">
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="mb-3 flex items-center gap-3">
          <Link href={`/calendar?month=${format(addMonths(base, -1), "yyyy-MM")}`} className="btn btn-sm">
            <ChevronLeft size={14} />
          </Link>
          <h1 className="w-44 text-center text-base font-semibold">{format(base, "MMMM yyyy")}</h1>
          <Link href={`/calendar?month=${format(addMonths(base, 1), "yyyy-MM")}`} className="btn btn-sm">
            <ChevronRight size={14} />
          </Link>
          <Link href="/calendar" className="btn btn-ghost btn-sm text-muted">
            Today
          </Link>
          <div className="ml-auto flex items-center gap-3 text-[11px] text-muted">
            <Legend color="#7c3aed" label="Hearing" />
            <Legend color="#dc2626" label="Deadline" />
            <Legend color="#2563eb" label="Task due" />
          </div>
        </div>
        <div className="grid grid-cols-7 border-b border-line text-[11px] font-bold uppercase tracking-wider text-muted">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
            <div key={d} className="px-2 py-1">
              {d}
            </div>
          ))}
        </div>
        <div className="grid min-h-0 flex-1 auto-rows-fr grid-cols-7 gap-px overflow-y-auto bg-line">
          {days.map((d) => {
            const key = format(d, "yyyy-MM-dd");
            const list = byDay.get(key) ?? [];
            const inMonth = isSameMonth(d, base);
            const isToday = isSameDay(d, today);
            return (
              <div key={key} className={clsx("min-h-24 bg-surface p-1", !inMonth && "bg-surface-2 text-faint")}>
                <div className={clsx("mb-1 flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-semibold", isToday && "bg-brand text-white")}>{format(d, "d")}</div>
                <div className="grid gap-0.5">
                  {list.map((it) => (
                    <Link
                      key={it.id}
                      href={it.href}
                      className={clsx("truncate rounded px-1 py-px text-[11px] leading-4 hover:opacity-80", it.done && "line-through opacity-50")}
                      style={{ background: colorFor(it.kind) + "1f", color: colorFor(it.kind) }}
                      title={`${it.title} — ${it.sub}`}
                    >
                      {it.time && <span className="font-mono">{it.time} </span>}
                      {it.title} <span className="opacity-70">· {it.sub}</span>
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <aside className="card w-80 shrink-0 overflow-y-auto p-3">
        <h2 className="panel-title mb-2">Next 30 days</h2>
        {upcoming.length === 0 ? (
          <p className="text-sm text-faint">Nothing due.</p>
        ) : (
          <ul className="grid gap-1.5">
            {upcoming.map((it) => {
              const n = differenceInCalendarDays(parseISO(it.date), today);
              return (
                <li key={it.id}>
                  <Link href={it.href} className="block rounded-md border border-line px-2 py-1.5 text-sm hover:bg-surface-2" style={{ borderLeftWidth: 3, borderLeftColor: colorFor(it.kind) }}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-medium">{it.title}</span>
                      <span className={clsx("shrink-0 text-[11px] font-semibold", n < 0 ? "text-bad" : n <= 7 ? "text-amber-700" : "text-muted")}>
                        {n < 0 ? `${-n}d overdue` : n === 0 ? "Today" : `in ${n}d`}
                      </span>
                    </div>
                    <div className="truncate text-[11px] text-muted">
                      {format(parseISO(it.date), "EEE, MMM d")}
                      {it.time ? ` ${it.time}` : ""} · {it.sub}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </aside>
    </div>
  );
}

function colorFor(kind: Item["kind"]) {
  return kind === "hearing" ? "#7c3aed" : kind === "deadline" ? "#dc2626" : "#2563eb";
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <span className="h-2 w-2 rounded-full" style={{ background: color }} /> {label}
    </span>
  );
}
