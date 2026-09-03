import type {
  Attachment,
  AuditEntry,
  Board,
  Case,
  CaseEvent,
  CaseType,
  ChecklistItem,
  Comment,
  DeadlineRule,
  Lane,
  Profile,
  Stage,
  Task,
  TemplateSet,
  TemplateTask,
} from "@/db/schema";
import type { CaseMetrics } from "@/lib/domain/health";

export type PersonLite = Pick<Profile, "id" | "fullName" | "role" | "isActive" | "email">;

export type StageNode = Stage & { children: StageNode[] };

export type BoardConfig = {
  board: Board;
  /** Top-level stages (groups and standalone), each with children. */
  stageTree: StageNode[];
  /** Every stage a case can sit in, in board order. */
  leafStages: Stage[];
  lanes: Lane[];
  caseTypes: CaseType[];
  people: PersonLite[];
  templateSets: (TemplateSet & { tasks: TemplateTask[] })[];
  deadlineRules: DeadlineRule[];
};

export type TaskSummary = Task & {
  assigneeName: string | null;
  checklistTotal: number;
  checklistDone: number;
  subtaskCount: number;
};

export type CaseSummary = Case & {
  stage: Stage;
  lane: Lane | null;
  caseType: CaseType | null;
  ownerName: string | null;
  metrics: CaseMetrics;
  tasks: TaskSummary[];
  events: CaseEvent[];
};

export type TaskDetail = Task & {
  assigneeName: string | null;
  checklist: (ChecklistItem & { assigneeName: string | null })[];
  subtasks: TaskSummary[];
  comments: Comment[];
  attachments: Attachment[];
  caseTitle: string;
  boardId: string;
};

export type CaseDetail = CaseSummary & {
  comments: Comment[];
  attachments: Attachment[];
  audit: AuditEntry[];
  checklistByTask: Record<string, (ChecklistItem & { assigneeName: string | null })[]>;
};
