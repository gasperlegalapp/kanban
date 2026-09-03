"use server";

import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { attachments, cases, tasks } from "@/db/schema";
import { isAttorney, requireActor } from "@/lib/auth/session";
import { recordAudit, touchCase } from "@/lib/services/audit";
import { getStorage, safeFileName } from "@/lib/storage";
import { runAction, type ActionResult } from "./result";
import { revalidateCase } from "./revalidate";

const MAX_BYTES = 25 * 1024 * 1024;

export async function uploadAttachment(formData: FormData): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const actor = await requireActor();
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) throw new Error("Choose a file first.");
    if (file.size > MAX_BYTES) throw new Error("Files must be 25 MB or smaller.");
    const taskId = String(formData.get("taskId") ?? "") || null;
    let caseId = String(formData.get("caseId") ?? "") || null;
    const db = await getDb();
    if (taskId) {
      const t = await db.query.tasks.findFirst({ where: eq(tasks.id, taskId) });
      if (!t) throw new Error("Task not found.");
      caseId = t.caseId;
    }
    if (!caseId) throw new Error("Attachment needs a case.");
    const parent = await db.query.cases.findFirst({ where: eq(cases.id, caseId) });
    if (!parent) throw new Error("Case not found.");

    const fileName = safeFileName(file.name);
    const key = `${caseId}/${randomUUID()}-${fileName}`;
    await getStorage().put(key, Buffer.from(await file.arrayBuffer()), file.type || "application/octet-stream");
    const [row] = await db
      .insert(attachments)
      .values({ caseId, taskId, fileName, contentType: file.type || "application/octet-stream", sizeBytes: file.size, storageKey: key, uploadedBy: actor.id })
      .returning({ id: attachments.id });
    await recordAudit(db, actor, { caseId, taskId, kind: "attachment", description: `Attached ${fileName}.` });
    await touchCase(db, caseId);
    revalidateCase(parent.boardId, caseId);
    return { id: row.id };
  });
}

export async function deleteAttachment(id: string): Promise<ActionResult> {
  return runAction(async () => {
    const actor = await requireActor();
    const db = await getDb();
    const row = await db.query.attachments.findFirst({ where: eq(attachments.id, id), with: { case: true } });
    if (!row) return undefined;
    if (row.uploadedBy !== actor.id && !isAttorney(actor)) throw new Error("Only the uploader or an attorney can remove a file.");
    await getStorage().remove(row.storageKey);
    await db.delete(attachments).where(eq(attachments.id, id));
    if (row.caseId) {
      await recordAudit(db, actor, { caseId: row.caseId, kind: "attachment", description: `Removed ${row.fileName}.` });
      if (row.case) revalidateCase(row.case.boardId, row.caseId);
    }
    return undefined;
  });
}
