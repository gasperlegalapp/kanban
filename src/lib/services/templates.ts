import { asc, eq, sql } from "drizzle-orm";
import type { Db } from "@/db";
import { checklistItems, tasks, templateSets, templateTasks, type Case, type Profile } from "@/db/schema";
import { addDaysIso, anchorDate } from "@/lib/domain/deadlines";
import { recordAudit } from "./audit";

/**
 * Creates the tasks (with checklists) from a template set on a case.
 * Returns the number of tasks created.
 */
export async function applyTemplateSet(
  db: Db,
  actor: Pick<Profile, "id" | "fullName"> | null,
  c: Pick<Case, "id" | "appointmentDate" | "dateOfDeath" | "createdAt">,
  setId: string,
): Promise<number> {
  const set = await db.query.templateSets.findFirst({
    where: eq(templateSets.id, setId),
    with: { tasks: { orderBy: [asc(templateTasks.position)] } },
  });
  if (!set) throw new Error("Template not found.");

  const [{ max }] = await db
    .select({ max: sql<number>`coalesce(max(${tasks.position}), -1)::int` })
    .from(tasks)
    .where(eq(tasks.caseId, c.id));
  let position = max + 1;

  for (const t of set.tasks) {
    let dueDate: string | null = null;
    if (t.dueAnchor && t.dueOffsetDays !== null) {
      const base = anchorDate(c, t.dueAnchor);
      if (base) dueDate = addDaysIso(base, t.dueOffsetDays);
    }
    const [row] = await db
      .insert(tasks)
      .values({
        caseId: c.id,
        title: t.title,
        description: t.description,
        lane: t.lane,
        status: "requested",
        position: position++,
        dueDate,
        templateKey: `${set.key}:${t.id}`,
        createdBy: actor?.id ?? null,
      })
      .returning({ id: tasks.id });
    if (t.checklist.length) {
      await db.insert(checklistItems).values(t.checklist.map((text, i) => ({ taskId: row.id, text, position: i })));
    }
  }

  await recordAudit(db, actor, {
    caseId: c.id,
    kind: "template_applied",
    description: `Applied template "${set.name}" (${set.tasks.length} task${set.tasks.length === 1 ? "" : "s"}).`,
  });
  return set.tasks.length;
}

/** Applies every template set flagged for new cases on the board. */
export async function applyDefaultTemplates(
  db: Db,
  actor: Pick<Profile, "id" | "fullName"> | null,
  c: Pick<Case, "id" | "boardId" | "appointmentDate" | "dateOfDeath" | "createdAt">,
): Promise<void> {
  const sets = await db
    .select({ id: templateSets.id })
    .from(templateSets)
    .where(sql`${templateSets.boardId} = ${c.boardId} and ${templateSets.applyOnCreate} = true`)
    .orderBy(asc(templateSets.position));
  for (const s of sets) await applyTemplateSet(db, actor, c, s.id);
}
