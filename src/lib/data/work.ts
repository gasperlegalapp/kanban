import { and, asc, eq, inArray, isNull, lte, ne, or, sql, type SQL } from "drizzle-orm";
import { differenceInCalendarDays, parseISO } from "date-fns";
import { getDb } from "@/db";
import { cases, checklistItems, events, profiles, tasks, type CaseEvent, type Task } from "@/db/schema";
import { addDaysToIso, firmTodayIso } from "@/lib/dates";
import { isUrgent } from "@/lib/domain/work";
import { getBoardCases, getBoards, getPeople } from "./boards";
import type { CaseSummary, PersonLite } from "./types";

export type WorkTask = Pick<
  Task,
  | "id"
  | "title"
  | "status"
  | "lane"
  | "priority"
  | "dueDate"
  | "followUpDate"
  | "waitingOn"
  | "caseId"
  | "assigneeId"
  | "reviewerId"
  | "reviewRequestedAt"
  | "updatedAt"
  | "parentTaskId"
  | "description"
> & {
  caseTitle: string;
  caseNumber: string | null;
  boardId: string;
  assigneeName: string | null;
  reviewerName: string | null;
  checklistTotal: number;
  checklistDone: number;
};

async function nameMap(): Promise<Map<string, string>> {
  const db = await getDb();
  const rows = await db.select({ id: profiles.id, fullName: profiles.fullName }).from(profiles);
  return new Map(rows.map((r) => [r.id, r.fullName]));
}

/** Open tasks on active cases, with case and people names and checklist progress. */
export async function loadOpenTasks(extra?: SQL): Promise<WorkTask[]> {
  const db = await getDb();
  const rows = await db
    .select({
      task: {
        id: tasks.id,
        title: tasks.title,
        status: tasks.status,
        lane: tasks.lane,
        priority: tasks.priority,
        dueDate: tasks.dueDate,
        followUpDate: tasks.followUpDate,
        waitingOn: tasks.waitingOn,
        caseId: tasks.caseId,
        assigneeId: tasks.assigneeId,
        reviewerId: tasks.reviewerId,
        reviewRequestedAt: tasks.reviewRequestedAt,
        updatedAt: tasks.updatedAt,
        parentTaskId: tasks.parentTaskId,
        description: tasks.description,
      },
      caseTitle: cases.title,
      caseNumber: cases.caseNumber,
      boardId: cases.boardId,
    })
    .from(tasks)
    .innerJoin(cases, eq(tasks.caseId, cases.id))
    .where(and(ne(tasks.status, "done"), eq(cases.status, "active"), extra))
    .orderBy(asc(tasks.dueDate), asc(cases.title), asc(tasks.position));
  if (!rows.length) return [];
  const names = await nameMap();
  const counts = await db
    .select({
      taskId: checklistItems.taskId,
      total: sql<number>`count(*)::int`,
      done: sql<number>`sum(case when ${checklistItems.isDone} then 1 else 0 end)::int`,
    })
    .from(checklistItems)
    .where(inArray(checklistItems.taskId, rows.map((r) => r.task.id)))
    .groupBy(checklistItems.taskId);
  const agg = new Map(counts.map((c) => [c.taskId, c]));
  return rows.map((r) => ({
    ...r.task,
    caseTitle: r.caseTitle,
    caseNumber: r.caseNumber,
    boardId: r.boardId,
    assigneeName: r.task.assigneeId ? (names.get(r.task.assigneeId) ?? null) : null,
    reviewerName: r.task.reviewerId ? (names.get(r.task.reviewerId) ?? null) : null,
    checklistTotal: agg.get(r.task.id)?.total ?? 0,
    checklistDone: agg.get(r.task.id)?.done ?? 0,
  }));
}

export type ChecklistWorkItem = {
  id: string;
  text: string;
  dueDate: string | null;
  taskId: string;
  taskTitle: string;
  caseId: string;
  caseTitle: string;
};

export type EventWithCase = CaseEvent & { caseTitle: string; caseNumber: string | null; boardId: string; ownerId: string | null };

async function upcomingEvents(days: number, ownerId?: string): Promise<EventWithCase[]> {
  const db = await getDb();
  const horizon = addDaysToIso(firmTodayIso(), days);
  const rows = await db
    .select({ event: events, caseTitle: cases.title, caseNumber: cases.caseNumber, boardId: cases.boardId, ownerId: cases.ownerId })
    .from(events)
    .innerJoin(cases, eq(events.caseId, cases.id))
    .where(and(eq(events.status, "pending"), lte(events.date, horizon), eq(cases.status, "active"), ownerId ? eq(cases.ownerId, ownerId) : undefined))
    .orderBy(asc(events.date), asc(events.time));
  return rows.map((r) => ({ ...r.event, caseTitle: r.caseTitle, caseNumber: r.caseNumber, boardId: r.boardId, ownerId: r.ownerId }));
}

/** Tasks an attorney should look at: assigned to them for review, or unassigned review. */
function reviewFilter(userId: string): SQL {
  return and(eq(tasks.status, "review"), or(eq(tasks.reviewerId, userId), isNull(tasks.reviewerId)))!;
}

export type MyWork = {
  person: PersonLite;
  people: PersonLite[];
  tasks: WorkTask[];
  checklist: ChecklistWorkItem[];
  events: EventWithCase[];
  reviewWaiting: number;
  today: string;
};

export async function getMyWork(personId: string): Promise<MyWork | null> {
  const db = await getDb();
  const people = await getPeople();
  const person = people.find((p) => p.id === personId);
  if (!person) return null;
  const [taskRows, checklistRows, eventRows, reviewRows] = await Promise.all([
    loadOpenTasks(eq(tasks.assigneeId, personId)),
    db
      .select({
        id: checklistItems.id,
        text: checklistItems.text,
        dueDate: checklistItems.dueDate,
        taskId: tasks.id,
        taskTitle: tasks.title,
        caseId: cases.id,
        caseTitle: cases.title,
      })
      .from(checklistItems)
      .innerJoin(tasks, eq(checklistItems.taskId, tasks.id))
      .innerJoin(cases, eq(tasks.caseId, cases.id))
      .where(and(eq(checklistItems.assigneeId, personId), eq(checklistItems.isDone, false), ne(tasks.status, "done"), eq(cases.status, "active")))
      .orderBy(asc(checklistItems.dueDate), asc(cases.title)),
    upcomingEvents(14, personId),
    person.role === "attorney"
      ? db
          .select({ n: sql<number>`count(*)::int` })
          .from(tasks)
          .innerJoin(cases, eq(tasks.caseId, cases.id))
          .where(and(reviewFilter(personId), eq(cases.status, "active")))
      : Promise.resolve([{ n: 0 }]),
  ]);
  return { person, people, tasks: taskRows, checklist: checklistRows, events: eventRows, reviewWaiting: reviewRows[0]?.n ?? 0, today: firmTodayIso() };
}

export async function getReviewQueue(): Promise<WorkTask[]> {
  const rows = await loadOpenTasks(eq(tasks.status, "review"));
  return rows.sort((a, b) => (a.reviewRequestedAt?.getTime() ?? 0) - (b.reviewRequestedAt?.getTime() ?? 0));
}

export type WorkloadRow = {
  person: PersonLite;
  open: number;
  overdue: number;
  dueSoon: number;
  followUps: number;
  inReview: number;
};

export type Dashboard = {
  today: string;
  cases: CaseSummary[];
  workload: WorkloadRow[];
  unassigned: number;
  events: EventWithCase[];
  reviewQueue: number;
  followUpsDue: number;
  overdueTasks: number;
};

export async function getDashboard(): Promise<Dashboard> {
  const today = firmTodayIso();
  const boards = await getBoards();
  const caseLists = [];
  for (const b of boards) caseLists.push(await getBoardCases(b.id));
  const allCases = caseLists.flat();
  const [open, people, eventRows] = await Promise.all([loadOpenTasks(), getPeople(), upcomingEvents(14)]);

  const workload: WorkloadRow[] = people
    .filter((p) => p.isActive)
    .map((p) => {
      const mine = open.filter((t) => t.assigneeId === p.id);
      return {
        person: p,
        open: mine.length,
        overdue: mine.filter((t) => t.dueDate && t.dueDate < today).length,
        dueSoon: mine.filter((t) => t.dueDate && t.dueDate >= today && differenceInCalendarDays(parseISO(t.dueDate), parseISO(today)) <= 7).length,
        followUps: mine.filter((t) => t.status === "waiting" && t.followUpDate && t.followUpDate <= today).length,
        inReview: mine.filter((t) => t.status === "review").length,
      };
    });

  return {
    today,
    cases: allCases,
    workload,
    unassigned: open.filter((t) => !t.assigneeId).length,
    events: eventRows,
    reviewQueue: open.filter((t) => t.status === "review").length,
    followUpsDue: open.filter((t) => t.status === "waiting" && t.followUpDate && t.followUpDate <= today).length,
    overdueTasks: open.filter((t) => t.dueDate && t.dueDate < today).length,
  };
}

/** Badge numbers for the header: my urgent items and (attorneys) my review queue. */
export async function getNavCounts(userId: string, attorney: boolean): Promise<{ myUrgent: number; review: number }> {
  const db = await getDb();
  const today = firmTodayIso();
  const mine = await db
    .select({ status: tasks.status, dueDate: tasks.dueDate, followUpDate: tasks.followUpDate })
    .from(tasks)
    .innerJoin(cases, eq(tasks.caseId, cases.id))
    .where(
      and(
        eq(tasks.assigneeId, userId),
        ne(tasks.status, "done"),
        eq(cases.status, "active"),
        or(lte(tasks.dueDate, today), lte(tasks.followUpDate, today)),
      ),
    );
  let review = 0;
  if (attorney) {
    const [r] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(tasks)
      .innerJoin(cases, eq(tasks.caseId, cases.id))
      .where(and(reviewFilter(userId), eq(cases.status, "active")));
    review = r?.n ?? 0;
  }
  return { myUrgent: mine.filter((t) => isUrgent(t, today)).length, review };
}
