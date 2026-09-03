"use server";

import { and, asc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { cases, checklistItems, tasks, type Task } from "@/db/schema";
import { requireActor } from "@/lib/auth/session";
import { TASK_STATUS_MAP } from "@/lib/domain/constants";
import { recordAudit, touchCase } from "@/lib/services/audit";
import { runAction, type ActionResult } from "./result";
import { revalidateCase } from "./revalidate";

const status = z.enum(["backlog", "requested", "in_progress", "waiting", "review", "blocked", "done"]);
const lane = z.enum(["core", "assets", "litigation", "social"]);
const priority = z.enum(["low", "normal", "high", "urgent"]);
const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");

const taskInput = z.object({
  caseId: z.uuid(),
  parentTaskId: z.uuid().nullable().optional(),
  title: z.string().trim().min(1, "Title is required").max(200),
  description: z.string().max(20000).optional(),
  status: status.optional(),
  lane: lane.optional(),
  assigneeId: z.uuid().nullable().optional(),
  dueDate: dateString.nullable().optional(),
  priority: priority.optional(),
  checklist: z.array(z.string().trim().min(1).max(300)).optional(),
});
export type TaskInput = z.input<typeof taskInput>;

async function loadTask(taskId: string) {
  const db = await getDb();
  const row = await db.query.tasks.findFirst({ where: eq(tasks.id, taskId), with: { case: true } });
  if (!row) throw new Error("Task not found.");
  return row;
}

export async function createTask(raw: TaskInput): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const actor = await requireActor();
    const input = taskInput.parse(raw);
    const db = await getDb();
    const parent = await db.query.cases.findFirst({ where: eq(cases.id, input.caseId) });
    if (!parent) throw new Error("Case not found.");
    const [{ max }] = await db
      .select({ max: sql<number>`coalesce(max(${tasks.position}), -1)::int` })
      .from(tasks)
      .where(eq(tasks.caseId, input.caseId));
    const [row] = await db
      .insert(tasks)
      .values({
        caseId: input.caseId,
        parentTaskId: input.parentTaskId ?? null,
        title: input.title,
        description: input.description ?? "",
        status: input.status ?? "requested",
        lane: input.lane ?? "core",
        assigneeId: input.assigneeId ?? null,
        dueDate: input.dueDate ?? null,
        priority: input.priority ?? "normal",
        position: max + 1,
        createdBy: actor.id,
        completedAt: input.status === "done" ? new Date() : null,
      })
      .returning({ id: tasks.id });
    if (input.checklist?.length) {
      await db.insert(checklistItems).values(input.checklist.map((text, i) => ({ taskId: row.id, text, position: i })));
    }
    await recordAudit(db, actor, { caseId: input.caseId, taskId: row.id, kind: "task_created", description: `Added task "${input.title}".` });
    await touchCase(db, input.caseId);
    revalidateCase(parent.boardId, input.caseId);
    return { id: row.id };
  });
}

const taskPatch = taskInput.omit({ caseId: true, checklist: true }).partial();
export type TaskPatch = z.input<typeof taskPatch>;

export async function updateTask(taskId: string, raw: TaskPatch): Promise<ActionResult> {
  return runAction(async () => {
    const actor = await requireActor();
    const patch = taskPatch.parse(raw);
    const db = await getDb();
    const existing = await loadTask(taskId);
    const changes: Partial<Task> = {};
    const label: string[] = [];
    for (const [k, v] of Object.entries(patch) as [keyof typeof patch, unknown][]) {
      if (v === undefined) continue;
      const value = (v === "" ? null : v) as never;
      if ((existing as Record<string, unknown>)[k] !== value) {
        (changes as Record<string, unknown>)[k] = value;
        label.push(k);
      }
    }
    if (!label.length) return undefined;
    if (changes.status) {
      changes.completedAt = changes.status === "done" ? new Date() : null;
    }
    await db.update(tasks).set({ ...changes, updatedAt: new Date() }).where(eq(tasks.id, taskId));
    await recordAudit(db, actor, {
      caseId: existing.caseId,
      taskId,
      kind: changes.status ? "task_status" : "task_updated",
      description: changes.status
        ? `"${existing.title}" → ${TASK_STATUS_MAP.get(changes.status)?.label ?? changes.status}.`
        : `Updated "${existing.title}" (${label.join(", ")}).`,
      fromValue: changes.status ? existing.status : null,
      toValue: changes.status ?? null,
    });
    await touchCase(db, existing.caseId);
    revalidateCase(existing.case.boardId, existing.caseId);
    return undefined;
  });
}

/** Drag-and-drop move between status columns. */
export async function moveTask(taskId: string, toStatus: z.infer<typeof status>): Promise<ActionResult> {
  return updateTask(taskId, { status: status.parse(toStatus) });
}

export async function deleteTask(taskId: string): Promise<ActionResult> {
  return runAction(async () => {
    const actor = await requireActor();
    const db = await getDb();
    const existing = await loadTask(taskId);
    await db.update(tasks).set({ parentTaskId: null }).where(eq(tasks.parentTaskId, taskId));
    await db.delete(tasks).where(eq(tasks.id, taskId));
    await recordAudit(db, actor, { caseId: existing.caseId, kind: "task_deleted", description: `Deleted task "${existing.title}".` });
    await touchCase(db, existing.caseId);
    revalidateCase(existing.case.boardId, existing.caseId);
    return undefined;
  });
}

export async function addChecklistItem(taskId: string, text: string): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    await requireActor();
    const clean = z.string().trim().min(1).max(300).parse(text);
    const db = await getDb();
    const existing = await loadTask(taskId);
    const [{ max }] = await db
      .select({ max: sql<number>`coalesce(max(${checklistItems.position}), -1)::int` })
      .from(checklistItems)
      .where(eq(checklistItems.taskId, taskId));
    const [row] = await db.insert(checklistItems).values({ taskId, text: clean, position: max + 1 }).returning({ id: checklistItems.id });
    await db.update(tasks).set({ updatedAt: new Date() }).where(eq(tasks.id, taskId));
    await touchCase(db, existing.caseId);
    revalidateCase(existing.case.boardId, existing.caseId);
    return { id: row.id };
  });
}

const checklistPatch = z.object({
  text: z.string().trim().min(1).max(300).optional(),
  isDone: z.boolean().optional(),
  assigneeId: z.uuid().nullable().optional(),
  dueDate: dateString.nullable().optional(),
});

export async function updateChecklistItem(itemId: string, raw: z.input<typeof checklistPatch>): Promise<ActionResult> {
  return runAction(async () => {
    await requireActor();
    const patch = checklistPatch.parse(raw);
    const db = await getDb();
    const item = await db.query.checklistItems.findFirst({ where: eq(checklistItems.id, itemId) });
    if (!item) throw new Error("Checklist item not found.");
    const existing = await loadTask(item.taskId);
    await db
      .update(checklistItems)
      .set({
        ...(patch.text !== undefined ? { text: patch.text } : {}),
        ...(patch.assigneeId !== undefined ? { assigneeId: patch.assigneeId } : {}),
        ...(patch.dueDate !== undefined ? { dueDate: patch.dueDate } : {}),
        ...(patch.isDone !== undefined ? { isDone: patch.isDone, doneAt: patch.isDone ? new Date() : null } : {}),
      })
      .where(eq(checklistItems.id, itemId));
    await db.update(tasks).set({ updatedAt: new Date() }).where(eq(tasks.id, item.taskId));
    await touchCase(db, existing.caseId);
    revalidateCase(existing.case.boardId, existing.caseId);
    return undefined;
  });
}

export async function deleteChecklistItem(itemId: string): Promise<ActionResult> {
  return runAction(async () => {
    await requireActor();
    const db = await getDb();
    const item = await db.query.checklistItems.findFirst({ where: eq(checklistItems.id, itemId) });
    if (!item) return undefined;
    const existing = await loadTask(item.taskId);
    await db.delete(checklistItems).where(eq(checklistItems.id, itemId));
    revalidateCase(existing.case.boardId, existing.caseId);
    return undefined;
  });
}

/** Full task detail for the task drawer. */
export async function getTaskDetail(taskId: string) {
  return runAction(async () => {
    await requireActor();
    const db = await getDb();
    const row = await db.query.tasks.findFirst({
      where: eq(tasks.id, taskId),
      with: {
        case: { columns: { id: true, title: true, boardId: true, caseNumber: true } },
        assignee: { columns: { fullName: true } },
        checklist: { orderBy: [asc(checklistItems.position)], with: { assignee: { columns: { fullName: true } } } },
        subtasks: { orderBy: [asc(tasks.position)], with: { assignee: { columns: { fullName: true } } } },
        comments: { orderBy: (c, { asc }) => [asc(c.createdAt)] },
        attachments: { orderBy: (a, { asc }) => [asc(a.createdAt)] },
      },
    });
    if (!row) throw new Error("Task not found.");
    return row;
  });
}

export type TaskDetailData = Extract<Awaited<ReturnType<typeof getTaskDetail>>, { ok: true }>["data"];

export async function reorderTasks(caseId: string, orderedIds: string[]): Promise<ActionResult> {
  return runAction(async () => {
    await requireActor();
    const db = await getDb();
    for (const [i, id] of orderedIds.entries()) {
      await db.update(tasks).set({ position: i }).where(and(eq(tasks.id, id), eq(tasks.caseId, caseId)));
    }
    const parent = await db.query.cases.findFirst({ where: eq(cases.id, caseId) });
    if (parent) revalidateCase(parent.boardId, caseId);
    return undefined;
  });
}
