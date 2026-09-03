"use server";

import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { cases, comments, tasks } from "@/db/schema";
import { isAttorney, requireActor } from "@/lib/auth/session";
import { recordAudit, touchCase } from "@/lib/services/audit";
import { runAction, type ActionResult } from "./result";
import { revalidateCase } from "./revalidate";

const commentInput = z.object({
  caseId: z.uuid().nullable().optional(),
  taskId: z.uuid().nullable().optional(),
  body: z.string().trim().min(1, "Write something first.").max(10000),
});

export async function addComment(raw: z.input<typeof commentInput>): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const actor = await requireActor();
    const input = commentInput.parse(raw);
    const db = await getDb();
    let caseId = input.caseId ?? null;
    if (input.taskId) {
      const t = await db.query.tasks.findFirst({ where: eq(tasks.id, input.taskId) });
      if (!t) throw new Error("Task not found.");
      caseId = t.caseId;
    }
    if (!caseId) throw new Error("A comment needs a case or task.");
    const parent = await db.query.cases.findFirst({ where: eq(cases.id, caseId) });
    if (!parent) throw new Error("Case not found.");
    const [row] = await db
      .insert(comments)
      .values({ caseId, taskId: input.taskId ?? null, authorId: actor.id, authorName: actor.fullName, body: input.body })
      .returning({ id: comments.id });
    await recordAudit(db, actor, {
      caseId,
      taskId: input.taskId ?? null,
      kind: "comment",
      description: input.body.length > 140 ? input.body.slice(0, 137) + "…" : input.body,
    });
    await touchCase(db, caseId);
    revalidateCase(parent.boardId, caseId);
    return { id: row.id };
  });
}

export async function deleteComment(commentId: string): Promise<ActionResult> {
  return runAction(async () => {
    const actor = await requireActor();
    const db = await getDb();
    const existing = await db.query.comments.findFirst({ where: eq(comments.id, commentId), with: { case: true } });
    if (!existing) return undefined;
    if (existing.authorId !== actor.id && !isAttorney(actor)) throw new Error("You can only delete your own comments.");
    await db.delete(comments).where(eq(comments.id, commentId));
    if (existing.case) revalidateCase(existing.case.boardId, existing.caseId);
    return undefined;
  });
}
