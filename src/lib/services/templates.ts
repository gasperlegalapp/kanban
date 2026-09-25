import { and, asc, eq, inArray, ne, sql } from "drizzle-orm";
import type { Db } from "@/db";
import { checklistItems, profiles, tasks, templateRuns, templateSets, templateTasks, type Case, type Profile, type Stage } from "@/db/schema";
import { firmTodayIso } from "@/lib/dates";
import { addDaysIso, anchorDate } from "@/lib/domain/deadlines";
import { alreadyHasTask } from "@/lib/domain/template-match";
import { recordAudit } from "./audit";
import { notify } from "./notify";

type Actor = Pick<Profile, "id" | "fullName"> | null;
type CaseForTemplates = Pick<Case, "id" | "title" | "ownerId" | "appointmentDate" | "dateOfDeath" | "createdAt">;

/**
 * Creates the tasks (with checklists) from a template set on a case and
 * returns how many were created.
 *
 * `auto` is set for automatic runs (new case, stage entry). A "once" set then
 * runs only if the case has never had it, and skips tasks the case already has
 * (matched loosely by title, so imported or hand-entered work is not doubled).
 * An "every_time" set runs on each entry but skips tasks still open from a
 * previous run. Manual runs from the case page always create every task.
 */
export async function applyTemplateSet(
  db: Db,
  actor: Actor,
  c: CaseForTemplates,
  setId: string,
  opts: { auto?: boolean; reason?: string } = {},
): Promise<number> {
  const set = await db.query.templateSets.findFirst({
    where: eq(templateSets.id, setId),
    with: { tasks: { orderBy: [asc(templateTasks.position)] } },
  });
  if (!set) throw new Error("Template not found.");

  let toCreate = set.tasks;
  if (opts.auto) {
    if (set.repeat === "once") {
      const [ran] = await db
        .select({ id: templateRuns.id })
        .from(templateRuns)
        .where(and(eq(templateRuns.caseId, c.id), eq(templateRuns.setId, set.id)))
        .limit(1);
      if (ran) return 0;
    }
    const existing = await db
      .select({ title: tasks.title })
      .from(tasks)
      .where(set.repeat === "once" ? eq(tasks.caseId, c.id) : and(eq(tasks.caseId, c.id), ne(tasks.status, "done")));
    const titles = existing.map((e) => e.title);
    toCreate = set.tasks.filter((t) => !alreadyHasTask(titles, t.title));
  }
  await db.insert(templateRuns).values({ caseId: c.id, setId: set.id });
  if (!toCreate.length) return 0;

  // Default assignees, limited to people who are still active.
  const wanted = [...new Set(toCreate.map((t) => (t.assignToOwner ? c.ownerId : t.assigneeId)).filter((id): id is string => !!id))];
  const active = new Set(
    wanted.length
      ? (await db.select({ id: profiles.id }).from(profiles).where(and(inArray(profiles.id, wanted), eq(profiles.isActive, true)))).map((p) => p.id)
      : [],
  );
  const today = firmTodayIso();
  const assigned = new Map<string, string[]>();

  const [{ max }] = await db
    .select({ max: sql<number>`coalesce(max(${tasks.position}), -1)::int` })
    .from(tasks)
    .where(eq(tasks.caseId, c.id));
  let position = max + 1;

  for (const t of toCreate) {
    let dueDate: string | null = null;
    if (t.dueOffsetDays !== null && (t.dueFromCreation || t.dueAnchor)) {
      const base = t.dueFromCreation ? today : anchorDate(c, t.dueAnchor!);
      if (base) dueDate = addDaysIso(base, t.dueOffsetDays);
    }
    const who = t.assignToOwner ? c.ownerId : t.assigneeId;
    const assigneeId = who && active.has(who) ? who : null;
    if (assigneeId) assigned.set(assigneeId, [...(assigned.get(assigneeId) ?? []), t.title]);
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
        assigneeId,
        templateKey: `${set.key}:${t.id}`,
        createdBy: actor?.id ?? null,
      })
      .returning({ id: tasks.id });
    if (t.checklist.length) {
      await db.insert(checklistItems).values(t.checklist.map((text, i) => ({ taskId: row.id, text, position: i })));
    }
  }

  for (const [userId, titles] of assigned) {
    await notify(db, {
      userIds: [userId],
      actorId: actor?.id,
      kind: "assigned",
      title: titles.length === 1 ? `New task: ${titles[0]}` : `${titles.length} new tasks on ${c.title}`,
      body: titles.length === 1 ? `${c.title}${opts.reason ? ` (${opts.reason})` : ""}` : titles.join(", "),
      href: `/cases/${c.id}`,
    });
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
  for (const s of sets) created += await applyTemplateSet(db, actor, c, s.id, { auto: true, reason: "New case" });
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
  for (const s of sets) created += await applyTemplateSet(db, actor, c, s.id, { auto: true, reason: `Entered ${stage.name}` });
  return created;
}
