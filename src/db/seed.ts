import { eq, sql } from "drizzle-orm";
import type { Db } from "./index";
import { BOARD_SEEDS, PROFILE_SEEDS, SETTING_SEEDS, type StageSeed } from "./seed-data";
import {
  boards,
  caseTypes,
  deadlineRules,
  lanes,
  profiles,
  settings,
  stages,
  templateSets,
  templateTasks,
} from "./schema";

/**
 * Seeds board configuration, template sets, deadline rules, users and
 * settings. Safe to run repeatedly: existing rows are updated by key and new
 * rows inserted, nothing is deleted.
 */
export async function seedConfiguration(db: Db): Promise<void> {
  for (const [bi, board] of BOARD_SEEDS.entries()) {
    await db
      .insert(boards)
      .values({ id: board.id, name: board.name, description: board.description, position: bi })
      .onConflictDoUpdate({
        target: boards.id,
        set: { name: board.name, description: board.description, position: bi },
      });

    let position = 0;
    const upsertStage = async (s: StageSeed, parentId: string | null): Promise<string> => {
      const [row] = await db
        .insert(stages)
        .values({
          boardId: board.id,
          key: s.key,
          name: s.name,
          parentId,
          position: position++,
          isClosed: s.isClosed ?? false,
          isArchive: s.isArchive ?? false,
          stuckDays: s.stuckDays ?? null,
          criticalDays: s.criticalDays ?? null,
          policy: s.policy ?? null,
        })
        .onConflictDoUpdate({
          target: [stages.boardId, stages.key],
          // Keep user-edited thresholds and policies; only fix structure.
          set: { name: s.name, parentId, position: sql`excluded.position` },
        })
        .returning({ id: stages.id });
      for (const child of s.children ?? []) await upsertStage(child, row.id);
      return row.id;
    };
    for (const s of board.stages) await upsertStage(s, null);

    for (const [i, lane] of board.lanes.entries()) {
      await db
        .insert(lanes)
        .values({ boardId: board.id, key: lane.key, name: lane.name, position: i })
        .onConflictDoUpdate({ target: [lanes.boardId, lanes.key], set: { name: lane.name, position: i } });
    }

    for (const [i, ct] of board.caseTypes.entries()) {
      await db
        .insert(caseTypes)
        .values({ boardId: board.id, key: ct.key, name: ct.name, prefix: ct.prefix ?? null, color: ct.color, position: i })
        .onConflictDoUpdate({
          target: [caseTypes.boardId, caseTypes.key],
          set: { name: ct.name, prefix: ct.prefix ?? null, color: ct.color, position: i },
        });
    }

    for (const [i, set] of board.templateSets.entries()) {
      const existing = await db.query.templateSets.findFirst({
        where: (t, { and, eq }) => and(eq(t.boardId, board.id), eq(t.key, set.key)),
      });
      if (existing) continue; // Templates are user-editable; never overwrite.
      const [row] = await db
        .insert(templateSets)
        .values({
          boardId: board.id,
          key: set.key,
          name: set.name,
          description: set.description ?? "",
          applyOnCreate: set.applyOnCreate ?? false,
          position: i,
        })
        .returning({ id: templateSets.id });
      if (set.tasks.length) {
        await db.insert(templateTasks).values(
          set.tasks.map((t, ti) => ({
            setId: row.id,
            title: t.title,
            description: t.description ?? "",
            lane: t.lane ?? "core",
            position: ti,
            checklist: t.checklist ?? [],
            dueAnchor: t.dueAnchor ?? null,
            dueOffsetDays: t.dueOffsetDays ?? null,
          })),
        );
      }
    }

    for (const rule of board.deadlineRules) {
      await db
        .insert(deadlineRules)
        .values({
          boardId: board.id,
          key: rule.key,
          title: rule.title,
          kind: rule.kind ?? "deadline",
          anchor: rule.anchor,
          offsetDays: rule.offsetDays,
          notes: rule.notes ?? "",
        })
        .onConflictDoNothing();
    }
  }

  for (const p of PROFILE_SEEDS) {
    const existing = await db.query.profiles.findFirst({ where: eq(profiles.fullName, p.fullName) });
    if (!existing) {
      await db.insert(profiles).values({ fullName: p.fullName, role: p.role, email: p.email ?? null });
    }
  }

  for (const [key, value] of Object.entries(SETTING_SEEDS)) {
    await db
      .insert(settings)
      .values({ key, value })
      .onConflictDoNothing();
  }
}

/** Runs the seed only when the database has no boards yet. */
export async function ensureSeeded(db: Db): Promise<void> {
  const existing = await db.select({ id: boards.id }).from(boards).limit(1);
  if (existing.length === 0) {
    await seedConfiguration(db);
  }
}
