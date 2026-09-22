"use server";

import { and, asc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb, type Db } from "@/db";
import { cases, checklistItems, comments, profiles, tasks, type Case, type Profile, type Task } from "@/db/schema";
import { isAttorney, requireActor, requireAttorneyActor } from "@/lib/auth/session";
import { TASK_STATUS_MAP } from "@/lib/domain/constants";
import { addDaysToIso, firmTodayIso } from "@/lib/dates";
import { recordAudit, touchCase } from "@/lib/services/audit";
import { attorneyIds, notify } from "@/lib/services/notify";
import { runAction, type ActionResult } from "./result";
import { revalidateCase } from "./revalidate";

const status = z.enum(["backlog", "requested", "in_progress", "waiting", "review", "blocked", "done"]);
const lane = z.enum(["core", "assets", "litigation", "social"]);
const priority = z.enum(["low", "normal", "high", "urgent"]);
const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");

/** Days until a waiting task comes back up when no follow-up date is given. */
const DEFAULT_FOLLOW_UP_DAYS = 7;

const taskInput = z.object({
  caseId: z.uuid(),
  parentTaskId: z.uuid().nullable().optional(),
  title: z.string().trim().min(1, "Title is required").max(200),
  description: z.string().max(20000).optional(),
  status: status.optional(),
  lane: lane.optional(),
  assigneeId: z.uuid().nullable().optional(),
  reviewerId: z.uuid().nullable().optional(),
  dueDate: dateString.nullable().optional(),
  priority: priority.optional(),
  waitingOn: z.string().trim().max(200).nullable().optional(),
  followUpDate: dateString.nullable().optional(),
  checklist: z.array(z.string().trim().min(1).max(300)).optional(),
});
export type TaskInput = z.input<typeof taskInput>;

type TaskWithCase = Task & { case: Case };

async function loadTask(taskId: string): Promise<TaskWithCase> {
  const db = await getDb();
  const row = await db.query.tasks.findFirst({ where: eq(tasks.id, taskId), with: { case: true } });
  if (!row) throw new Error("Task not found.");
  return row;
}

function taskHref(t: Pick<Task, "id" | "caseId">): string {
  return `/cases/${t.caseId}?task=${t.id}`;
}

/** Case owner if they are an attorney; otherwise no specific reviewer (all attorneys). */
async function defaultReviewer(db: Db, c: Pick<Case, "ownerId">): Promise<string | null> {
  if (!c.ownerId) return null;
  const owner = await db.query.profiles.findFirst({ where: eq(profiles.id, c.ownerId) });
  return owner?.role === "attorney" && owner.isActive ? owner.id : null;
}

const taskPatch = taskInput.omit({ caseId: true, checklist: true }).partial();
export type TaskPatch = z.input<typeof taskPatch>;
type ParsedPatch = z.infer<typeof taskPatch>;

/**
 * Applies a change to a task with all of its side effects: completion time,
 * waiting follow-ups, review hand-off, audit entry and notifications.
 */
async function applyTaskPatch(db: Db, actor: Profile, existing: TaskWithCase, patch: ParsedPatch, opts: { note?: string } = {}): Promise<void> {
  const changes: Partial<Task> = {};
  const label: string[] = [];
  for (const [k, v] of Object.entries(patch) as [keyof ParsedPatch, unknown][]) {
    if (v === undefined) continue;
    const value = (v === "" ? null : v) as never;
    if ((existing as Record<string, unknown>)[k] !== value) {
      (changes as Record<string, unknown>)[k] = value;
      label.push(k);
    }
  }
  if (!label.length) return;

  const newStatus = changes.status;
  if (newStatus) {
    changes.completedAt = newStatus === "done" ? new Date() : null;
    if (newStatus === "waiting") {
      if (changes.followUpDate === undefined && !existing.followUpDate) {
        changes.followUpDate = addDaysToIso(firmTodayIso(), DEFAULT_FOLLOW_UP_DAYS);
      }
    } else if (existing.status === "waiting") {
      changes.waitingOn = null;
      changes.followUpDate = null;
    }
    if (newStatus === "review") {
      changes.reviewRequestedAt = new Date();
      if (changes.reviewerId === undefined && !existing.reviewerId) {
        const r = await defaultReviewer(db, existing.case);
        if (r) changes.reviewerId = r;
      }
    }
  }

  await db.update(tasks).set({ ...changes, updatedAt: new Date() }).where(eq(tasks.id, existing.id));
  await recordAudit(db, actor, {
    caseId: existing.caseId,
    taskId: existing.id,
    kind: newStatus ? "task_status" : "task_updated",
    description: newStatus
      ? `"${existing.title}" → ${TASK_STATUS_MAP.get(newStatus)?.label ?? newStatus}.` +
        (existing.status === "review" && newStatus === "done" ? " Approved." : "") +
        (existing.status === "review" && newStatus !== "done" ? " Returned from review." : "") +
        (opts.note ? ` Note: ${opts.note}` : "")
      : `Updated "${existing.title}" (${label.join(", ")}).`,
    fromValue: newStatus ? existing.status : null,
    toValue: newStatus ?? null,
  });
  await touchCase(db, existing.caseId);

  // Notifications ---------------------------------------------------------
  const title = changes.title ?? existing.title;
  const where = existing.case.title + (existing.case.caseNumber ? ` (${existing.case.caseNumber})` : "");
  const href = taskHref(existing);
  const assigneeId = changes.assigneeId !== undefined ? changes.assigneeId : existing.assigneeId;
  const reviewerId = changes.reviewerId !== undefined ? changes.reviewerId : existing.reviewerId;

  if (changes.assigneeId) {
    const due = changes.dueDate ?? existing.dueDate;
    await notify(db, {
      userIds: [changes.assigneeId],
      actorId: actor.id,
      kind: "assigned",
      title: `Assigned to you: ${title}`,
      body: `${where}${due ? ` · due ${due}` : ""} · from ${actor.fullName}`,
      href,
    });
  }
  if (newStatus === "review") {
    await notify(db, {
      userIds: reviewerId ? [reviewerId] : await attorneyIds(db),
      actorId: actor.id,
      kind: "review",
      title: `Ready for review: ${title}`,
      body: `${where} · sent by ${actor.fullName}`,
      href: "/review",
    });
  } else if (changes.reviewerId && (changes.status ?? existing.status) === "review") {
    await notify(db, {
      userIds: [changes.reviewerId],
      actorId: actor.id,
      kind: "review",
      title: `Please review: ${title}`,
      body: `${where} · from ${actor.fullName}`,
      href: "/review",
    });
  }
  if (existing.status === "review" && newStatus && newStatus !== "review") {
    const approved = newStatus === "done";
    await notify(db, {
      userIds: [assigneeId],
      actorId: actor.id,
      kind: approved ? "approved" : "returned",
      title: `${approved ? "Approved" : "Returned for changes"}: ${title}`,
      body: `${where} · ${actor.fullName}${opts.note ? `\n${opts.note}` : ""}`,
      href,
    });
  }
  revalidateCase(existing.case.boardId, existing.caseId);
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
    const initialStatus = input.status ?? "requested";
    const [row] = await db
      .insert(tasks)
      .values({
        caseId: input.caseId,
        parentTaskId: input.parentTaskId ?? null,
        title: input.title,
        description: input.description ?? "",
        status: initialStatus,
        lane: input.lane ?? "core",
        assigneeId: input.assigneeId ?? null,
        reviewerId: input.reviewerId ?? null,
        dueDate: input.dueDate ?? null,
        priority: input.priority ?? "normal",
        waitingOn: initialStatus === "waiting" ? (input.waitingOn ?? null) : null,
        followUpDate:
          initialStatus === "waiting" ? (input.followUpDate ?? addDaysToIso(firmTodayIso(), DEFAULT_FOLLOW_UP_DAYS)) : null,
        reviewRequestedAt: initialStatus === "review" ? new Date() : null,
        position: max + 1,
        createdBy: actor.id,
        completedAt: initialStatus === "done" ? new Date() : null,
      })
      .returning({ id: tasks.id });
    if (input.checklist?.length) {
      await db.insert(checklistItems).values(input.checklist.map((text, i) => ({ taskId: row.id, text, position: i })));
    }
    await recordAudit(db, actor, { caseId: input.caseId, taskId: row.id, kind: "task_created", description: `Added task "${input.title}".` });
    await touchCase(db, input.caseId);
    if (input.assigneeId) {
      await notify(db, {
        userIds: [input.assigneeId],
        actorId: actor.id,
        kind: "assigned",
        title: `Assigned to you: ${input.title}`,
        body: `${parent.title}${parent.caseNumber ? ` (${parent.caseNumber})` : ""}${input.dueDate ? ` · due ${input.dueDate}` : ""} · from ${actor.fullName}`,
        href: taskHref({ id: row.id, caseId: input.caseId }),
      });
    }
    revalidateCase(parent.boardId, input.caseId);
    return { id: row.id };
  });
}

export async function updateTask(taskId: string, raw: TaskPatch): Promise<ActionResult> {
  return runAction(async () => {
    const actor = await requireActor();
    const patch = taskPatch.parse(raw);
    const db = await getDb();
    const existing = await loadTask(taskId);
    await applyTaskPatch(db, actor, existing, patch);
    return undefined;
  });
}

/** Drag-and-drop move between status columns. */
export async function moveTask(taskId: string, toStatus: z.infer<typeof status>): Promise<ActionResult> {
  return updateTask(taskId, { status: status.parse(toStatus) });
}

async function addTaskComment(db: Db, actor: Profile, t: TaskWithCase, body: string): Promise<void> {
  await db.insert(comments).values({ caseId: t.caseId, taskId: t.id, authorId: actor.id, authorName: actor.fullName, body });
}

/** Attorney approves a task in review: it moves to Done. */
export async function approveTask(taskId: string, note?: string): Promise<ActionResult> {
  return runAction(async () => {
    const actor = await requireAttorneyActor();
    const db = await getDb();
    const existing = await loadTask(taskId);
    const clean = note?.trim() || undefined;
    await applyTaskPatch(db, actor, existing, { status: "done" }, { note: clean });
    if (clean) await addTaskComment(db, actor, existing, `Approved: ${clean}`);
    return undefined;
  });
}

/** Attorney sends a task back from review with a required note. */
export async function returnTask(taskId: string, note: string): Promise<ActionResult> {
  return runAction(async () => {
    const actor = await requireAttorneyActor();
    const clean = z.string().trim().min(3, "Say what needs to change.").max(5000).parse(note);
    const db = await getDb();
    const existing = await loadTask(taskId);
    await applyTaskPatch(db, actor, existing, { status: "in_progress" }, { note: clean });
    await addTaskComment(db, actor, existing, `Returned from review: ${clean}`);
    return undefined;
  });
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
    const actor = await requireActor();
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
    if (patch.assigneeId && patch.assigneeId !== item.assigneeId) {
      const due = patch.dueDate !== undefined ? patch.dueDate : item.dueDate;
      await notify(db, {
        userIds: [patch.assigneeId],
        actorId: actor.id,
        kind: "assigned",
        title: `Checklist item for you: ${patch.text ?? item.text}`,
        body: `${existing.title} · ${existing.case.title}${due ? ` · due ${due}` : ""} · from ${actor.fullName}`,
        href: taskHref(existing),
      });
    }
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
    const actor = await requireActor();
    const db = await getDb();
    const row = await db.query.tasks.findFirst({
      where: eq(tasks.id, taskId),
      with: {
        case: { columns: { id: true, title: true, boardId: true, caseNumber: true, ownerId: true } },
        assignee: { columns: { fullName: true } },
        reviewer: { columns: { fullName: true } },
        checklist: { orderBy: [asc(checklistItems.position)], with: { assignee: { columns: { fullName: true } } } },
        subtasks: { orderBy: [asc(tasks.position)], with: { assignee: { columns: { fullName: true } } } },
        comments: { orderBy: (c, { asc }) => [asc(c.createdAt)] },
        attachments: { orderBy: (a, { asc }) => [asc(a.createdAt)] },
      },
    });
    if (!row) throw new Error("Task not found.");
    return { ...row, canReview: isAttorney(actor) };
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
