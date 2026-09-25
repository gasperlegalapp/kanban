"use server";

import { and, asc, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/db";
import { stages, templateSets, templateTasks } from "@/db/schema";
import { requireAttorneyActor } from "@/lib/auth/session";
import { runAction, type ActionResult } from "./result";

const lane = z.enum(["core", "assets", "litigation", "social"]);
const anchor = z.enum(["appointment_date", "date_of_death", "case_opened"]);

const setInput = z.object({
  boardId: z.string().min(1),
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).optional(),
  applyOnCreate: z.boolean().optional(),
  triggerStageId: z.uuid().nullable().optional(),
  repeat: z.enum(["once", "every_time"]).optional(),
});

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || "set";
}

export async function createTemplateSet(raw: z.input<typeof setInput>): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    await requireAttorneyActor();
    const input = setInput.parse(raw);
    const db = await getDb();
    const [{ max }] = await db.select({ max: sql<number>`coalesce(max(${templateSets.position}), -1)::int` }).from(templateSets).where(eq(templateSets.boardId, input.boardId));
    const [row] = await db
      .insert(templateSets)
      .values({
        boardId: input.boardId,
        key: `${slug(input.name)}_${Date.now().toString(36)}`,
        name: input.name,
        description: input.description ?? "",
        applyOnCreate: input.applyOnCreate ?? false,
        triggerStageId: input.triggerStageId ?? null,
        repeat: input.repeat ?? "once",
        position: max + 1,
      })
      .returning({ id: templateSets.id });
    revalidatePath("/templates");
    return { id: row.id };
  });
}

export async function updateTemplateSet(id: string, raw: Partial<z.input<typeof setInput>>): Promise<ActionResult> {
  return runAction(async () => {
    await requireAttorneyActor();
    const patch = setInput.partial().parse(raw);
    const db = await getDb();
    await db
      .update(templateSets)
      .set({
        ...(patch.name !== undefined ? { name: patch.name } : {}),
        ...(patch.description !== undefined ? { description: patch.description } : {}),
        ...(patch.applyOnCreate !== undefined ? { applyOnCreate: patch.applyOnCreate } : {}),
        ...(patch.triggerStageId !== undefined ? { triggerStageId: patch.triggerStageId } : {}),
        ...(patch.repeat !== undefined ? { repeat: patch.repeat } : {}),
      })
      .where(eq(templateSets.id, id));
    revalidatePath("/templates");
    return undefined;
  });
}

export async function deleteTemplateSet(id: string): Promise<ActionResult> {
  return runAction(async () => {
    await requireAttorneyActor();
    const db = await getDb();
    await db.delete(templateSets).where(eq(templateSets.id, id));
    revalidatePath("/templates");
    return undefined;
  });
}

const taskInput = z.object({
  setId: z.uuid(),
  assigneeId: z.uuid().nullable().optional(),
  assignToOwner: z.boolean().optional(),
  dueFromCreation: z.boolean().optional(),
  title: z.string().trim().min(1).max(200),
  description: z.string().max(5000).optional(),
  lane: lane.optional(),
  checklist: z.array(z.string().trim().min(1).max(300)).optional(),
  dueAnchor: anchor.nullable().optional(),
  dueOffsetDays: z.number().int().min(-365).max(3650).nullable().optional(),
});

type DueInput = { dueAnchor?: z.infer<typeof anchor> | null; dueFromCreation?: boolean; dueOffsetDays?: number | null };

/** A task is due from creation or from a case date, never both. */
function dueFields(i: DueInput) {
  const fromCreation = i.dueFromCreation ?? false;
  const anchorValue = fromCreation ? null : (i.dueAnchor ?? null);
  return { dueFromCreation: fromCreation, dueAnchor: anchorValue, dueOffsetDays: fromCreation || anchorValue ? (i.dueOffsetDays ?? 0) : null };
}

function assigneeFields(i: { assigneeId?: string | null; assignToOwner?: boolean }) {
  const toOwner = i.assignToOwner ?? false;
  return { assignToOwner: toOwner, assigneeId: toOwner ? null : (i.assigneeId ?? null) };
}

/**
 * The template set that runs when a case enters `stageId`, created (named
 * after the column) if the column has none yet. Used by the column view.
 */
export async function ensureStageTemplateSet(stageId: string): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    await requireAttorneyActor();
    const db = await getDb();
    const existing = await db.query.templateSets.findFirst({ where: eq(templateSets.triggerStageId, stageId), orderBy: [asc(templateSets.position)] });
    if (existing) return { id: existing.id };
    const stage = await db.query.stages.findFirst({ where: eq(stages.id, stageId) });
    if (!stage) throw new Error("Column not found.");
    const [{ max }] = await db.select({ max: sql<number>`coalesce(max(${templateSets.position}), -1)::int` }).from(templateSets).where(eq(templateSets.boardId, stage.boardId));
    const [row] = await db
      .insert(templateSets)
      .values({
        boardId: stage.boardId,
        key: `${slug(stage.name)}_${Date.now().toString(36)}`,
        name: stage.name,
        description: `Created when a case enters ${stage.name}.`,
        triggerStageId: stage.id,
        position: max + 1,
      })
      .returning({ id: templateSets.id });
    revalidatePath("/templates");
    return { id: row.id };
  });
}

export async function createTemplateTask(raw: z.input<typeof taskInput>): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    await requireAttorneyActor();
    const input = taskInput.parse(raw);
    const db = await getDb();
    const [{ max }] = await db.select({ max: sql<number>`coalesce(max(${templateTasks.position}), -1)::int` }).from(templateTasks).where(eq(templateTasks.setId, input.setId));
    const [row] = await db
      .insert(templateTasks)
      .values({
        setId: input.setId,
        title: input.title,
        description: input.description ?? "",
        lane: input.lane ?? "core",
        checklist: input.checklist ?? [],
        ...dueFields(input),
        ...assigneeFields(input),
        position: max + 1,
      })
      .returning({ id: templateTasks.id });
    revalidatePath("/templates");
    return { id: row.id };
  });
}

export async function updateTemplateTask(id: string, raw: Partial<z.input<typeof taskInput>>): Promise<ActionResult> {
  return runAction(async () => {
    await requireAttorneyActor();
    const patch = taskInput.omit({ setId: true }).partial().parse(raw);
    const db = await getDb();
    await db
      .update(templateTasks)
      .set({
        ...(patch.title !== undefined ? { title: patch.title } : {}),
        ...(patch.description !== undefined ? { description: patch.description } : {}),
        ...(patch.lane !== undefined ? { lane: patch.lane } : {}),
        ...(patch.checklist !== undefined ? { checklist: patch.checklist } : {}),
        ...(patch.dueAnchor !== undefined || patch.dueFromCreation !== undefined ? dueFields(patch) : {}),
        ...(patch.assigneeId !== undefined || patch.assignToOwner !== undefined ? assigneeFields(patch) : {}),
      })
      .where(eq(templateTasks.id, id));
    revalidatePath("/templates");
    return undefined;
  });
}

export async function deleteTemplateTask(id: string): Promise<ActionResult> {
  return runAction(async () => {
    await requireAttorneyActor();
    const db = await getDb();
    await db.delete(templateTasks).where(eq(templateTasks.id, id));
    revalidatePath("/templates");
    return undefined;
  });
}

export async function moveTemplateTask(id: string, direction: "up" | "down"): Promise<ActionResult> {
  return runAction(async () => {
    await requireAttorneyActor();
    const db = await getDb();
    const row = await db.query.templateTasks.findFirst({ where: eq(templateTasks.id, id) });
    if (!row) return undefined;
    const siblings = await db.select().from(templateTasks).where(eq(templateTasks.setId, row.setId)).orderBy(asc(templateTasks.position));
    const idx = siblings.findIndex((s) => s.id === id);
    const swap = direction === "up" ? idx - 1 : idx + 1;
    if (swap < 0 || swap >= siblings.length) return undefined;
    const ordered = [...siblings];
    [ordered[idx], ordered[swap]] = [ordered[swap], ordered[idx]];
    for (const [i, t] of ordered.entries()) {
      await db.update(templateTasks).set({ position: i }).where(and(eq(templateTasks.id, t.id)));
    }
    revalidatePath("/templates");
    return undefined;
  });
}
