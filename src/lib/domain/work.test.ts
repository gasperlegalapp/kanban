import { describe, expect, it } from "vitest";
import { bucketFor, isUrgent } from "./work";

const today = "2026-09-22";
const t = (p: Partial<{ status: "requested" | "waiting" | "review"; dueDate: string | null; followUpDate: string | null }>) => ({
  status: "requested" as const,
  dueDate: null,
  followUpDate: null,
  ...p,
});

describe("bucketFor", () => {
  it("sorts by due date first", () => {
    expect(bucketFor(t({ dueDate: "2026-09-21" }), today)).toBe("overdue");
    expect(bucketFor(t({ dueDate: "2026-09-22" }), today)).toBe("today");
    expect(bucketFor(t({ dueDate: "2026-09-29" }), today)).toBe("week");
    expect(bucketFor(t({ dueDate: "2026-09-30" }), today)).toBe("later");
    expect(bucketFor(t({}), today)).toBe("later");
  });

  it("surfaces waiting tasks when their follow-up date arrives", () => {
    expect(bucketFor(t({ status: "waiting", followUpDate: "2026-09-22" }), today)).toBe("follow_up");
    expect(bucketFor(t({ status: "waiting", followUpDate: "2026-09-10" }), today)).toBe("follow_up");
    expect(bucketFor(t({ status: "waiting", followUpDate: "2026-09-25" }), today)).toBe("later");
    // An overdue due date still wins over the follow-up.
    expect(bucketFor(t({ status: "waiting", followUpDate: "2026-09-10", dueDate: "2026-09-01" }), today)).toBe("overdue");
  });

  it("puts undated review tasks in their own section", () => {
    expect(bucketFor(t({ status: "review" }), today)).toBe("in_review");
    expect(bucketFor(t({ status: "review", dueDate: "2026-09-23" }), today)).toBe("week");
  });

  it("marks overdue, today and follow-ups as urgent", () => {
    expect(isUrgent(t({ dueDate: "2026-09-22" }), today)).toBe(true);
    expect(isUrgent(t({ status: "waiting", followUpDate: "2026-09-22" }), today)).toBe(true);
    expect(isUrgent(t({ dueDate: "2026-09-24" }), today)).toBe(false);
  });
});
