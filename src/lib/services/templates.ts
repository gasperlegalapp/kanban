import { and, asc, eq, sql } from "drizzle-orm";
import type { Db } from "@/db";
import { checklistItems, tasks, templateSets, templateTasks, type Case, type Profile, type Stage } from "@/db/schema";
import { addDaysIso, anchorDate } from "@/lib/domain/deadlines";
import { alreadyHasTask } from "@/lib/domain/template-match";
import { recordAudit } from "./audit";

type Actor = Pick<Profile, "id" | "fullName"> | null;
type CaseForTemplates = Pick<Case, "id" | "appointmentDate" | "dateOfDeath" | "createdAt">;

/**
 * Creates the tasks (with checklists) from a template set on a case and
 * returns how many were created. With `skipExisting`, template tasks the case
 * already has (matched loosely by title) are left out, so automatic runs never
 * duplicate work that was entered by hand or imported.
 */
export async function applyTemplateSet(
  db: Db,
  actor: Actor,
  c: CaseForTemplates,
  setId: string,
  opts: { skipExisting?: boolean; reason?: string } = {},
): Promise<number> {
  const set = await db.query.templateSets.findFirst({
    where: eq(templateSets.id, setId),
    with: { tasks: { orderBy: [asc(templateTasks.position)] } },
  });
  if (!set) throw new Error("Template not found.");

  let toCreate = set.tasks;
  if (opts.skipExisting) {
    const existing = await db.select({ title: tasks.title }).from(tasks).where(eq(tasks.caseId, c.id));
    const titles = existing.map((e) => e.title);
    toCreate = set.tasks.filter((t) => !alreadyHasTask(titles, t.title));
  }
  if (!toCreate.length) return 0;

  const [{ max }] = await db
    .select({ max: sql<number>`coalesce(max(${tasks.position}), -1)::int` })
    .from(tasks)
    .where(eq(tasks.caseId, c.id));
  let position = max + 1;

  for (const t of toCreate) {
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

  const skipped = set.tasks.length - toCreate.length;
  await recordAudit(db, actor, {
    caseId: c.id,
    kind: "template_applied",
    description:
      `${opts.reason ? `${opts.reason}: added` : "Added"} ${toCreate.length} task${toCreate.length === 1 ? "" : "s"} from template "${set.name}"` +
      (skipped ? ` (${skipped} already on the case).` : "."),
  });
  return toCreate.length;
}

/** Template sets flagged "create on every new case" for the board. */
export async function applyDefaultTemplates(db: Db, actor: Actor, c: CaseForTemplates & Pick<Case, "boardId">): Promise<number> {
  const sets = await db
    .select({ id: templateSets.id })
    .from(templateSets)
    .where(and(eq(templateSets.boardId, c.boardId), eq(templateSets.applyOnCreate, true)))
    .orderBy(asc(templateSets.position));
  let created = 0;
  for (const s of sets) created += await applyTemplateSet(db, actor, c, s.id, { skipExisting: true, reason: "New case" });
  return created;
}

/** Template sets that run when a case enters `stage`. Returns tasks created. */
export async function applyStageTemplates(db: Db, actor: Actor, c: CaseForTemplates, stage: Pick<Stage, "id" | "name">): Promise<number> {
  const sets = await db
    .select({ id: templateSets.id })
    .from(templateSets)
    .where(eq(templateSets.triggerStageId, stage.id))
    .orderBy(asc(templateSets.position));
  let created = 0;
  for (const s of sets) created += await applyTemplateSet(db, actor, c, s.id, { skipExisting: true, reason: `Entered ${stage.name}` });
  return created;
}
