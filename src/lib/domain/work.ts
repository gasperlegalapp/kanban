import { differenceInCalendarDays, parseISO } from "date-fns";
import type { Task } from "@/db/schema";

export type WorkBucket = "overdue" | "today" | "follow_up" | "week" | "in_review" | "later";

export const WORK_BUCKETS: { id: WorkBucket; label: string; hint: string }[] = [
  { id: "overdue", label: "Overdue", hint: "Past the due date." },
  { id: "today", label: "Due today", hint: "" },
  { id: "follow_up", label: "Follow-ups due", hint: "Waiting tasks whose check-back date has arrived." },
  { id: "week", label: "Due in the next 7 days", hint: "" },
  { id: "in_review", label: "Sent for attorney review", hint: "Waiting on an attorney to approve." },
  { id: "later", label: "Everything else", hint: "No due date yet, or due later." },
];

/** Which "My work" section an open task belongs in. First match wins. */
export function bucketFor(t: Pick<Task, "status" | "dueDate" | "followUpDate">, todayIso: string): WorkBucket {
  const today = parseISO(todayIso);
  const dueIn = t.dueDate ? differenceInCalendarDays(parseISO(t.dueDate), today) : null;
  if (dueIn !== null && dueIn < 0) return "overdue";
  if (dueIn === 0) return "today";
  if (t.status === "waiting" && t.followUpDate && differenceInCalendarDays(parseISO(t.followUpDate), today) <= 0) return "follow_up";
  if (dueIn !== null && dueIn <= 7) return "week";
  if (t.status === "review") return "in_review";
  return "later";
}

/** Counts toward the red badge on "My work": overdue, due today, or follow-up due. */
export function isUrgent(t: Pick<Task, "status" | "dueDate" | "followUpDate">, todayIso: string): boolean {
  const b = bucketFor(t, todayIso);
  return b === "overdue" || b === "today" || b === "follow_up";
}
