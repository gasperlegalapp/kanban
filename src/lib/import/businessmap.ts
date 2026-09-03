// Pure transformation of a Businessmap export into records for this app.
// No database access here so the mapping can be unit tested; the script in
// scripts/import-businessmap.ts loads the JSON files and writes the results.

import { BOARD_SEEDS } from "@/db/seed-data";
import type { EventKind, ExternalRef, TaskLane, TaskStatus, WillStatus } from "@/db/schema";
import { htmlToText } from "./html";

// ---------------------------------------------------------------------------
// Input shapes (as saved under data/businessmap/)
// ---------------------------------------------------------------------------

export type BmCard = {
  card_id: number;
  custom_id: string | null;
  board_id: number;
  workflow_name: string;
  column_name: string;
  lane_name: string | null;
  title: string;
  description: string | null;
  color: string | null;
  deadline: string | null;
  owner_username: string | null;
  co_owner_usernames?: string[] | null;
  custom_fields?: { field_name: string; field_type: string; display_value: string | null }[] | null;
  created_at: string;
  last_modified: string;
  in_current_position_since: string | null;
  first_start_time?: string | null;
  first_end_time?: string | null;
  attachments?: { file_name?: string; name?: string }[] | null;
};

export type BmSubtask = {
  card_id: number;
  description: string;
  is_finished: boolean;
  owner_username: string | null;
  deadline: string | null;
  finished_at?: string | null;
};

export type BmComment = {
  comment_id: string;
  card_id: number;
  type: string;
  author: string;
  created_at: string;
  text: string;
};

export type BmExport = {
  cards: BmCard[];
  subtasks: BmSubtask[];
  comments: BmComment[];
  childToParents: Record<string, number[]>;
  plannedEndDates: Record<string, string>;
  accountHost?: string; // e.g. gasperlegal.businessmap.io
};

// ---------------------------------------------------------------------------
// Output shapes
// ---------------------------------------------------------------------------

export type ImportedChecklistItem = {
  text: string;
  isDone: boolean;
  assigneeName: string | null;
  dueDate: string | null;
  doneAt: string | null;
};

export type ImportedCase = {
  key: string;
  boardId: string;
  stageKey: string;
  laneKey: string | null;
  caseTypeKey: string | null;
  title: string;
  caseNumber: string | null;
  county: string | null;
  fiduciary: string | null;
  willStatus: WillStatus;
  ownerName: string | null;
  description: string;
  appointmentDate: string | null;
  stageEnteredAt: string;
  createdAt: string;
  lastActivityAt: string;
  externalRef: ExternalRef;
};

export type ImportedTask = {
  key: string;
  caseKey: string;
  parentTaskKey: string | null;
  title: string;
  description: string;
  status: TaskStatus;
  lane: TaskLane;
  assigneeName: string | null;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  checklist: ImportedChecklistItem[];
  externalRef: ExternalRef | null;
};

export type ImportedEvent = {
  key: string;
  caseKey: string;
  kind: EventKind;
  title: string;
  date: string;
  status: "pending" | "done";
  notes: string;
  externalRef: ExternalRef;
};

export type ImportedComment = {
  targetKey: string; // case key or task key
  targetType: "case" | "task";
  authorName: string;
  body: string;
  createdAt: string;
};

export type ImportResult = {
  cases: ImportedCase[];
  tasks: ImportedTask[];
  events: ImportedEvent[];
  comments: ImportedComment[];
  warnings: string[];
};

// ---------------------------------------------------------------------------
// Lookup tables
// ---------------------------------------------------------------------------

const BOARD_BY_BM_ID: Record<number, string> = { 8: "probate", 12: "guardianship" };

function norm(s: string | null | undefined): string {
  return (s ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function normKeys<T>(rec: Record<string, T>): Record<string, T> {
  return Object.fromEntries(Object.entries(rec).map(([k, v]) => [norm(k), v]));
}

const TASK_STATUS_BY_COLUMN: Record<string, TaskStatus> = normKeys({
  backlog: "backlog",
  requested: "requested",
  "in progress": "in_progress",
  waiting: "waiting",
  review: "review",
  blocked: "blocked",
  done: "done",
  "ready to archive": "done",
});

const TASK_LANE_BY_NAME: Record<string, TaskLane> = normKeys({
  "core casework": "core",
  "assets / financial": "assets",
  "litigation / urgent": "litigation",
  "social work": "social",
});

function buildStageMap(boardId: string): Map<string, string> {
  const board = BOARD_SEEDS.find((b) => b.id === boardId)!;
  const map = new Map<string, string>();
  const walk = (stages: typeof board.stages) => {
    for (const s of stages) {
      if (s.children?.length) walk(s.children);
      else map.set(norm(s.name), s.key);
    }
  };
  walk(board.stages);
  return map;
}

function buildLaneMap(boardId: string): Map<string, string> {
  const board = BOARD_SEEDS.find((b) => b.id === boardId)!;
  return new Map(board.lanes.map((l) => [norm(l.name), l.key]));
}

const STAGE_MAPS: Record<string, Map<string, string>> = {
  probate: buildStageMap("probate"),
  guardianship: buildStageMap("guardianship"),
};
const LANE_MAPS: Record<string, Map<string, string>> = {
  probate: buildLaneMap("probate"),
  guardianship: buildLaneMap("guardianship"),
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isCaseWorkflow(c: BmCard): boolean {
  return /case workflow/i.test(c.workflow_name);
}
function isTaskWorkflow(c: BmCard): boolean {
  return /^tasks?\b/i.test(c.workflow_name);
}
function isEventWorkflow(c: BmCard): boolean {
  return /hearings|deadlines/i.test(c.workflow_name);
}

function dateOnly(value: string | null | undefined): string | null {
  if (!value) return null;
  const m = value.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
}

function customField(c: BmCard, name: string): string | null {
  const f = (c.custom_fields ?? []).find((x) => x.field_name.toLowerCase() === name.toLowerCase());
  const v = f?.display_value?.trim();
  return v ? v : null;
}

function willStatusFrom(value: string | null): WillStatus {
  const v = (value ?? "").toLowerCase();
  if (v.startsWith("testate")) return "testate";
  if (v.startsWith("intestate")) return "intestate";
  return "unknown";
}

/** "ADKINS - 621456" -> "621456"; falls back to a "Case No. 642088" mention. */
export function extractCaseNumber(customId: string | null, descriptionText: string): string | null {
  const fromId = customId?.match(/(\d{5,})/);
  if (fromId) return fromId[1];
  const fromDesc = descriptionText.match(/case\s*(?:no\.?|number|#)\s*:?\s*(\d{5,})/i);
  return fromDesc ? fromDesc[1] : null;
}

const TYPE_PHRASES: { re: RegExp; key: string }[] = [
  { re: /wrongful\s+death/i, key: "wrongful_death" },
  { re: /land\s+sale/i, key: "land_sale" },
  { re: /concealment/i, key: "concealment" },
  { re: /heirship/i, key: "heirship" },
  { re: /full\s+estate/i, key: "full_estate" },
];

export function detectProbateCaseType(title: string): string {
  for (const t of TYPE_PHRASES) if (t.re.test(title)) return t.key;
  return "full_estate";
}

/** Strip the type suffix/prefix from a card title, e.g. "Land Sale - Blair" -> "Blair". */
export function cleanCaseTitle(title: string, descriptionText: string): string {
  let t = title.trim();
  t = t.replace(/wrongful\s+death\s+probate\s+estate/i, "");
  t = t.replace(/probate\s+estate/i, "");
  t = t.replace(/full\s+estate/i, "");
  t = t.replace(/land\s+sale/i, "");
  t = t.replace(/concealment/i, "");
  t = t.replace(/heirship/i, "");
  t = t.replace(/^[\s\-–:]+|[\s\-–:]+$/g, "").replace(/\s{2,}/g, " ").trim();
  if (t) return t;
  const m = descriptionText.match(/estate of\s+([A-Z][^,\n]+)/i);
  if (m) {
    const parts = m[1].trim().replace(/[.\s]+$/, "").split(/\s+/);
    if (parts.length > 1) return `${parts[parts.length - 1]}, ${parts.slice(0, -1).join(" ")}`;
    return m[1].trim();
  }
  return "Untitled case";
}

const GUARDIANSHIP_PREFIX: Record<string, string> = { gop: "gop", goe: "goe", both: "both", minor: "minor" };

function detectGuardianshipType(title: string): { key: string | null; title: string } {
  const m = title.match(/^\s*\[(\w+)\]\s*(.*)$/);
  if (!m) return { key: null, title: title.trim() };
  return { key: GUARDIANSHIP_PREFIX[m[1].toLowerCase()] ?? null, title: m[2].trim() };
}

const MONTHS = "january|february|march|april|may|june|july|august|september|october|november|december";
/** Finds "Appointed March 16, 2026" style statements. */
export function extractAppointmentDate(text: string): string | null {
  const m = text.match(new RegExp(`appointed\\s+(?:on\\s+)?((?:${MONTHS})\\s+\\d{1,2},?\\s+\\d{4})`, "i"));
  if (!m) return null;
  const d = new Date(m[1].replace(",", ""));
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function cardUrl(host: string, c: BmCard): string {
  return `https://${host}/ctrl_board/${c.board_id}/cards/${c.card_id}`;
}

function externalRef(host: string, c: BmCard): ExternalRef {
  return {
    source: "businessmap",
    cardId: c.card_id,
    customId: c.custom_id,
    url: cardUrl(host, c),
    workflow: c.workflow_name,
    column: c.column_name,
    lane: c.lane_name ?? undefined,
  };
}

function attachmentNote(c: BmCard): string {
  const names = (c.attachments ?? []).map((a) => a.file_name ?? a.name).filter(Boolean);
  if (!names.length) return "";
  return `\n\nAttachments left in Businessmap: ${names.join(", ")}`;
}

// ---------------------------------------------------------------------------
// Transform
// ---------------------------------------------------------------------------

export function transformBusinessmapExport(input: BmExport): ImportResult {
  const host = input.accountHost ?? "gasperlegal.businessmap.io";
  const warnings: string[] = [];
  const cards = input.cards.filter((c) => BOARD_BY_BM_ID[c.board_id] && !/^BOARD KEY/i.test(c.title));
  const byId = new Map(cards.map((c) => [c.card_id, c]));
  const subtasksByCard = new Map<number, BmSubtask[]>();
  for (const s of input.subtasks) {
    if (!subtasksByCard.has(s.card_id)) subtasksByCard.set(s.card_id, []);
    subtasksByCard.get(s.card_id)!.push(s);
  }

  const result: ImportResult = { cases: [], tasks: [], events: [], comments: [], warnings };
  const caseKeyByCard = new Map<number, string>(); // card id -> case key it belongs to
  const taskKeyByCard = new Map<number, string>();

  const toChecklist = (cardId: number): ImportedChecklistItem[] =>
    (subtasksByCard.get(cardId) ?? []).map((s) => ({
      text: s.description.trim(),
      isDone: !!s.is_finished,
      assigneeName: s.owner_username,
      dueDate: dateOnly(s.deadline),
      doneAt: s.finished_at ?? null,
    }));

  // 1. Case cards --------------------------------------------------------
  for (const c of cards.filter(isCaseWorkflow)) {
    const boardId = BOARD_BY_BM_ID[c.board_id];
    const descText = htmlToText(c.description);
    const stageKey = STAGE_MAPS[boardId].get(norm(c.column_name));
    if (!stageKey) {
      warnings.push(`Card ${c.card_id} "${c.title}": unknown stage "${c.column_name}", placed in New Client Intake.`);
    }
    const laneKey = LANE_MAPS[boardId].get(norm(c.lane_name)) ?? null;

    let caseTypeKey: string | null;
    let title: string;
    if (boardId === "guardianship") {
      const g = detectGuardianshipType(c.title);
      caseTypeKey = g.key;
      title = g.title || cleanCaseTitle(c.title, descText);
    } else {
      caseTypeKey = detectProbateCaseType(c.title);
      title = cleanCaseTitle(c.title, descText);
    }

    const key = `card:${c.card_id}`;
    caseKeyByCard.set(c.card_id, key);
    result.cases.push({
      key,
      boardId,
      stageKey: stageKey ?? "new_client_intake",
      laneKey,
      caseTypeKey,
      title,
      caseNumber: extractCaseNumber(c.custom_id, descText),
      county: customField(c, "County of Case"),
      fiduciary: customField(c, "Fiduciary"),
      willStatus: willStatusFrom(customField(c, "Is there a Will?")),
      ownerName: c.owner_username,
      description: descText + attachmentNote(c),
      appointmentDate: extractAppointmentDate(descText),
      stageEnteredAt: c.in_current_position_since ?? c.created_at,
      createdAt: c.created_at,
      lastActivityAt: c.last_modified ?? c.created_at,
      externalRef: externalRef(host, c),
    });

    // Engagement checklist that lives on the case card itself.
    const checklist = toChecklist(c.card_id);
    if (checklist.length) {
      const allDone = checklist.every((i) => i.isDone);
      result.tasks.push({
        key: `card:${c.card_id}:engagement`,
        caseKey: key,
        parentTaskKey: null,
        title: "Engagement",
        description: "Engagement letter and retainer.",
        status: allDone ? "done" : "in_progress",
        lane: "core",
        assigneeName: null,
        dueDate: null,
        createdAt: c.created_at,
        updatedAt: c.last_modified ?? c.created_at,
        completedAt: allDone ? (c.last_modified ?? c.created_at) : null,
        checklist,
        externalRef: null,
      });
    }
  }

  // 2. Task cards --------------------------------------------------------
  const taskCards = cards.filter(isTaskWorkflow).sort((a, b) => a.created_at.localeCompare(b.created_at));

  // Resolve which case a task card belongs to, walking up parent links.
  const resolving = new Set<number>();
  const resolveCase = (cardId: number): { caseKey: string; parentTaskKey: string | null } | null => {
    if (resolving.has(cardId)) return null;
    resolving.add(cardId);
    try {
      const parents = input.childToParents[String(cardId)] ?? [];
      const parentTask = parents.find((p) => byId.get(p) && isTaskWorkflow(byId.get(p)!));
      if (parentTask !== undefined) {
        const up = resolveCase(parentTask);
        if (up) return { caseKey: up.caseKey, parentTaskKey: `card:${parentTask}` };
      }
      const parentCase = parents.find((p) => caseKeyByCard.has(p));
      if (parentCase !== undefined) return { caseKey: caseKeyByCard.get(parentCase)!, parentTaskKey: null };
      return null;
    } finally {
      resolving.delete(cardId);
    }
  };

  // Orphan task cards (no parent case) become their own case; see README.
  const orphanCaseFor = (c: BmCard): string => {
    const key = `orphan:${c.card_id}`;
    if (caseKeyByCard.has(c.card_id)) return key;
    const boardId = BOARD_BY_BM_ID[c.board_id];
    const descText = htmlToText(c.description);
    const typeKey = boardId === "probate" ? detectProbateCaseType(c.title) : null;
    const checklist = toChecklist(c.card_id);
    const engaged = checklist.some((i) => /engagement signed/i.test(i.text) && i.isDone);
    let stageKey = "execution_admin";
    let laneKey: string | null = "litigation";
    if (typeKey === "wrongful_death") {
      stageKey = engaged ? "case_intake" : "new_client_intake";
      laneKey = "full_estate";
    }
    warnings.push(
      `Card ${c.card_id} "${c.title}" had no parent case in Businessmap; imported as its own case (${typeKey ?? "other"}).`,
    );
    caseKeyByCard.set(c.card_id, key);
    result.cases.push({
      key,
      boardId,
      stageKey,
      laneKey,
      caseTypeKey: typeKey,
      title: cleanCaseTitle(c.title, descText),
      caseNumber: extractCaseNumber(c.custom_id, descText),
      county: null,
      fiduciary: null,
      willStatus: "unknown",
      ownerName: c.owner_username,
      description: "",
      appointmentDate: null,
      stageEnteredAt: c.in_current_position_since ?? c.created_at,
      createdAt: c.created_at,
      lastActivityAt: c.last_modified ?? c.created_at,
      externalRef: externalRef(host, c),
    });
    return key;
  };

  for (const c of taskCards) {
    const resolved = resolveCase(c.card_id) ?? { caseKey: orphanCaseFor(c), parentTaskKey: null };
    const status = TASK_STATUS_BY_COLUMN[norm(c.column_name)] ?? "requested";
    const lane = TASK_LANE_BY_NAME[norm(c.lane_name)] ?? "core";
    const key = `card:${c.card_id}`;
    taskKeyByCard.set(c.card_id, key);
    const descText = htmlToText(c.description);
    result.tasks.push({
      key,
      caseKey: resolved.caseKey,
      parentTaskKey: resolved.parentTaskKey,
      title: c.title.trim() || "Untitled task",
      description: descText + attachmentNote(c),
      status,
      lane,
      assigneeName: c.owner_username,
      dueDate: dateOnly(c.deadline),
      createdAt: c.created_at,
      updatedAt: c.last_modified ?? c.created_at,
      completedAt: status === "done" ? (c.first_end_time ?? c.last_modified ?? c.created_at) : null,
      checklist: toChecklist(c.card_id),
      externalRef: externalRef(host, c),
    });

    // A task description that records the appointment date is the best
    // source we have for the case's appointment date.
    const appt = extractAppointmentDate(descText);
    if (appt) {
      const parentCase = result.cases.find((x) => x.key === resolved.caseKey);
      if (parentCase && !parentCase.appointmentDate) parentCase.appointmentDate = appt;
    }
  }

  // 3. Hearings / deadlines ---------------------------------------------
  for (const c of cards.filter(isEventWorkflow)) {
    const parents = input.childToParents[String(c.card_id)] ?? [];
    const parentCase = parents.map((p) => caseKeyByCard.get(p)).find(Boolean);
    if (!parentCase) {
      warnings.push(`Deadline card ${c.card_id} "${c.title}" is not linked to a case; skipped.`);
      continue;
    }
    const date = input.plannedEndDates[String(c.card_id)] ?? dateOnly(c.deadline);
    if (!date) {
      warnings.push(`Deadline card ${c.card_id} "${c.title}" has no date; skipped.`);
      continue;
    }
    result.events.push({
      key: `card:${c.card_id}`,
      caseKey: parentCase,
      kind: /hearing/i.test(c.lane_name ?? "") ? "hearing" : "deadline",
      title: c.title.replace(/\s*-\s*[A-Z][A-Za-z]+$/, "").trim() || c.title,
      date,
      status: norm(c.column_name) === "done" || norm(c.column_name) === "ready to archive" ? "done" : "pending",
      notes: htmlToText(c.description),
      externalRef: externalRef(host, c),
    });
  }

  // 4. Comments ----------------------------------------------------------
  for (const cm of input.comments) {
    const body = cm.text.trim();
    if (!body) continue;
    if (taskKeyByCard.has(cm.card_id)) {
      result.comments.push({ targetType: "task", targetKey: taskKeyByCard.get(cm.card_id)!, authorName: cm.author, body, createdAt: cm.created_at });
    } else if (caseKeyByCard.has(cm.card_id)) {
      result.comments.push({ targetType: "case", targetKey: caseKeyByCard.get(cm.card_id)!, authorName: cm.author, body, createdAt: cm.created_at });
    } else {
      warnings.push(`Comment ${cm.comment_id} on unknown card ${cm.card_id}; skipped.`);
    }
  }

  return result;
}
