import { describe, expect, it } from "vitest";
import { cleanCaseTitle, extractAppointmentDate, extractCaseNumber, transformBusinessmapExport, type BmCard, type BmExport } from "./businessmap";
import { htmlToText } from "./html";

function card(partial: Partial<BmCard> & Pick<BmCard, "card_id" | "workflow_name" | "column_name" | "title">): BmCard {
  return {
    custom_id: null,
    board_id: 8,
    lane_name: null,
    description: null,
    color: null,
    deadline: null,
    owner_username: null,
    custom_fields: [],
    created_at: "2026-05-01T10:00:00Z",
    last_modified: "2026-06-01T10:00:00Z",
    in_current_position_since: "2026-05-20T10:00:00Z",
    ...partial,
  };
}

const fixture: BmExport = {
  cards: [
    card({
      card_id: 1,
      custom_id: "ADKINS - 621456",
      workflow_name: "Probate Case Workflow",
      column_name: "Inventory",
      lane_name: "Full Estate",
      title: "Adkins - Full Estate",
      owner_username: "Christopher Gasper",
      description: "<p>Notes about the <strong>estate</strong>.</p>",
      custom_fields: [
        { field_name: "County of Case", field_type: "single_line_text", display_value: "Franklin" },
        { field_name: "Is there a Will?", field_type: "dropdown", display_value: "Testate" },
        { field_name: "Fiduciary", field_type: "single_line_text", display_value: "Christopher Gasper" },
      ],
    }),
    card({ card_id: 2, workflow_name: "Tasks Workflow", column_name: "In Progress", lane_name: "Core Casework", title: "Assets / Inventory" }),
    card({
      card_id: 3,
      workflow_name: "Tasks Workflow",
      column_name: "Done",
      lane_name: "Assets / Financial",
      title: "Estate Checking Account - Adkins",
      first_end_time: "2026-05-15T10:00:00Z",
    }),
    card({ card_id: 4, workflow_name: "Hearings / Deadlines", column_name: "Requested", lane_name: "Deadline", title: "Inventory Due - Adkins" }),
    card({ card_id: 5, workflow_name: "Tasks Workflow", column_name: "Waiting", lane_name: "Litigation / Urgent", title: "Land Sale - Blair", custom_id: "Blair-Land Sale" }),
    card({ card_id: 6, workflow_name: "Tasks Workflow", column_name: "Done", lane_name: "Core Casework", title: "Appointment on Estate", description: "<p>Appointed March 16, 2026</p>" }),
    card({ card_id: 7, board_id: 12, workflow_name: "Guardianship Case Workflow", column_name: "Application", lane_name: "Paid Cases", title: "[GOE] Smith, Eleanor" }),
    card({ card_id: 99, board_id: 12, workflow_name: "Guardianship Case Workflow", column_name: "Application", lane_name: "Paid Cases", title: "BOARD KEY - reference" }),
  ],
  subtasks: [
    { card_id: 1, description: "Send Engagement Fee Agreement", is_finished: true, owner_username: null, deadline: null },
    { card_id: 1, description: "Engagement signed by client", is_finished: true, owner_username: null, deadline: null },
    { card_id: 3, description: "Create EIN", is_finished: true, owner_username: "Grace", deadline: "2026-05-10T12:00:00Z", finished_at: "2026-05-09T12:00:00Z" },
    { card_id: 5, description: "Title Search", is_finished: true, owner_username: null, deadline: null },
    { card_id: 5, description: "Closing", is_finished: false, owner_username: null, deadline: null },
  ],
  comments: [
    { comment_id: "10", card_id: 3, type: "internal_comment", author: "Christine", created_at: "2026-05-12T10:00:00Z", text: "Account opened." },
    { comment_id: "11", card_id: 1, type: "internal_comment", author: "Grace", created_at: "2026-05-13T10:00:00Z", text: "Client called." },
  ],
  childToParents: { "2": [1], "3": [1, 2], "4": [1], "6": [1] },
  plannedEndDates: { "4": "2026-06-17" },
};

describe("transformBusinessmapExport", () => {
  const out = transformBusinessmapExport(fixture);

  it("maps case cards with stage, lane, custom fields and case number", () => {
    const adkins = out.cases.find((c) => c.key === "card:1")!;
    expect(adkins).toMatchObject({
      boardId: "probate",
      stageKey: "inventory",
      laneKey: "full_estate",
      caseTypeKey: "full_estate",
      title: "Adkins",
      caseNumber: "621456",
      county: "Franklin",
      willStatus: "testate",
      fiduciary: "Christopher Gasper",
      ownerName: "Christopher Gasper",
      description: "Notes about the estate.",
      stageEnteredAt: "2026-05-20T10:00:00Z",
    });
    expect(adkins.externalRef.url).toBe("https://gasperlegal.businessmap.io/ctrl_board/8/cards/1");
  });

  it("turns the engagement checklist on the case card into a task", () => {
    const eng = out.tasks.find((t) => t.key === "card:1:engagement")!;
    expect(eng.status).toBe("done");
    expect(eng.checklist.map((i) => i.text)).toEqual(["Send Engagement Fee Agreement", "Engagement signed by client"]);
  });

  it("links tasks to cases and nests sub-task cards under their parent task", () => {
    const assets = out.tasks.find((t) => t.key === "card:2")!;
    expect(assets).toMatchObject({ caseKey: "card:1", parentTaskKey: null, status: "in_progress", lane: "core" });
    const account = out.tasks.find((t) => t.key === "card:3")!;
    expect(account).toMatchObject({ caseKey: "card:1", parentTaskKey: "card:2", status: "done", lane: "assets", completedAt: "2026-05-15T10:00:00Z" });
    expect(account.checklist[0]).toMatchObject({ text: "Create EIN", isDone: true, assigneeName: "Grace", dueDate: "2026-05-10", doneAt: "2026-05-09T12:00:00Z" });
  });

  it("imports deadline cards as events using the planned end date", () => {
    expect(out.events).toEqual([
      expect.objectContaining({ key: "card:4", caseKey: "card:1", kind: "deadline", title: "Inventory Due", date: "2026-06-17", status: "pending" }),
    ]);
  });

  it("creates a case for orphan litigation cards and keeps the card as a task", () => {
    const blair = out.cases.find((c) => c.key === "orphan:5")!;
    expect(blair).toMatchObject({ boardId: "probate", title: "Blair", caseTypeKey: "land_sale", laneKey: "litigation", stageKey: "execution_admin" });
    const task = out.tasks.find((t) => t.key === "card:5")!;
    expect(task).toMatchObject({ caseKey: "orphan:5", status: "waiting", lane: "litigation" });
    expect(task.checklist).toHaveLength(2);
    expect(out.warnings.some((w) => w.includes('"Land Sale - Blair"'))).toBe(true);
  });

  it("picks up the appointment date from a task description", () => {
    expect(out.cases.find((c) => c.key === "card:1")!.appointmentDate).toBe("2026-03-16");
  });

  it("maps guardianship type prefixes and skips the board key card", () => {
    const smith = out.cases.find((c) => c.key === "card:7")!;
    expect(smith).toMatchObject({ boardId: "guardianship", caseTypeKey: "goe", title: "Smith, Eleanor", stageKey: "application", laneKey: "paid" });
    expect(out.cases.find((c) => c.key === "card:99")).toBeUndefined();
  });

  it("attaches comments to the right entity", () => {
    expect(out.comments).toEqual([
      expect.objectContaining({ targetType: "task", targetKey: "card:3", authorName: "Christine", body: "Account opened." }),
      expect.objectContaining({ targetType: "case", targetKey: "card:1", authorName: "Grace", body: "Client called." }),
    ]);
  });
});

describe("helpers", () => {
  it("cleans titles", () => {
    expect(cleanCaseTitle("Baker, Debra Ann - Full Estate", "")).toBe("Baker, Debra Ann");
    expect(cleanCaseTitle("Duque Ruiz- Wrongful Death Probate Estate", "")).toBe("Duque Ruiz");
    expect(cleanCaseTitle("Land Sale - McCord Case A", "")).toBe("McCord Case A");
    expect(cleanCaseTitle("Concealment- Morris", "")).toBe("Morris");
    expect(cleanCaseTitle("", "Probate estate of Aleksandr Y. Mashkovskiy, surviving spouse is")).toBe("Mashkovskiy, Aleksandr Y.");
  });

  it("extracts case numbers", () => {
    expect(extractCaseNumber("Kirsch - 643576", "")).toBe("643576");
    expect(extractCaseNumber("Baker -", "The Franklin County Probate Case No. 642088 is opened.")).toBe("642088");
    expect(extractCaseNumber(null, "nothing here")).toBeNull();
  });

  it("extracts appointment dates", () => {
    expect(extractAppointmentDate("Appointed March 16, 2026")).toBe("2026-03-16");
    expect(extractAppointmentDate("no date")).toBeNull();
  });

  it("converts html to text", () => {
    expect(htmlToText("<p>EIN:</p><p>12-3456789&nbsp;</p><p>&nbsp;</p><p>Line<br>Two</p>")).toBe("EIN:\n12-3456789\n\nLine\nTwo");
    expect(htmlToText("<table><tr><th>Recipient</th><th>Status</th></tr><tr><td>Marty</td><td>Sent</td></tr></table>")).toBe(
      "Recipient\tStatus\nMarty\tSent",
    );
  });
});
