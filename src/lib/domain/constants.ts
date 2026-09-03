import type { EventKind, Priority, TaskLane, TaskStatus, UserRole } from "@/db/schema";

export const TASK_STATUSES: { id: TaskStatus; label: string; color: string; hint: string }[] = [
  { id: "backlog", label: "Backlog", color: "#94a3b8", hint: "Ideas and future work." },
  { id: "requested", label: "Requested", color: "#64748b", hint: "Not yet ready to work." },
  { id: "in_progress", label: "In Progress", color: "#2563eb", hint: "Actively being worked by someone." },
  { id: "waiting", label: "Waiting", color: "#d97706", hint: "Waiting on client, bank, court or third party." },
  { id: "review", label: "Review", color: "#7c3aed", hint: "Attorney review required." },
  { id: "blocked", label: "Blocked", color: "#dc2626", hint: "Internal issue or error." },
  { id: "done", label: "Done", color: "#059669", hint: "Complete." },
];

export const TASK_STATUS_MAP = new Map(TASK_STATUSES.map((s) => [s.id, s]));

export const TASK_LANES: { id: TaskLane; label: string; hint: string }[] = [
  { id: "core", label: "Core Casework", hint: "Court filings, notices, inventory, reporting, client communication, accounting." },
  { id: "assets", label: "Assets / Financial", hint: "Bank accounts, real estate, vehicles, investments, income, insurance." },
  { id: "litigation", label: "Litigation / Urgent", hint: "Contested matters, motions, objections, discovery, emergency action." },
  { id: "social", label: "Social Work", hint: "Visits, placement and care coordination." },
];

export const TASK_LANE_MAP = new Map(TASK_LANES.map((l) => [l.id, l]));

/** Which task lanes a board uses, in display order. */
export const BOARD_TASK_LANES: Record<string, TaskLane[]> = {
  probate: ["core", "assets", "litigation"],
  guardianship: ["core", "social", "assets", "litigation"],
};

export const PRIORITIES: { id: Priority; label: string; color: string }[] = [
  { id: "low", label: "Low", color: "#94a3b8" },
  { id: "normal", label: "Normal", color: "#3b82f6" },
  { id: "high", label: "High", color: "#f59e0b" },
  { id: "urgent", label: "Urgent", color: "#ef4444" },
];

export const PRIORITY_MAP = new Map(PRIORITIES.map((p) => [p.id, p]));

export const EVENT_KINDS: { id: EventKind; label: string; color: string }[] = [
  { id: "hearing", label: "Hearing", color: "#7c3aed" },
  { id: "deadline", label: "Deadline", color: "#dc2626" },
];

export const ROLE_LABELS: Record<UserRole, string> = {
  attorney: "Attorney",
  staff: "Staff",
};

export const HEALTH_COLORS = {
  green: "#10b981",
  yellow: "#f59e0b",
  red: "#ef4444",
} as const;

export const WILL_STATUS_LABELS = {
  testate: "Testate (has a Will)",
  intestate: "Intestate (no Will)",
  unknown: "Unknown",
} as const;
