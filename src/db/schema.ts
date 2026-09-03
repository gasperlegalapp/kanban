import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const userRoleEnum = pgEnum("user_role", ["attorney", "staff"]);
export const caseStatusEnum = pgEnum("case_status", ["active", "closed", "archived"]);
export const taskStatusEnum = pgEnum("task_status", [
  "backlog",
  "requested",
  "in_progress",
  "waiting",
  "review",
  "blocked",
  "done",
]);
export const taskLaneEnum = pgEnum("task_lane", ["core", "assets", "litigation", "social"]);
export const priorityEnum = pgEnum("priority", ["low", "normal", "high", "urgent"]);
export const eventKindEnum = pgEnum("event_kind", ["hearing", "deadline"]);
export const eventStatusEnum = pgEnum("event_status", ["pending", "done", "cancelled"]);
export const willStatusEnum = pgEnum("will_status", ["testate", "intestate", "unknown"]);
export const deadlineAnchorEnum = pgEnum("deadline_anchor", [
  "appointment_date",
  "date_of_death",
  "case_opened",
]);
export const auditKindEnum = pgEnum("audit_kind", [
  "case_created",
  "case_updated",
  "stage_change",
  "stage_skip",
  "lane_change",
  "case_closed",
  "case_reopened",
  "case_archived",
  "task_created",
  "task_status",
  "task_updated",
  "task_deleted",
  "event_created",
  "event_updated",
  "event_deleted",
  "comment",
  "attachment",
  "template_applied",
  "import",
]);

// ---------------------------------------------------------------------------
// People
// ---------------------------------------------------------------------------

export const profiles = pgTable(
  "profiles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    fullName: text("full_name").notNull(),
    email: text("email"),
    role: userRoleEnum("role").notNull().default("staff"),
    isActive: boolean("is_active").notNull().default(true),
    // Supabase auth.users id once the person has signed in in production.
    authUserId: text("auth_user_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("profiles_email_idx").on(sql`lower(${t.email})`).where(sql`${t.email} is not null`),
    uniqueIndex("profiles_auth_user_idx").on(t.authUserId).where(sql`${t.authUserId} is not null`),
  ],
);

// ---------------------------------------------------------------------------
// Board configuration (one board per practice area)
// ---------------------------------------------------------------------------

export const boards = pgTable("boards", {
  id: text("id").primaryKey(), // slug: 'probate' | 'guardianship'
  name: text("name").notNull(),
  description: text("description"),
  position: integer("position").notNull().default(0),
});

// A stage is a column on the case board. Stages can be grouped: a group row
// (e.g. "START PHASE") has child stages ("Case Intake", "Application", ...).
// Cases always sit in a leaf stage.
export const stages = pgTable(
  "stages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    boardId: text("board_id")
      .notNull()
      .references(() => boards.id, { onDelete: "cascade" }),
    key: text("key").notNull(), // stable identifier, e.g. 'inventory'
    name: text("name").notNull(),
    parentId: uuid("parent_id"),
    position: integer("position").notNull().default(0),
    isClosed: boolean("is_closed").notNull().default(false),
    isArchive: boolean("is_archive").notNull().default(false),
    // Days in stage before the case is flagged yellow / red. Null = never.
    stuckDays: integer("stuck_days"),
    criticalDays: integer("critical_days"),
    policy: text("policy"),
  },
  (t) => [uniqueIndex("stages_board_key_idx").on(t.boardId, t.key)],
);

export const lanes = pgTable(
  "lanes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    boardId: text("board_id")
      .notNull()
      .references(() => boards.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    name: text("name").notNull(),
    position: integer("position").notNull().default(0),
  },
  (t) => [uniqueIndex("lanes_board_key_idx").on(t.boardId, t.key)],
);

export const caseTypes = pgTable(
  "case_types",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    boardId: text("board_id")
      .notNull()
      .references(() => boards.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    name: text("name").notNull(),
    prefix: text("prefix"), // e.g. 'GOE' shown as a badge on the card
    color: text("color").notNull().default("#64748b"),
    position: integer("position").notNull().default(0),
  },
  (t) => [uniqueIndex("case_types_board_key_idx").on(t.boardId, t.key)],
);

// ---------------------------------------------------------------------------
// Cases
// ---------------------------------------------------------------------------

export type ExternalRef = {
  source: "businessmap";
  cardId: number;
  customId?: string | null;
  url?: string;
  workflow?: string;
  column?: string;
  lane?: string;
};

export const cases = pgTable(
  "cases",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    boardId: text("board_id")
      .notNull()
      .references(() => boards.id),
    stageId: uuid("stage_id")
      .notNull()
      .references(() => stages.id),
    laneId: uuid("lane_id").references(() => lanes.id),
    caseTypeId: uuid("case_type_id").references(() => caseTypes.id),
    title: text("title").notNull(), // e.g. 'Adkins, John' or 'Smith, Eleanor'
    clientName: text("client_name"),
    caseNumber: text("case_number"), // court case number
    county: text("county"),
    court: text("court"),
    fiduciary: text("fiduciary"),
    willStatus: willStatusEnum("will_status").notNull().default("unknown"),
    ownerId: uuid("owner_id").references(() => profiles.id),
    actionstepUrl: text("actionstep_url"),
    appointmentDate: date("appointment_date"),
    dateOfDeath: date("date_of_death"),
    description: text("description").notNull().default(""),
    status: caseStatusEnum("status").notNull().default("active"),
    stageEnteredAt: timestamp("stage_entered_at", { withTimezone: true }).notNull().defaultNow(),
    lastActivityAt: timestamp("last_activity_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid("created_by").references(() => profiles.id),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    externalRef: jsonb("external_ref").$type<ExternalRef | null>(),
  },
  (t) => [
    index("cases_board_stage_idx").on(t.boardId, t.stageId),
    index("cases_status_idx").on(t.status),
  ],
);

// ---------------------------------------------------------------------------
// Tasks and checklists
// ---------------------------------------------------------------------------

export const tasks = pgTable(
  "tasks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    caseId: uuid("case_id")
      .notNull()
      .references(() => cases.id, { onDelete: "cascade" }),
    // Sub-task cards, e.g. an individual bank account under "Assets / Inventory".
    parentTaskId: uuid("parent_task_id"),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    status: taskStatusEnum("status").notNull().default("requested"),
    lane: taskLaneEnum("lane").notNull().default("core"),
    assigneeId: uuid("assignee_id").references(() => profiles.id),
    dueDate: date("due_date"),
    priority: priorityEnum("priority").notNull().default("normal"),
    position: integer("position").notNull().default(0),
    templateKey: text("template_key"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdBy: uuid("created_by").references(() => profiles.id),
    externalRef: jsonb("external_ref").$type<ExternalRef | null>(),
  },
  (t) => [
    index("tasks_case_idx").on(t.caseId),
    index("tasks_status_idx").on(t.status),
    index("tasks_assignee_idx").on(t.assigneeId),
    index("tasks_due_idx").on(t.dueDate),
  ],
);

export const checklistItems = pgTable(
  "checklist_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    taskId: uuid("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    text: text("text").notNull(),
    isDone: boolean("is_done").notNull().default(false),
    assigneeId: uuid("assignee_id").references(() => profiles.id),
    dueDate: date("due_date"),
    doneAt: timestamp("done_at", { withTimezone: true }),
    position: integer("position").notNull().default(0),
  },
  (t) => [index("checklist_task_idx").on(t.taskId)],
);

// ---------------------------------------------------------------------------
// Hearings and deadlines
// ---------------------------------------------------------------------------

export const events = pgTable(
  "events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    caseId: uuid("case_id")
      .notNull()
      .references(() => cases.id, { onDelete: "cascade" }),
    kind: eventKindEnum("kind").notNull(),
    title: text("title").notNull(),
    date: date("date").notNull(),
    time: text("time"), // 'HH:MM' local, optional
    status: eventStatusEnum("status").notNull().default("pending"),
    // Set when the event was generated by a deadline rule so it can be
    // recomputed if the anchor date changes.
    ruleKey: text("rule_key"),
    notes: text("notes").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid("created_by").references(() => profiles.id),
    externalRef: jsonb("external_ref").$type<ExternalRef | null>(),
  },
  (t) => [index("events_case_idx").on(t.caseId), index("events_date_idx").on(t.date)],
);

// ---------------------------------------------------------------------------
// Collaboration
// ---------------------------------------------------------------------------

export const comments = pgTable(
  "comments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    caseId: uuid("case_id").references(() => cases.id, { onDelete: "cascade" }),
    taskId: uuid("task_id").references(() => tasks.id, { onDelete: "cascade" }),
    authorId: uuid("author_id").references(() => profiles.id),
    authorName: text("author_name").notNull(),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("comments_case_idx").on(t.caseId), index("comments_task_idx").on(t.taskId)],
);

export const attachments = pgTable(
  "attachments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    caseId: uuid("case_id").references(() => cases.id, { onDelete: "cascade" }),
    taskId: uuid("task_id").references(() => tasks.id, { onDelete: "cascade" }),
    fileName: text("file_name").notNull(),
    contentType: text("content_type").notNull().default("application/octet-stream"),
    sizeBytes: integer("size_bytes").notNull().default(0),
    storageKey: text("storage_key").notNull(),
    uploadedBy: uuid("uploaded_by").references(() => profiles.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("attachments_case_idx").on(t.caseId), index("attachments_task_idx").on(t.taskId)],
);

export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    caseId: uuid("case_id").references(() => cases.id, { onDelete: "cascade" }),
    taskId: uuid("task_id").references(() => tasks.id, { onDelete: "set null" }),
    actorId: uuid("actor_id").references(() => profiles.id),
    actorName: text("actor_name").notNull(),
    kind: auditKindEnum("kind").notNull(),
    fromValue: text("from_value"),
    toValue: text("to_value"),
    reason: text("reason"),
    description: text("description").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("audit_case_idx").on(t.caseId, t.createdAt)],
);

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    body: text("body").notNull().default(""),
    href: text("href"),
    // Prevents the reminder job from creating the same notification twice.
    dedupeKey: text("dedupe_key"),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("notifications_user_idx").on(t.userId, t.readAt),
    uniqueIndex("notifications_dedupe_idx").on(t.userId, t.dedupeKey).where(sql`${t.dedupeKey} is not null`),
  ],
);

// ---------------------------------------------------------------------------
// Templates and rules
// ---------------------------------------------------------------------------

export const templateSets = pgTable(
  "template_sets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    boardId: text("board_id")
      .notNull()
      .references(() => boards.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    // Applied automatically when a new case is created on this board.
    applyOnCreate: boolean("apply_on_create").notNull().default(false),
    position: integer("position").notNull().default(0),
  },
  (t) => [uniqueIndex("template_sets_board_key_idx").on(t.boardId, t.key)],
);

export const templateTasks = pgTable(
  "template_tasks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    setId: uuid("set_id")
      .notNull()
      .references(() => templateSets.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    lane: taskLaneEnum("lane").notNull().default("core"),
    position: integer("position").notNull().default(0),
    checklist: jsonb("checklist").$type<string[]>().notNull().default([]),
    // Optional relative due date: anchor + offset days.
    dueAnchor: deadlineAnchorEnum("due_anchor"),
    dueOffsetDays: integer("due_offset_days"),
  },
  (t) => [index("template_tasks_set_idx").on(t.setId)],
);

export const deadlineRules = pgTable(
  "deadline_rules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    boardId: text("board_id")
      .notNull()
      .references(() => boards.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    title: text("title").notNull(),
    kind: eventKindEnum("kind").notNull().default("deadline"),
    anchor: deadlineAnchorEnum("anchor").notNull(),
    offsetDays: integer("offset_days").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    notes: text("notes").notNull().default(""),
  },
  (t) => [uniqueIndex("deadline_rules_board_key_idx").on(t.boardId, t.key)],
);

export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// Inferred row types
// ---------------------------------------------------------------------------

export type Profile = typeof profiles.$inferSelect;
export type Board = typeof boards.$inferSelect;
export type Stage = typeof stages.$inferSelect;
export type Lane = typeof lanes.$inferSelect;
export type CaseType = typeof caseTypes.$inferSelect;
export type Case = typeof cases.$inferSelect;
export type NewCase = typeof cases.$inferInsert;
export type Task = typeof tasks.$inferSelect;
export type NewTask = typeof tasks.$inferInsert;
export type ChecklistItem = typeof checklistItems.$inferSelect;
export type CaseEvent = typeof events.$inferSelect;
export type NewCaseEvent = typeof events.$inferInsert;
export type Comment = typeof comments.$inferSelect;
export type Attachment = typeof attachments.$inferSelect;
export type AuditEntry = typeof auditLog.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
export type TemplateSet = typeof templateSets.$inferSelect;
export type TemplateTask = typeof templateTasks.$inferSelect;
export type DeadlineRule = typeof deadlineRules.$inferSelect;

export type UserRole = (typeof userRoleEnum.enumValues)[number];
export type CaseStatus = (typeof caseStatusEnum.enumValues)[number];
export type TaskStatus = (typeof taskStatusEnum.enumValues)[number];
export type TaskLane = (typeof taskLaneEnum.enumValues)[number];
export type Priority = (typeof priorityEnum.enumValues)[number];
export type EventKind = (typeof eventKindEnum.enumValues)[number];
export type EventStatus = (typeof eventStatusEnum.enumValues)[number];
export type WillStatus = (typeof willStatusEnum.enumValues)[number];
export type DeadlineAnchor = (typeof deadlineAnchorEnum.enumValues)[number];
export type AuditKind = (typeof auditKindEnum.enumValues)[number];
