import { eq } from "drizzle-orm";
import type { Db } from "@/db";
import { auditLog, cases, type AuditKind, type Profile } from "@/db/schema";

export type AuditInput = {
  caseId: string | null;
  taskId?: string | null;
  kind: AuditKind;
  description: string;
  fromValue?: string | null;
  toValue?: string | null;
  reason?: string | null;
};

export async function recordAudit(db: Db, actor: Pick<Profile, "id" | "fullName"> | null, input: AuditInput): Promise<void> {
  await db.insert(auditLog).values({
    caseId: input.caseId,
    taskId: input.taskId ?? null,
    actorId: actor?.id ?? null,
    actorName: actor?.fullName ?? "System",
    kind: input.kind,
    description: input.description,
    fromValue: input.fromValue ?? null,
    toValue: input.toValue ?? null,
    reason: input.reason ?? null,
  });
}

/** Bumps the case's last-activity timestamp. */
export async function touchCase(db: Db, caseId: string): Promise<void> {
  await db.update(cases).set({ lastActivityAt: new Date() }).where(eq(cases.id, caseId));
}
