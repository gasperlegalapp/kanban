import { describe, expect, it } from "vitest";
import { computeCaseMetrics } from "./health";
import type { CaseEvent } from "@/db/schema";

const now = new Date("2026-09-02T12:00:00Z");
const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000);
const iso = (d: Date) => d.toISOString().slice(0, 10);

const stage = { stuckDays: 14, criticalDays: 30, isClosed: false, isArchive: false };

function event(partial: Partial<CaseEvent>): CaseEvent {
  return {
    id: "e",
    caseId: "c",
    kind: "deadline",
    title: "Inventory Due",
    date: iso(now),
    time: null,
    status: "pending",
    ruleKey: null,
    notes: "",
    createdAt: now,
    createdBy: null,
    externalRef: null,
    ...partial,
  };
}

describe("computeCaseMetrics", () => {
  it("is green for a fresh case with nothing open", () => {
    const m = computeCaseMetrics({ stageEnteredAt: daysAgo(1), status: "active" }, stage, [], [], now);
    expect(m.health).toBe("green");
    expect(m.daysInStage).toBe(1);
    expect(m.openTasks).toBe(0);
  });

  it("counts open, overdue and review tasks", () => {
    const m = computeCaseMetrics(
      { stageEnteredAt: daysAgo(2), status: "active" },
      stage,
      [
        { status: "in_progress", dueDate: iso(daysAgo(3)) },
        { status: "review", dueDate: null },
        { status: "done", dueDate: iso(daysAgo(10)) },
        { status: "waiting", dueDate: iso(daysAgo(-5)) },
      ],
      [],
      now,
    );
    expect(m.openTasks).toBe(3);
    expect(m.overdueTasks).toBe(1);
    expect(m.reviewTasks).toBe(1);
    expect(m.waitingTasks).toBe(1);
    expect(m.health).toBe("yellow");
  });

  it("turns yellow when stuck and red when critical", () => {
    expect(computeCaseMetrics({ stageEnteredAt: daysAgo(15), status: "active" }, stage, [], [], now).health).toBe("yellow");
    expect(computeCaseMetrics({ stageEnteredAt: daysAgo(31), status: "active" }, stage, [], [], now).health).toBe("red");
  });

  it("turns red with three or more overdue tasks", () => {
    const overdue = { status: "requested" as const, dueDate: iso(daysAgo(1)) };
    const m = computeCaseMetrics({ stageEnteredAt: daysAgo(1), status: "active" }, stage, [overdue, overdue, overdue], [], now);
    expect(m.health).toBe("red");
  });

  it("flags overdue deadlines red and upcoming deadlines yellow", () => {
    const overdue = computeCaseMetrics(
      { stageEnteredAt: daysAgo(1), status: "active" },
      stage,
      [],
      [event({ date: iso(daysAgo(1)) })],
      now,
    );
    expect(overdue.overdueEvents).toBe(1);
    expect(overdue.health).toBe("red");

    const soon = computeCaseMetrics(
      { stageEnteredAt: daysAgo(1), status: "active" },
      stage,
      [],
      [event({ date: iso(daysAgo(-3)) })],
      now,
    );
    expect(soon.health).toBe("yellow");
    expect(soon.daysToNextEvent).toBe(3);
    expect(soon.nextEvent?.title).toBe("Inventory Due");

    const later = computeCaseMetrics(
      { stageEnteredAt: daysAgo(1), status: "active" },
      stage,
      [],
      [event({ date: iso(daysAgo(-30)) })],
      now,
    );
    expect(later.health).toBe("green");
  });

  it("ignores done and cancelled events", () => {
    const m = computeCaseMetrics(
      { stageEnteredAt: daysAgo(1), status: "active" },
      stage,
      [],
      [event({ date: iso(daysAgo(10)), status: "done" }), event({ date: iso(daysAgo(10)), status: "cancelled" })],
      now,
    );
    expect(m.overdueEvents).toBe(0);
    expect(m.nextEvent).toBeNull();
    expect(m.health).toBe("green");
  });

  it("never flags closed cases or closed stages", () => {
    const closedStage = { ...stage, isClosed: true };
    const m = computeCaseMetrics({ stageEnteredAt: daysAgo(400), status: "active" }, closedStage, [], [], now);
    expect(m.health).toBe("green");
    const m2 = computeCaseMetrics({ stageEnteredAt: daysAgo(400), status: "closed" }, stage, [], [], now);
    expect(m2.health).toBe("green");
  });
});
