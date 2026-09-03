// Imports the Businessmap export saved under data/businessmap/ into the app
// database. Safe to re-run: cards that were already imported are skipped.
//
//   pnpm import:businessmap            # uses ./data/businessmap
//   pnpm import:businessmap <folder>   # a different export folder
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { eq, sql } from "drizzle-orm";
import { getDb } from "../src/db";
import {
  auditLog,
  cases,
  caseTypes,
  checklistItems,
  comments,
  events,
  lanes,
  profiles,
  stages,
  tasks,
} from "../src/db/schema";
import { transformBusinessmapExport, type BmCard, type BmComment, type BmExport, type BmSubtask } from "../src/lib/import/businessmap";

function readJson<T>(file: string): T {
  return JSON.parse(fs.readFileSync(file, "utf8")) as T;
}

async function main() {
  const folder = path.resolve(process.argv[2] ?? "data/businessmap");
  const cardsA = readJson<{ cards: BmCard[] }>(path.join(folder, "cards-details-b.json")).cards;
  const subtasks = readJson<{ subtasks: BmSubtask[] }>(path.join(folder, "subtasks.json")).subtasks;
  const commentsFile = path.join(folder, "comments.json");
  const bmComments = fs.existsSync(commentsFile) ? readJson<{ comments: BmComment[] }>(commentsFile).comments : [];
  const links = readJson<{ child_to_parents: Record<string, number[]>; planned_end_dates?: Record<string, string> }>(
    path.join(folder, "parent-links.json"),
  );

  const input: BmExport = {
    cards: cardsA,
    subtasks,
    comments: bmComments,
    childToParents: links.child_to_parents,
    plannedEndDates: links.planned_end_dates ?? {},
  };

  const result = transformBusinessmapExport(input);
  console.log(`Transformed ${result.cases.length} cases, ${result.tasks.length} tasks, ${result.events.length} events, ${result.comments.length} comments.`);
  for (const w of result.warnings) console.log("  note:", w);

  const db = await getDb();

  const stageRows = await db.select().from(stages);
  const laneRows = await db.select().from(lanes);
  const typeRows = await db.select().from(caseTypes);
  const people = await db.select().from(profiles);

  const stageId = (boardId: string, key: string) => stageRows.find((s) => s.boardId === boardId && s.key === key)?.id;
  const laneId = (boardId: string, key: string | null) => (key ? laneRows.find((l) => l.boardId === boardId && l.key === key)?.id ?? null : null);
  const typeId = (boardId: string, key: string | null) => (key ? typeRows.find((t) => t.boardId === boardId && t.key === key)?.id ?? null : null);
  const personId = (name: string | null) => {
    if (!name) return null;
    const n = name.trim().toLowerCase();
    return people.find((p) => p.fullName.toLowerCase() === n || p.fullName.toLowerCase().startsWith(n))?.id ?? null;
  };

  // Cards already imported (by Businessmap card id).
  const existingCases = await db
    .select({ id: cases.id, cardId: sql<number>`(${cases.externalRef} ->> 'cardId')::int` })
    .from(cases)
    .where(sql`${cases.externalRef} ->> 'source' = 'businessmap'`);
  const existingTasks = await db
    .select({ id: tasks.id, cardId: sql<number>`(${tasks.externalRef} ->> 'cardId')::int` })
    .from(tasks)
    .where(sql`${tasks.externalRef} ->> 'source' = 'businessmap'`);
  const existingEvents = await db
    .select({ id: events.id, cardId: sql<number>`(${events.externalRef} ->> 'cardId')::int` })
    .from(events)
    .where(sql`${events.externalRef} ->> 'source' = 'businessmap'`);

  const caseIdByKey = new Map<string, string>();
  const taskIdByKey = new Map<string, string>();

  // Pre-populate maps from previous runs so re-runs attach new children correctly.
  for (const c of result.cases) {
    const hit = existingCases.find((e) => e.cardId === c.externalRef.cardId);
    if (hit) caseIdByKey.set(c.key, hit.id);
  }
  for (const t of result.tasks) {
    if (!t.externalRef) continue;
    const hit = existingTasks.find((e) => e.cardId === t.externalRef!.cardId);
    if (hit) taskIdByKey.set(t.key, hit.id);
  }

  const created = { cases: 0, tasks: 0, checklist: 0, events: 0, comments: 0 };

  for (const c of result.cases) {
    if (caseIdByKey.has(c.key)) continue;
    const sid = stageId(c.boardId, c.stageKey);
    if (!sid) throw new Error(`Stage ${c.boardId}/${c.stageKey} not found. Run pnpm db:seed first.`);
    const [row] = await db
      .insert(cases)
      .values({
        boardId: c.boardId,
        stageId: sid,
        laneId: laneId(c.boardId, c.laneKey),
        caseTypeId: typeId(c.boardId, c.caseTypeKey),
        title: c.title,
        caseNumber: c.caseNumber,
        county: c.county,
        fiduciary: c.fiduciary,
        willStatus: c.willStatus,
        ownerId: personId(c.ownerName),
        description: c.description,
        appointmentDate: c.appointmentDate,
        status: c.stageKey === "closed" || c.stageKey === "ready_to_archive" ? "closed" : "active",
        stageEnteredAt: new Date(c.stageEnteredAt),
        lastActivityAt: new Date(c.lastActivityAt),
        createdAt: new Date(c.createdAt),
        externalRef: c.externalRef,
      })
      .returning({ id: cases.id });
    caseIdByKey.set(c.key, row.id);
    created.cases++;
    await db.insert(auditLog).values({
      caseId: row.id,
      actorName: "Import",
      kind: "import",
      description: `Imported from Businessmap card ${c.externalRef.cardId}${c.externalRef.customId ? ` (${c.externalRef.customId})` : ""}.`,
      createdAt: new Date(c.createdAt),
    });
  }

  // Parents before children.
  const ordered = [...result.tasks].sort((a, b) => (a.parentTaskKey ? 1 : 0) - (b.parentTaskKey ? 1 : 0));
  const positions = new Map<string, number>();
  for (const t of ordered) {
    if (taskIdByKey.has(t.key)) continue;
    const caseId = caseIdByKey.get(t.caseKey);
    if (!caseId) {
      console.log(`  skip task ${t.key}: case ${t.caseKey} missing`);
      continue;
    }
    const pos = positions.get(t.caseKey) ?? 0;
    positions.set(t.caseKey, pos + 1);
    const [row] = await db
      .insert(tasks)
      .values({
        caseId,
        parentTaskId: t.parentTaskKey ? (taskIdByKey.get(t.parentTaskKey) ?? null) : null,
        title: t.title,
        description: t.description,
        status: t.status,
        lane: t.lane,
        assigneeId: personId(t.assigneeName),
        dueDate: t.dueDate,
        position: pos,
        createdAt: new Date(t.createdAt),
        updatedAt: new Date(t.updatedAt),
        completedAt: t.completedAt ? new Date(t.completedAt) : null,
        externalRef: t.externalRef,
      })
      .returning({ id: tasks.id });
    taskIdByKey.set(t.key, row.id);
    created.tasks++;
    if (t.checklist.length) {
      await db.insert(checklistItems).values(
        t.checklist.map((i, idx) => ({
          taskId: row.id,
          text: i.text,
          isDone: i.isDone,
          assigneeId: personId(i.assigneeName),
          dueDate: i.dueDate,
          doneAt: i.doneAt ? new Date(i.doneAt) : null,
          position: idx,
        })),
      );
      created.checklist += t.checklist.length;
    }
  }

  for (const e of result.events) {
    if (existingEvents.some((x) => x.cardId === e.externalRef.cardId)) continue;
    const caseId = caseIdByKey.get(e.caseKey);
    if (!caseId) continue;
    await db.insert(events).values({
      caseId,
      kind: e.kind,
      title: e.title,
      date: e.date,
      status: e.status,
      notes: e.notes,
      externalRef: e.externalRef,
    });
    created.events++;
  }

  // Comments are only written on the first import of their target.
  const freshCaseKeys = new Set(result.cases.filter((c) => !existingCases.some((e) => e.cardId === c.externalRef.cardId)).map((c) => c.key));
  const freshTaskKeys = new Set(result.tasks.filter((t) => t.externalRef && !existingTasks.some((e) => e.cardId === t.externalRef!.cardId)).map((t) => t.key));
  for (const cm of result.comments) {
    const isFresh = cm.targetType === "case" ? freshCaseKeys.has(cm.targetKey) : freshTaskKeys.has(cm.targetKey);
    if (!isFresh) continue;
    const caseId = cm.targetType === "case" ? caseIdByKey.get(cm.targetKey) : null;
    const taskId = cm.targetType === "task" ? taskIdByKey.get(cm.targetKey) : null;
    if (!caseId && !taskId) continue;
    await db.insert(comments).values({
      caseId: caseId ?? (taskId ? (await db.select({ caseId: tasks.caseId }).from(tasks).where(eq(tasks.id, taskId)))[0]?.caseId ?? null : null),
      taskId,
      authorId: personId(cm.authorName),
      authorName: cm.authorName,
      body: cm.body,
      createdAt: new Date(cm.createdAt),
    });
    created.comments++;
  }

  console.log("Import complete:", created);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
