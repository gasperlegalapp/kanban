import { differenceInCalendarDays, parseISO, startOfDay } from "date-fns";
import type { Case, CaseEvent, Stage, Task, TaskStatus } from "@/db/schema";

export type Health = "green" | "yellow" | "red";

export type CaseMetrics = {
  daysInStage: number;
  openTasks: number;
  overdueTasks: number;
  reviewTasks: number;
  blockedTasks: number;
  waitingTasks: number;
  /** Pending hearings/deadlines whose date has passed. */
  overdueEvents: number;
  /** Soonest pending hearing or deadline, if any. */
  nextEvent: CaseEvent | null;
  /** Days until nextEvent (negative when overdue). */
  daysToNextEvent: number | null;
  health: Health;
  reasons: string[];
};

export const OPEN_TASK_STATUSES: TaskStatus[] = [
  "backlog",
  "requested",
  "in_progress",
  "waiting",
  "review",
  "blocked",
];

/** Days within which an upcoming deadline turns the case yellow. */
export const UPCOMING_EVENT_WARNING_DAYS = 7;

function toDay(value: string | Date): Date {
  return startOfDay(typeof value === "string" ? parseISO(value) : value);
}

/**
 * Roll task and event data up onto a case. Pure and deterministic given `now`,
 * so it is safe to call on every render and easy to unit test.
 */
export function computeCaseMetrics(
  c: Pick<Case, "stageEnteredAt" | "status">,
  stage: Pick<Stage, "stuckDays" | "criticalDays" | "isClosed" | "isArchive"> | null | undefined,
  caseTasks: Pick<Task, "status" | "dueDate">[],
  caseEvents: CaseEvent[],
  now: Date = new Date(),
): CaseMetrics {
  const today = startOfDay(now);
  const daysInStage = Math.max(0, differenceInCalendarDays(today, toDay(c.stageEnteredAt)));

  const open = caseTasks.filter((t) => t.status !== "done");
  const overdueTasks = open.filter((t) => t.dueDate && toDay(t.dueDate) < today).length;
  const reviewTasks = open.filter((t) => t.status === "review").length;
  const blockedTasks = open.filter((t) => t.status === "blocked").length;
  const waitingTasks = open.filter((t) => t.status === "waiting").length;

  const pending = caseEvents
    .filter((e) => e.status === "pending")
    .sort((a, b) => a.date.localeCompare(b.date));
  const overdueEvents = pending.filter((e) => toDay(e.date) < today).length;
  const nextEvent = pending.find((e) => toDay(e.date) >= today) ?? pending[0] ?? null;
  const daysToNextEvent = nextEvent ? differenceInCalendarDays(toDay(nextEvent.date), today) : null;

  const reasons: string[] = [];
  let health: Health = "green";
  const closedish = c.status !== "active" || stage?.isClosed || stage?.isArchive;

  if (!closedish) {
    const critical = stage?.criticalDays ?? null;
    const stuck = stage?.stuckDays ?? null;

    if (critical !== null && daysInStage >= critical) reasons.push(`${daysInStage} days in stage (limit ${critical})`);
    if (overdueEvents > 0) reasons.push(`${overdueEvents} overdue deadline${overdueEvents > 1 ? "s" : ""}`);
    if (overdueTasks >= 3) reasons.push(`${overdueTasks} overdue tasks`);
    if (reasons.length > 0) {
      health = "red";
    } else {
      if (stuck !== null && daysInStage >= stuck) reasons.push(`${daysInStage} days in stage (watch at ${stuck})`);
      if (overdueTasks > 0) reasons.push(`${overdueTasks} overdue task${overdueTasks > 1 ? "s" : ""}`);
      if (blockedTasks > 0) reasons.push(`${blockedTasks} blocked task${blockedTasks > 1 ? "s" : ""}`);
      if (daysToNextEvent !== null && daysToNextEvent >= 0 && daysToNextEvent <= UPCOMING_EVENT_WARNING_DAYS) {
        reasons.push(`${nextEvent!.title} in ${daysToNextEvent} day${daysToNextEvent === 1 ? "" : "s"}`);
      }
      if (reasons.length > 0) health = "yellow";
    }
  }

  return {
    daysInStage,
    openTasks: open.length,
    overdueTasks,
    reviewTasks,
    blockedTasks,
    waitingTasks,
    overdueEvents,
    nextEvent,
    daysToNextEvent,
    health,
    reasons,
  };
}

export function isTaskOverdue(t: Pick<Task, "status" | "dueDate">, now: Date = new Date()): boolean {
  return t.status !== "done" && !!t.dueDate && toDay(t.dueDate) < startOfDay(now);
}
