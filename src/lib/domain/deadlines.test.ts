import { describe, expect, it } from "vitest";
import { computeDeadlines } from "./deadlines";
import type { DeadlineRule } from "@/db/schema";

const rules: DeadlineRule[] = [
  { id: "1", boardId: "probate", key: "inventory_due", title: "Inventory Due", kind: "deadline", anchor: "appointment_date", offsetDays: 90, isActive: true, notes: "" },
  { id: "2", boardId: "probate", key: "final_account_due", title: "Final Account Due", kind: "deadline", anchor: "appointment_date", offsetDays: 180, isActive: true, notes: "" },
  { id: "3", boardId: "probate", key: "inactive", title: "Inactive", kind: "deadline", anchor: "appointment_date", offsetDays: 1, isActive: false, notes: "" },
  { id: "4", boardId: "probate", key: "from_death", title: "From death", kind: "deadline", anchor: "date_of_death", offsetDays: 10, isActive: true, notes: "" },
];

describe("computeDeadlines", () => {
  it("computes dates from the appointment date and skips inactive rules and unknown anchors", () => {
    const out = computeDeadlines({ appointmentDate: "2026-03-17", dateOfDeath: null, createdAt: new Date("2026-01-01") }, rules);
    expect(out.map((d) => [d.ruleKey, d.date])).toEqual([
      ["inventory_due", "2026-06-15"],
      ["final_account_due", "2026-09-13"],
    ]);
  });

  it("returns nothing when no anchor dates are known", () => {
    expect(computeDeadlines({ appointmentDate: null, dateOfDeath: null, createdAt: new Date() }, rules)).toEqual([]);
  });

  it("uses the date of death when that anchor is set", () => {
    const out = computeDeadlines({ appointmentDate: null, dateOfDeath: "2026-05-14", createdAt: new Date() }, rules);
    expect(out).toEqual([{ ruleKey: "from_death", title: "From death", kind: "deadline", date: "2026-05-24" }]);
  });
});
