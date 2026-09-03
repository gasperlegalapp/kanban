"use server";

import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { cases, events } from "@/db/schema";
import { requireActor } from "@/lib/auth/session";
import { recordAudit, touchCase } from "@/lib/services/audit";
import { runAction, type ActionResult } from "./result";
import { revalidateCase } from "./revalidate";

const eventInput = z.object({
  caseId: z.uuid(),
  kind: z.enum(["hearing", "deadline"]),
  title: z.string().trim().min(1).max(200),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
  notes: z.string().max(5000).optional(),
});
export type EventInput = z.input<typeof eventInput>;

export async function createEvent(raw: EventInput): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const actor = await requireActor();
    const input = eventInput.parse(raw);
    const db = await getDb();
    const parent = await db.query.cases.findFirst({ where: eq(cases.id, input.caseId) });
    if (!parent) throw new Error("Case not found.");
    const [row] = await db
      .insert(events)
      .values({ ...input, time: input.time ?? null, notes: input.notes ?? "", createdBy: actor.id })
      .returning({ id: events.id });
    await recordAudit(db, actor, {
      caseId: input.caseId,
      kind: "event_created",
      description: `Added ${input.kind} "${input.title}" on ${input.date}.`,
    });
    await touchCase(db, input.caseId);
    revalidateCase(parent.boardId, input.caseId);
    return { id: row.id };
  });
}

const eventPatch = eventInput.omit({ caseId: true }).partial().extend({
  status: z.enum(["pending", "done", "cancelled"]).optional(),
});
export type EventPatch = z.input<typeof eventPatch>;

export async function updateEvent(eventId: string, raw: EventPatch): Promise<ActionResult> {
  return runAction(async () => {
    const actor = await requireActor();
    const patch = eventPatch.parse(raw);
    const db = await getDb();
    const existing = await db.query.events.findFirst({ where: eq(events.id, eventId), with: { case: true } });
    if (!existing) throw new Error("Event not found.");
    await db
      .update(events)
      .set({
        ...(patch.title !== undefined ? { title: patch.title } : {}),
        ...(patch.kind !== undefined ? { kind: patch.kind } : {}),
        ...(patch.date !== undefined ? { date: patch.date } : {}),
        ...(patch.time !== undefined ? { time: patch.time } : {}),
        ...(patch.notes !== undefined ? { notes: patch.notes } : {}),
        ...(patch.status !== undefined ? { status: patch.status } : {}),
      })
      .where(eq(events.id, eventId));
    await recordAudit(db, actor, {
      caseId: existing.caseId,
      kind: "event_updated",
      description:
        patch.status && patch.status !== existing.status
          ? `${existing.title} marked ${patch.status}.`
          : `Updated ${existing.kind} "${patch.title ?? existing.title}".`,
      fromValue: patch.date && patch.date !== existing.date ? existing.date : null,
      toValue: patch.date && patch.date !== existing.date ? patch.date : null,
    });
    await touchCase(db, existing.caseId);
    revalidateCase(existing.case.boardId, existing.caseId);
    return undefined;
  });
}

export async function deleteEvent(eventId: string): Promise<ActionResult> {
  return runAction(async () => {
    const actor = await requireActor();
    const db = await getDb();
    const existing = await db.query.events.findFirst({ where: eq(events.id, eventId), with: { case: true } });
    if (!existing) return undefined;
    await db.delete(events).where(eq(events.id, eventId));
    await recordAudit(db, actor, { caseId: existing.caseId, kind: "event_deleted", description: `Removed ${existing.kind} "${existing.title}".` });
    revalidateCase(existing.case.boardId, existing.caseId);
    return undefined;
  });
}
