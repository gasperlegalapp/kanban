import { and, eq } from "drizzle-orm";
import type { Db } from "@/db";
import { deadlineRules, events, type Case, type Profile } from "@/db/schema";
import { computeDeadlines } from "@/lib/domain/deadlines";
import { recordAudit } from "./audit";

/**
 * Creates or updates the rule-generated deadlines for a case (inventory due,
 * final account due, ...). Existing pending events created by a rule are moved
 * when the anchor date changes; events already marked done are left alone.
 */
export async function syncRuleDeadlines(
  db: Db,
  actor: Pick<Profile, "id" | "fullName"> | null,
  c: Pick<Case, "id" | "boardId" | "appointmentDate" | "dateOfDeath" | "createdAt">,
): Promise<{ created: number; updated: number }> {
  const rules = await db.select().from(deadlineRules).where(eq(deadlineRules.boardId, c.boardId));
  const computed = computeDeadlines(c, rules);
  const existing = await db.select().from(events).where(eq(events.caseId, c.id));
  let created = 0;
  let updated = 0;

  for (const d of computed) {
    const hit = existing.find((e) => e.ruleKey === d.ruleKey);
    if (!hit) {
      await db.insert(events).values({
        caseId: c.id,
        kind: d.kind,
        title: d.title,
        date: d.date,
        ruleKey: d.ruleKey,
        createdBy: actor?.id ?? null,
      });
      created++;
    } else if (hit.status === "pending" && hit.date !== d.date) {
      await db
        .update(events)
        .set({ date: d.date })
        .where(and(eq(events.id, hit.id), eq(events.status, "pending")));
      updated++;
    }
  }

  if (created || updated) {
    await recordAudit(db, actor, {
      caseId: c.id,
      kind: "event_updated",
      description: `Deadlines recalculated: ${created} added, ${updated} moved.`,
    });
  }
  return { created, updated };
}
