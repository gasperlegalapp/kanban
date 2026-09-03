import { relations } from "drizzle-orm";
import {
  attachments,
  auditLog,
  boards,
  cases,
  caseTypes,
  checklistItems,
  comments,
  deadlineRules,
  events,
  lanes,
  notifications,
  profiles,
  stages,
  tasks,
  templateSets,
  templateTasks,
} from "./schema";

export const boardsRelations = relations(boards, ({ many }) => ({
  stages: many(stages),
  lanes: many(lanes),
  caseTypes: many(caseTypes),
  cases: many(cases),
  templateSets: many(templateSets),
  deadlineRules: many(deadlineRules),
}));

export const stagesRelations = relations(stages, ({ one, many }) => ({
  board: one(boards, { fields: [stages.boardId], references: [boards.id] }),
  parent: one(stages, { fields: [stages.parentId], references: [stages.id], relationName: "stage_children" }),
  children: many(stages, { relationName: "stage_children" }),
  cases: many(cases),
}));

export const lanesRelations = relations(lanes, ({ one, many }) => ({
  board: one(boards, { fields: [lanes.boardId], references: [boards.id] }),
  cases: many(cases),
}));

export const caseTypesRelations = relations(caseTypes, ({ one, many }) => ({
  board: one(boards, { fields: [caseTypes.boardId], references: [boards.id] }),
  cases: many(cases),
}));

export const profilesRelations = relations(profiles, ({ many }) => ({
  ownedCases: many(cases),
  assignedTasks: many(tasks),
  notifications: many(notifications),
}));

export const casesRelations = relations(cases, ({ one, many }) => ({
  board: one(boards, { fields: [cases.boardId], references: [boards.id] }),
  stage: one(stages, { fields: [cases.stageId], references: [stages.id] }),
  lane: one(lanes, { fields: [cases.laneId], references: [lanes.id] }),
  caseType: one(caseTypes, { fields: [cases.caseTypeId], references: [caseTypes.id] }),
  owner: one(profiles, { fields: [cases.ownerId], references: [profiles.id] }),
  tasks: many(tasks),
  events: many(events),
  comments: many(comments),
  attachments: many(attachments),
  audit: many(auditLog),
}));

export const tasksRelations = relations(tasks, ({ one, many }) => ({
  case: one(cases, { fields: [tasks.caseId], references: [cases.id] }),
  assignee: one(profiles, { fields: [tasks.assigneeId], references: [profiles.id] }),
  parent: one(tasks, { fields: [tasks.parentTaskId], references: [tasks.id], relationName: "task_children" }),
  subtasks: many(tasks, { relationName: "task_children" }),
  checklist: many(checklistItems),
  comments: many(comments),
  attachments: many(attachments),
}));

export const checklistItemsRelations = relations(checklistItems, ({ one }) => ({
  task: one(tasks, { fields: [checklistItems.taskId], references: [tasks.id] }),
  assignee: one(profiles, { fields: [checklistItems.assigneeId], references: [profiles.id] }),
}));

export const eventsRelations = relations(events, ({ one }) => ({
  case: one(cases, { fields: [events.caseId], references: [cases.id] }),
}));

export const commentsRelations = relations(comments, ({ one }) => ({
  case: one(cases, { fields: [comments.caseId], references: [cases.id] }),
  task: one(tasks, { fields: [comments.taskId], references: [tasks.id] }),
  author: one(profiles, { fields: [comments.authorId], references: [profiles.id] }),
}));

export const attachmentsRelations = relations(attachments, ({ one }) => ({
  case: one(cases, { fields: [attachments.caseId], references: [cases.id] }),
  task: one(tasks, { fields: [attachments.taskId], references: [tasks.id] }),
  uploader: one(profiles, { fields: [attachments.uploadedBy], references: [profiles.id] }),
}));

export const auditLogRelations = relations(auditLog, ({ one }) => ({
  case: one(cases, { fields: [auditLog.caseId], references: [cases.id] }),
  task: one(tasks, { fields: [auditLog.taskId], references: [tasks.id] }),
  actor: one(profiles, { fields: [auditLog.actorId], references: [profiles.id] }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(profiles, { fields: [notifications.userId], references: [profiles.id] }),
}));

export const templateSetsRelations = relations(templateSets, ({ one, many }) => ({
  board: one(boards, { fields: [templateSets.boardId], references: [boards.id] }),
  tasks: many(templateTasks),
}));

export const templateTasksRelations = relations(templateTasks, ({ one }) => ({
  set: one(templateSets, { fields: [templateTasks.setId], references: [templateSets.id] }),
}));

export const deadlineRulesRelations = relations(deadlineRules, ({ one }) => ({
  board: one(boards, { fields: [deadlineRules.boardId], references: [boards.id] }),
}));
