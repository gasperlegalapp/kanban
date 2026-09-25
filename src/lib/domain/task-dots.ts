import type { Task, TaskStatus } from "@/db/schema";

/**
 * Order of dots on a case card, left to right. Finished work first so the
 * row reads like a progress bar filling up, then work in flight, then work
 * not yet started.
 */
export const DOT_ORDER: TaskStatus[] = ["done", "review", "in_progress", "waiting", "blocked", "requested", "backlog"];

/** Statuses drawn as hollow dots: the task exists but nobody has started it. */
export const NOT_STARTED: TaskStatus[] = ["backlog", "requested"];

export type DotTask = Pick<Task, "id" | "title" | "status" | "dueDate" | "followUpDate">;

export type DotFlags = { notStarted: boolean; overdue: boolean; followUpDue: boolean };

export function dotFlags(t: Pick<Task, "status" | "dueDate" | "followUpDate">, todayIso: string): DotFlags {
  const open = t.status !== "done";
  return {
    notStarted: NOT_STARTED.includes(t.status),
    overdue: open && !!t.dueDate && t.dueDate < todayIso,
    followUpDue: t.status === "waiting" && !!t.followUpDate && t.followUpDate <= todayIso,
  };
}

/** Stable sort into DOT_ORDER, keeping the tasks' own order within a status. */
export function sortForDots<T extends Pick<Task, "status">>(tasks: T[]): T[] {
  return tasks
    .map((t, i) => ({ t, i }))
    .sort((a, b) => DOT_ORDER.indexOf(a.t.status) - DOT_ORDER.indexOf(b.t.status) || a.i - b.i)
    .map((x) => x.t);
}

/** Up to three initials for an avatar: "Christopher Gasper" -> "CG", "Grace" -> "G". */
export function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 3)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("")
    .slice(0, 3);
}
