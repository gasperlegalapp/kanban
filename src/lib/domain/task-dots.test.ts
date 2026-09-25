import { describe, expect, it } from "vitest";
import { dotFlags, initials, sortForDots } from "./task-dots";

const today = "2026-09-22";

describe("task dots", () => {
  it("orders done first, then in-flight work, then not started, keeping original order within a status", () => {
    const tasks = [
      { id: "a", status: "requested" as const },
      { id: "b", status: "done" as const },
      { id: "c", status: "blocked" as const },
      { id: "d", status: "in_progress" as const },
      { id: "e", status: "done" as const },
      { id: "f", status: "review" as const },
      { id: "g", status: "backlog" as const },
      { id: "h", status: "waiting" as const },
    ];
    expect(sortForDots(tasks).map((t) => t.id)).toEqual(["b", "e", "f", "d", "h", "c", "a", "g"]);
  });

  it("flags not-started, overdue and follow-up-due tasks", () => {
    expect(dotFlags({ status: "requested", dueDate: null, followUpDate: null }, today)).toEqual({ notStarted: true, overdue: false, followUpDue: false });
    expect(dotFlags({ status: "in_progress", dueDate: "2026-09-21", followUpDate: null }, today).overdue).toBe(true);
    expect(dotFlags({ status: "in_progress", dueDate: "2026-09-22", followUpDate: null }, today).overdue).toBe(false);
    expect(dotFlags({ status: "done", dueDate: "2026-09-01", followUpDate: null }, today).overdue).toBe(false);
    expect(dotFlags({ status: "waiting", dueDate: null, followUpDate: "2026-09-22" }, today).followUpDue).toBe(true);
    expect(dotFlags({ status: "waiting", dueDate: null, followUpDate: "2026-09-23" }, today).followUpDue).toBe(false);
    expect(dotFlags({ status: "in_progress", dueDate: null, followUpDate: "2026-09-01" }, today).followUpDue).toBe(false);
  });

  it("builds initials", () => {
    expect(initials("Christopher Gasper")).toBe("CG");
    expect(initials("Grace")).toBe("G");
    expect(initials("  mary ann  smith jones ")).toBe("MAS");
  });
});
