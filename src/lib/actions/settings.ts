"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/db";
import { caseTypes, deadlineRules, lanes, settings, stages } from "@/db/schema";
import { requireAttorneyActor } from "@/lib/auth/session";
import { runAction, type ActionResult } from "./result";

const generalInput = z.object({
  firm_name: z.string().trim().min(1).max(120),
  actionstep_base_url: z.string().trim().max(300),
  reminder_days_before: z.array(z.number().int().min(0).max(90)).max(6),
});

export async function updateGeneralSettings(raw: z.input<typeof generalInput>): Promise<ActionResult> {
  return runAction(async () => {
    await requireAttorneyActor();
    const input = generalInput.parse(raw);
    const db = await getDb();
    for (const [key, value] of Object.entries(input)) {
      await db
        .insert(settings)
        .values({ key, value })
        .onConflictDoUpdate({ target: settings.key, set: { value, updatedAt: new Date() } });
    }
    revalidatePath("/settings");
    return undefined;
  });
}

const stageInput = z.object({
  stuckDays: z.number().int().min(0).max(3650).nullable(),
  criticalDays: z.number().int().min(0).max(3650).nullable(),
  policy: z.string().trim().max(1000).nullable().optional(),
});

export async function updateStage(id: string, raw: z.input<typeof stageInput>): Promise<ActionResult> {
  return runAction(async () => {
    await requireAttorneyActor();
    const input = stageInput.parse(raw);
    const db = await getDb();
    await db.update(stages).set({ stuckDays: input.stuckDays, criticalDays: input.criticalDays, ...(input.policy !== undefined ? { policy: input.policy } : {}) }).where(eq(stages.id, id));
    revalidatePath("/settings");
    revalidatePath("/", "layout");
    return undefined;
  });
}

const ruleInput = z.object({
  boardId: z.string().min(1),
  title: z.string().trim().min(1).max(120),
  kind: z.enum(["hearing", "deadline"]).optional(),
  anchor: z.enum(["appointment_date", "date_of_death", "case_opened"]),
  offsetDays: z.number().int().min(-365).max(3650),
  isActive: z.boolean().optional(),
  notes: z.string().trim().max(500).optional(),
});

export async function createDeadlineRule(raw: z.input<typeof ruleInput>): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    await requireAttorneyActor();
    const input = ruleInput.parse(raw);
    const db = await getDb();
    const key = `${input.title.toLowerCase().replace(/[^a-z0-9]+/g, "_")}_${Date.now().toString(36)}`;
    const [row] = await db
      .insert(deadlineRules)
      .values({ boardId: input.boardId, key, title: input.title, kind: input.kind ?? "deadline", anchor: input.anchor, offsetDays: input.offsetDays, isActive: input.isActive ?? true, notes: input.notes ?? "" })
      .returning({ id: deadlineRules.id });
    revalidatePath("/settings");
    return { id: row.id };
  });
}

export async function updateDeadlineRule(id: string, raw: Partial<z.input<typeof ruleInput>>): Promise<ActionResult> {
  return runAction(async () => {
    await requireAttorneyActor();
    const patch = ruleInput.omit({ boardId: true }).partial().parse(raw);
    const db = await getDb();
    await db
      .update(deadlineRules)
      .set({
        ...(patch.title !== undefined ? { title: patch.title } : {}),
        ...(patch.kind !== undefined ? { kind: patch.kind } : {}),
        ...(patch.anchor !== undefined ? { anchor: patch.anchor } : {}),
        ...(patch.offsetDays !== undefined ? { offsetDays: patch.offsetDays } : {}),
        ...(patch.isActive !== undefined ? { isActive: patch.isActive } : {}),
        ...(patch.notes !== undefined ? { notes: patch.notes } : {}),
      })
      .where(eq(deadlineRules.id, id));
    revalidatePath("/settings");
    return undefined;
  });
}

export async function deleteDeadlineRule(id: string): Promise<ActionResult> {
  return runAction(async () => {
    await requireAttorneyActor();
    const db = await getDb();
    await db.delete(deadlineRules).where(eq(deadlineRules.id, id));
    revalidatePath("/settings");
    return undefined;
  });
}

const laneInput = z.object({ boardId: z.string().min(1), name: z.string().trim().min(1).max(80) });

export async function createLane(raw: z.input<typeof laneInput>): Promise<ActionResult> {
  return runAction(async () => {
    await requireAttorneyActor();
    const input = laneInput.parse(raw);
    const db = await getDb();
    const existing = await db.select().from(lanes).where(eq(lanes.boardId, input.boardId));
    await db.insert(lanes).values({ boardId: input.boardId, key: `${input.name.toLowerCase().replace(/[^a-z0-9]+/g, "_")}_${Date.now().toString(36)}`, name: input.name, position: existing.length });
    revalidatePath("/settings");
    revalidatePath("/", "layout");
    return undefined;
  });
}

export async function renameLane(id: string, name: string): Promise<ActionResult> {
  return runAction(async () => {
    await requireAttorneyActor();
    const db = await getDb();
    await db.update(lanes).set({ name: z.string().trim().min(1).max(80).parse(name) }).where(eq(lanes.id, id));
    revalidatePath("/settings");
    revalidatePath("/", "layout");
    return undefined;
  });
}

const typeInput = z.object({ boardId: z.string().min(1), name: z.string().trim().min(1).max(80), prefix: z.string().trim().max(10).optional(), color: z.string().regex(/^#[0-9a-fA-F]{6}$/) });

export async function createCaseType(raw: z.input<typeof typeInput>): Promise<ActionResult> {
  return runAction(async () => {
    await requireAttorneyActor();
    const input = typeInput.parse(raw);
    const db = await getDb();
    const existing = await db.select().from(caseTypes).where(eq(caseTypes.boardId, input.boardId));
    await db.insert(caseTypes).values({
      boardId: input.boardId,
      key: `${input.name.toLowerCase().replace(/[^a-z0-9]+/g, "_")}_${Date.now().toString(36)}`,
      name: input.name,
      prefix: input.prefix || null,
      color: input.color,
      position: existing.length,
    });
    revalidatePath("/settings");
    revalidatePath("/", "layout");
    return undefined;
  });
}

export async function updateCaseType(id: string, raw: Partial<z.input<typeof typeInput>>): Promise<ActionResult> {
  return runAction(async () => {
    await requireAttorneyActor();
    const patch = typeInput.omit({ boardId: true }).partial().parse(raw);
    const db = await getDb();
    await db
      .update(caseTypes)
      .set({
        ...(patch.name !== undefined ? { name: patch.name } : {}),
        ...(patch.prefix !== undefined ? { prefix: patch.prefix || null } : {}),
        ...(patch.color !== undefined ? { color: patch.color } : {}),
      })
      .where(eq(caseTypes.id, id));
    revalidatePath("/settings");
    revalidatePath("/", "layout");
    return undefined;
  });
}
