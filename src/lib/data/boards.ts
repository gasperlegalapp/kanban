import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { notFound } from "next/navigation";
import { getDb } from "@/db";
import {
  attachments,
  auditLog,
  boards,
  cases,
  caseTypes,
  checklistItems,
  comments,
  deadlineRules,
  events,
  lanes,
  profiles,
  stages,
  tasks,
  templateSets,
  templateTasks,
  type Stage,
} from "@/db/schema";
import { computeCaseMetrics } from "@/lib/domain/health";
import type { BoardConfig, CaseDetail, CaseSummary, PersonLite, StageNode, TaskSummary } from "./types";

export function buildStageTree(rows: Stage[]): { tree: StageNode[]; leaves: Stage[] } {
  const sorted = [...rows].sort((a, b) => a.position - b.position);
  const nodes = new Map<string, StageNode>(sorted.map((s) => [s.id, { ...s, children: [] }]));
  const tree: StageNode[] = [];
  for (const s of sorted) {
    const node = nodes.get(s.id)!;
    if (s.parentId && nodes.has(s.parentId)) nodes.get(s.parentId)!.children.push(node);
    else tree.push(node);
  }
  const leaves: Stage[] = [];
  const walk = (list: StageNode[]) => {
    for (const n of list) {
      if (n.children.length) walk(n.children);
      else leaves.push(n);
    }
  };
  walk(tree);
  return { tree, leaves };
}

export async function getBoards() {
  const db = await getDb();
  return db.select().from(boards).orderBy(asc(boards.position));
}

export async function getPeople(): Promise<PersonLite[]> {
  const db = await getDb();
  return db
    .select({ id: profiles.id, fullName: profiles.fullName, role: profiles.role, isActive: profiles.isActive, email: profiles.email })
    .from(profiles)
    .orderBy(asc(profiles.fullName));
}

export async function getBoardConfig(boardId: string): Promise<BoardConfig> {
  const db = await getDb();
  const board = await db.query.boards.findFirst({ where: eq(boards.id, boardId) });
  if (!board) notFound();

  const [stageRows, laneRows, typeRows, people, sets, rules] = await Promise.all([
    db.select().from(stages).where(eq(stages.boardId, boardId)),
    db.select().from(lanes).where(eq(lanes.boardId, boardId)).orderBy(asc(lanes.position)),
    db.select().from(caseTypes).where(eq(caseTypes.boardId, boardId)).orderBy(asc(caseTypes.position)),
    getPeople(),
    db.query.templateSets.findMany({
      where: eq(templateSets.boardId, boardId),
      orderBy: [asc(templateSets.position)],
      with: { tasks: { orderBy: [asc(templateTasks.position)] } },
    }),
    db.select().from(deadlineRules).where(eq(deadlineRules.boardId, boardId)),
  ]);

  const { tree, leaves } = buildStageTree(stageRows);
  return { board, stageTree: tree, leafStages: leaves, lanes: laneRows, caseTypes: typeRows, people, templateSets: sets, deadlineRules: rules };
}

type TaskAggregates = Map<string, { total: number; done: number }>;

async function loadTaskSummaries(caseIds: string[]): Promise<TaskSummary[]> {
  if (!caseIds.length) return [];
  const db = await getDb();
  const rows = await db
    .select({ task: tasks, assigneeName: profiles.fullName })
    .from(tasks)
    .leftJoin(profiles, eq(tasks.assigneeId, profiles.id))
    .where(inArray(tasks.caseId, caseIds))
    .orderBy(asc(tasks.position), asc(tasks.createdAt));
  const taskIds = rows.map((r) => r.task.id);
  const agg: TaskAggregates = new Map();
  if (taskIds.length) {
    const counts = await db
      .select({
        taskId: checklistItems.taskId,
        total: sql<number>`count(*)::int`,
        done: sql<number>`sum(case when ${checklistItems.isDone} then 1 else 0 end)::int`,
      })
      .from(checklistItems)
      .where(inArray(checklistItems.taskId, taskIds))
      .groupBy(checklistItems.taskId);
    for (const c of counts) agg.set(c.taskId, { total: c.total, done: c.done });
  }
  const subtaskCounts = new Map<string, number>();
  for (const r of rows) {
    if (r.task.parentTaskId) subtaskCounts.set(r.task.parentTaskId, (subtaskCounts.get(r.task.parentTaskId) ?? 0) + 1);
  }
  return rows.map((r) => ({
    ...r.task,
    assigneeName: r.assigneeName,
    checklistTotal: agg.get(r.task.id)?.total ?? 0,
    checklistDone: agg.get(r.task.id)?.done ?? 0,
    subtaskCount: subtaskCounts.get(r.task.id) ?? 0,
  }));
}

export async function getBoardCases(boardId: string, opts: { includeClosed?: boolean } = {}): Promise<CaseSummary[]> {
  const db = await getDb();
  const config = await getBoardConfig(boardId);
  const stageById = new Map(config.leafStages.map((s) => [s.id, s]));
  for (const s of config.stageTree) stageById.set(s.id, s);
  const laneById = new Map(config.lanes.map((l) => [l.id, l]));
  const typeById = new Map(config.caseTypes.map((t) => [t.id, t]));
  const personById = new Map(config.people.map((p) => [p.id, p]));

  const where = opts.includeClosed
    ? and(eq(cases.boardId, boardId), sql`${cases.status} <> 'archived'`)
    : and(eq(cases.boardId, boardId), eq(cases.status, "active"));
  const caseRows = await db.select().from(cases).where(where).orderBy(asc(cases.createdAt));
  const caseIds = caseRows.map((c) => c.id);
  const [taskRows, eventRows] = await Promise.all([
    loadTaskSummaries(caseIds),
    caseIds.length ? db.select().from(events).where(inArray(events.caseId, caseIds)).orderBy(asc(events.date)) : Promise.resolve([]),
  ]);

  const now = new Date();
  return caseRows.map((c) => {
    const stage = stageById.get(c.stageId)!;
    const caseTasks = taskRows.filter((t) => t.caseId === c.id);
    const caseEvents = eventRows.filter((e) => e.caseId === c.id);
    return {
      ...c,
      stage,
      lane: c.laneId ? laneById.get(c.laneId) ?? null : null,
      caseType: c.caseTypeId ? typeById.get(c.caseTypeId) ?? null : null,
      ownerName: c.ownerId ? personById.get(c.ownerId)?.fullName ?? null : null,
      metrics: computeCaseMetrics(c, stage, caseTasks, caseEvents, now),
      tasks: caseTasks,
      events: caseEvents,
    };
  });
}

export async function getCaseDetail(caseId: string): Promise<CaseDetail | null> {
  const db = await getDb();
  const c = await db.query.cases.findFirst({ where: eq(cases.id, caseId) });
  if (!c) return null;
  const config = await getBoardConfig(c.boardId);
  const stage = [...config.leafStages, ...config.stageTree].find((s) => s.id === c.stageId)!;
  const [taskRows, eventRows, commentRows, attachmentRows, auditRows] = await Promise.all([
    loadTaskSummaries([caseId]),
    db.select().from(events).where(eq(events.caseId, caseId)).orderBy(asc(events.date)),
    db.select().from(comments).where(eq(comments.caseId, caseId)).orderBy(asc(comments.createdAt)),
    db.select().from(attachments).where(eq(attachments.caseId, caseId)).orderBy(asc(attachments.createdAt)),
    db.select().from(auditLog).where(eq(auditLog.caseId, caseId)).orderBy(sql`${auditLog.createdAt} desc`).limit(200),
  ]);
  const taskIds = taskRows.map((t) => t.id);
  const checklistRows = taskIds.length
    ? await db
        .select({ item: checklistItems, assigneeName: profiles.fullName })
        .from(checklistItems)
        .leftJoin(profiles, eq(checklistItems.assigneeId, profiles.id))
        .where(inArray(checklistItems.taskId, taskIds))
        .orderBy(asc(checklistItems.position))
    : [];
  const checklistByTask: CaseDetail["checklistByTask"] = {};
  for (const r of checklistRows) {
    (checklistByTask[r.item.taskId] ??= []).push({ ...r.item, assigneeName: r.assigneeName });
  }
  return {
    ...c,
    stage,
    lane: c.laneId ? config.lanes.find((l) => l.id === c.laneId) ?? null : null,
    caseType: c.caseTypeId ? config.caseTypes.find((t) => t.id === c.caseTypeId) ?? null : null,
    ownerName: c.ownerId ? config.people.find((p) => p.id === c.ownerId)?.fullName ?? null : null,
    metrics: computeCaseMetrics(c, stage, taskRows, eventRows),
    tasks: taskRows,
    events: eventRows,
    comments: commentRows,
    attachments: attachmentRows,
    audit: auditRows,
    checklistByTask,
  };
}

/** Everything the calendar needs across all boards. */
export async function getCalendarData(from: string, to: string) {
  const db = await getDb();
  const [eventRows, taskRows] = await Promise.all([
    db
      .select({ event: events, caseTitle: cases.title, boardId: cases.boardId, caseNumber: cases.caseNumber })
      .from(events)
      .innerJoin(cases, eq(events.caseId, cases.id))
      .where(and(sql`${events.date} >= ${from}`, sql`${events.date} <= ${to}`, sql`${cases.status} <> 'archived'`))
      .orderBy(asc(events.date)),
    db
      .select({ task: tasks, caseTitle: cases.title, boardId: cases.boardId, assigneeName: profiles.fullName })
      .from(tasks)
      .innerJoin(cases, eq(tasks.caseId, cases.id))
      .leftJoin(profiles, eq(tasks.assigneeId, profiles.id))
      .where(and(sql`${tasks.dueDate} >= ${from}`, sql`${tasks.dueDate} <= ${to}`, sql`${tasks.status} <> 'done'`, sql`${cases.status} <> 'archived'`))
      .orderBy(asc(tasks.dueDate)),
  ]);
  return { events: eventRows, tasks: taskRows };
}
