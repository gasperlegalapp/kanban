"use server";

import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { cases, lanes, stages, tasks, type Case } from "@/db/schema";
import { buildStageTree } from "@/lib/data/boards";
import { isAttorney, requireActor, requireAttorneyActor } from "@/lib/auth/session";
import { recordAudit, touchCase } from "@/lib/services/audit";
import { syncRuleDeadlines } from "@/lib/services/deadlines";
import { applyDefaultTemplates, applyTemplateSet } from "@/lib/services/templates";
import { runAction, type ActionResult } from "./result";
import { revalidateCase } from "./revalidate";

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");
const optionalDate = dateString.nullable().optional();
const optionalText = z.string().trim().max(500).nullable().optional();

const caseInput = z.object({
  boardId: z.string().min(1),
  title: z.string().trim().min(1, "Title is required").max(200),
  clientName: optionalText,
  caseNumber: optionalText,
  county: optionalText,
  court: optionalText,
  fiduciary: optionalText,
  willStatus: z.enum(["testate", "intestate", "unknown"]).optional(),
  ownerId: z.uuid().nullable().optional(),
  laneId: z.uuid().nullable().optional(),
  caseTypeId: z.uuid().nullable().optional(),
  stageId: z.uuid().optional(),
  actionstepUrl: z.string().trim().max(1000).nullable().optional(),
  appointmentDate: optionalDate,
  dateOfDeath: optionalDate,
  description: z.string().max(20000).optional(),
  applyTemplates: z.boolean().optional(),
});

export type CaseInput = z.input<typeof caseInput>;

export async function createCase(raw: CaseInput): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const actor = await requireActor();
    const input = caseInput.parse(raw);
    const db = await getDb();
    const stageRows = await db.select().from(stages).where(eq(stages.boardId, input.boardId));
    const { leaves } = buildStageTree(stageRows);
    const stage = input.stageId ? leaves.find((s) => s.id === input.stageId) : leaves[0];
    if (!stage) throw new Error("Stage not found.");
    const [row] = await db
      .insert(cases)
      .values({
        boardId: input.boardId,
        stageId: stage.id,
        laneId: input.laneId ?? null,
        caseTypeId: input.caseTypeId ?? null,
        title: input.title,
        clientName: input.clientName ?? null,
        caseNumber: input.caseNumber ?? null,
        county: input.county ?? null,
        court: input.court ?? null,
        fiduciary: input.fiduciary ?? null,
        willStatus: input.willStatus ?? "unknown",
        ownerId: input.ownerId ?? null,
        actionstepUrl: input.actionstepUrl || null,
        appointmentDate: input.appointmentDate ?? null,
        dateOfDeath: input.dateOfDeath ?? null,
        description: input.description ?? "",
        createdBy: actor.id,
      })
      .returning();
    await recordAudit(db, actor, { caseId: row.id, kind: "case_created", description: `Case created in ${stage.name}.` });
    if (input.applyTemplates !== false) await applyDefaultTemplates(db, actor, row);
    await syncRuleDeadlines(db, actor, row);
    revalidateCase(row.boardId, row.id);
    return { id: row.id };
  });
}

const casePatch = caseInput.omit({ boardId: true, stageId: true, applyTemplates: true }).partial();
export type CasePatch = z.input<typeof casePatch>;

export async function updateCase(caseId: string, raw: CasePatch): Promise<ActionResult> {
  return runAction(async () => {
    const actor = await requireActor();
    const patch = casePatch.parse(raw);
    const db = await getDb();
    const existing = await db.query.cases.findFirst({ where: eq(cases.id, caseId) });
    if (!existing) throw new Error("Case not found.");

    const changes: Partial<Case> = {};
    const label: string[] = [];
    for (const [k, v] of Object.entries(patch) as [keyof typeof patch, unknown][]) {
      if (v === undefined) continue;
      const value = (v === "" ? null : v) as never;
      if ((existing as Record<string, unknown>)[k] !== value) {
        (changes as Record<string, unknown>)[k] = value;
        label.push(k);
      }
    }
    if (!label.length) return undefined;

    await db.update(cases).set({ ...changes, lastActivityAt: new Date() }).where(eq(cases.id, caseId));
    await recordAudit(db, actor, {
      caseId,
      kind: "case_updated",
      description: `Updated ${label.map(humanize).join(", ")}.`,
    });
    if ("appointmentDate" in changes || "dateOfDeath" in changes) {
      await syncRuleDeadlines(db, actor, { ...existing, ...changes });
    }
    if ("laneId" in changes) {
      const laneRows = await db.select().from(lanes).where(eq(lanes.boardId, existing.boardId));
      await recordAudit(db, actor, {
        caseId,
        kind: "lane_change",
        description: `Moved to lane ${laneRows.find((l) => l.id === changes.laneId)?.name ?? "none"}.`,
        fromValue: laneRows.find((l) => l.id === existing.laneId)?.name ?? null,
        toValue: laneRows.find((l) => l.id === changes.laneId)?.name ?? null,
      });
    }
    revalidateCase(existing.boardId, caseId);
    return undefined;
  });
}

function humanize(key: string): string {
  return key.replace(/([A-Z])/g, " $1").toLowerCase().replace(/^./, (c) => c.toUpperCase());
}

/** Minimum length for a skip reason (kept in sync with the modal). */
const SKIP_REASON_MIN = 10;

/**
 * Moves a case to another stage. Moving more than one stage forward, or any
 * step backward, needs a reason and is logged as a skip. Only attorneys can
 * close or archive a case.
 */
export async function moveCase(caseId: string, toStageId: string, reason?: string): Promise<ActionResult> {
  return runAction(async () => {
    const actor = await requireActor();
    const db = await getDb();
    const existing = await db.query.cases.findFirst({ where: eq(cases.id, caseId) });
    if (!existing) throw new Error("Case not found.");
    if (existing.stageId === toStageId) return undefined;

    const stageRows = await db.select().from(stages).where(eq(stages.boardId, existing.boardId));
    const { leaves } = buildStageTree(stageRows);
    const fromIdx = leaves.findIndex((s) => s.id === existing.stageId);
    const toIdx = leaves.findIndex((s) => s.id === toStageId);
    if (toIdx < 0) throw new Error("Stage not found.");
    const from = leaves[fromIdx];
    const to = leaves[toIdx];

    if ((to.isClosed || to.isArchive) && !isAttorney(actor)) {
      throw new Error("Only an attorney can close or archive a case.");
    }

    const isSkip = toIdx - fromIdx !== 1;
    const trimmed = (reason ?? "").trim();
    if (isSkip && trimmed.length < SKIP_REASON_MIN) {
      throw new Error(`A reason of at least ${SKIP_REASON_MIN} characters is required to move a case out of order.`);
    }

    const now = new Date();
    await db
      .update(cases)
      .set({
        stageId: to.id,
        stageEnteredAt: now,
        lastActivityAt: now,
        status: to.isArchive ? "archived" : to.isClosed ? "closed" : "active",
        closedAt: to.isClosed || to.isArchive ? (existing.closedAt ?? now) : null,
      })
      .where(eq(cases.id, caseId));

    await recordAudit(db, actor, {
      caseId,
      kind: to.isArchive ? "case_archived" : to.isClosed ? "case_closed" : from?.isClosed ? "case_reopened" : isSkip ? "stage_skip" : "stage_change",
      description: isSkip ? `Moved ${from?.name ?? "?"} → ${to.name} out of order.` : `Moved ${from?.name ?? "?"} → ${to.name}.`,
      fromValue: from?.name ?? null,
      toValue: to.name,
      reason: isSkip ? trimmed : null,
    });
    revalidateCase(existing.boardId, caseId);
    return undefined;
  });
}

export async function applyTemplateToCase(caseId: string, setId: string): Promise<ActionResult<{ created: number }>> {
  return runAction(async () => {
    const actor = await requireActor();
    const db = await getDb();
    const existing = await db.query.cases.findFirst({ where: eq(cases.id, caseId) });
    if (!existing) throw new Error("Case not found.");
    const created = await applyTemplateSet(db, actor, existing, setId);
    await touchCase(db, caseId);
    revalidateCase(existing.boardId, caseId);
    return { created };
  });
}

export async function recalculateDeadlines(caseId: string): Promise<ActionResult<{ created: number; updated: number }>> {
  return runAction(async () => {
    const actor = await requireActor();
    const db = await getDb();
    const existing = await db.query.cases.findFirst({ where: eq(cases.id, caseId) });
    if (!existing) throw new Error("Case not found.");
    const r = await syncRuleDeadlines(db, actor, existing);
    revalidateCase(existing.boardId, caseId);
    return r;
  });
}

export async function deleteCase(caseId: string): Promise<ActionResult<{ boardId: string }>> {
  return runAction(async () => {
    await requireAttorneyActor();
    const db = await getDb();
    const existing = await db.query.cases.findFirst({ where: eq(cases.id, caseId) });
    if (!existing) throw new Error("Case not found.");
    await db.delete(tasks).where(eq(tasks.caseId, caseId));
    await db.delete(cases).where(and(eq(cases.id, caseId)));
    revalidateCase(existing.boardId, caseId);
    return { boardId: existing.boardId };
  });
}
