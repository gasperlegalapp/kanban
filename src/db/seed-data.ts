// Firm configuration seeded into an empty database. This mirrors the Gasper
// Legal boards in Businessmap as of September 2026. Everything here can be
// edited later in the app (Settings and Templates pages); this is only the
// starting point.

import type { DeadlineAnchor, EventKind, TaskLane, UserRole } from "./schema";

export type StageSeed = {
  key: string;
  name: string;
  policy?: string;
  stuckDays?: number;
  criticalDays?: number;
  isClosed?: boolean;
  isArchive?: boolean;
  children?: StageSeed[];
};

export type TemplateTaskSeed = {
  title: string;
  description?: string;
  lane?: TaskLane;
  checklist?: string[];
  dueAnchor?: DeadlineAnchor;
  dueOffsetDays?: number;
};

export type TemplateSetSeed = {
  key: string;
  name: string;
  description?: string;
  applyOnCreate?: boolean;
  tasks: TemplateTaskSeed[];
};

export type DeadlineRuleSeed = {
  key: string;
  title: string;
  kind?: EventKind;
  anchor: DeadlineAnchor;
  offsetDays: number;
  notes?: string;
};

export type BoardSeed = {
  id: string;
  name: string;
  description: string;
  stages: StageSeed[];
  lanes: { key: string; name: string }[];
  caseTypes: { key: string; name: string; prefix?: string; color: string }[];
  templateSets: TemplateSetSeed[];
  deadlineRules: DeadlineRuleSeed[];
};

const NEW_CLIENT_INTAKE_POLICY =
  "Client contacts us - send intake form. Once we are engaged (signed agreement), move to Case Intake.";

export const PROBATE_BOARD: BoardSeed = {
  id: "probate",
  name: "Probate Cases",
  description: "Estate administration matters.",
  stages: [
    { key: "new_client_intake", name: "New Client Intake", policy: NEW_CLIENT_INTAKE_POLICY, stuckDays: 7, criticalDays: 14 },
    {
      key: "start_phase",
      name: "Start Phase",
      children: [
        {
          key: "case_intake",
          name: "Case Intake",
          policy:
            "Initial - meeting with client, getting retained and starting work including gathering documents and information.",
          stuckDays: 14,
          criticalDays: 30,
        },
        { key: "application", name: "Application", policy: "Drafting and filing the application for appointment.", stuckDays: 21, criticalDays: 45 },
        { key: "appointment", name: "Appointment", policy: "Filed; waiting on the hearing and letters of authority.", stuckDays: 30, criticalDays: 60 },
      ],
    },
    {
      key: "administration_phase",
      name: "Probate Administration Phase",
      children: [
        { key: "inventory", name: "Inventory", policy: "Inventory is due 3 months after appointment.", stuckDays: 60, criticalDays: 90 },
        { key: "execution_admin", name: "Execution (Admin)", policy: "Collect assets, pay debts and expenses, manage the estate.", stuckDays: 120, criticalDays: 240 },
        { key: "reporting", name: "Reporting", stuckDays: 30, criticalDays: 60 },
      ],
    },
    {
      key: "final_phase",
      name: "Final Phase",
      children: [
        { key: "accounting", name: "Accounting", policy: "Final account is due 6 months after appointment unless extended.", stuckDays: 45, criticalDays: 90 },
        { key: "distribution", name: "Distribution", stuckDays: 30, criticalDays: 60 },
        { key: "wrap_up", name: "Wrap-up", stuckDays: 21, criticalDays: 45 },
      ],
    },
    { key: "closed", name: "Closed", isClosed: true },
    { key: "ready_to_archive", name: "Ready to Archive", isArchive: true },
  ],
  lanes: [
    { key: "full_estate", name: "Full Estate" },
    { key: "no_admin", name: "No Admin" },
    // Not a Businessmap lane. Holds land sales, concealment, heirship and
    // similar proceedings that were tracked as loose task cards there.
    { key: "litigation", name: "Litigation" },
  ],
  caseTypes: [
    { key: "full_estate", name: "Full Estate", color: "#34a97b" },
    { key: "release_from_admin", name: "Release from Administration", color: "#0ea5e9" },
    { key: "wrongful_death", name: "Wrongful Death Estate", color: "#8b5cf6" },
    { key: "land_sale", name: "Land Sale", color: "#af0020" },
    { key: "concealment", name: "Concealment Action", color: "#2666be" },
    { key: "heirship", name: "Heirship Determination", color: "#2666be" },
    { key: "other", name: "Other", color: "#64748b" },
  ],
  templateSets: [
    {
      key: "probate_standard",
      name: "Standard probate task set",
      description: "Created automatically for every new probate case.",
      applyOnCreate: true,
      tasks: [
        { title: "Start Case", checklist: ["Open case in Actionstep", "Update information in Actionstep"] },
        {
          title: "Confirm Parties and Status",
          description: "Confirm who will be Executor/Administrator. If there is a Will, we must get the original.",
          checklist: ["Confirm who is Fiduciary", "Gather Estate Documents, if any"],
        },
        {
          title: "Gather Info & Docs",
          checklist: ["Collect Case Intake Form", "Get Certificate of Death", "Confirm Next of Kin and Parties"],
        },
        { title: "Application Drafting", checklist: ["Draft Initial Probate Documents", "Attorney review documents"] },
        {
          title: "Waivers Admin / Will",
          description:
            "Track each waiver recipient with a status (Not Sent, Sent, Received, Problem) and the date received.",
          checklist: ["Waivers sent to all parties", "Received signed waivers from all parties", "Filed waivers to Court"],
        },
        { title: "File with Court", checklist: ["Get documents signed", "File with the Court"] },
        {
          title: "Appointment on Estate",
          checklist: [
            "Court docket shows appointment",
            "Hearing - enter on Calendars",
            "Notify Client and necessary parties of hearing",
            "Hearing Prep",
            "Received letters",
          ],
        },
        { title: "Letters Issued", checklist: ["Update Actionstep", "Send letters to Fiduciary"] },
        {
          title: "Fiduciary Claim(s)",
          description:
            "The fiduciary has 3 months from appointment to file a claim for anything they are owed by the estate. An attorney fiduciary does not have to file a claim. If there is no claim, mark this done.",
          checklist: ["Confirm with Fiduciary if they are owed anything", "Contact client to confirm they are not owed anything by the estate"],
          dueAnchor: "appointment_date",
          dueOffsetDays: 90,
        },
        {
          title: "Assets / Inventory",
          lane: "assets",
          description:
            "Add each asset as a sub-task: bank accounts, IRAs, investment accounts, vehicles, real estate, insurance.",
        },
        {
          title: "Estate Checking Account",
          lane: "assets",
          checklist: ["Create EIN", "Open Estate Checking Account", "Record account information in the task and mark done"],
        },
        {
          title: "Inventory - Filing",
          description: "Gather the inventory assets, draft and file the inventory with waivers. Due 3 months after appointment.",
          checklist: ["Gather assets for Inventory", "Draft Inventory", "Review Inventory", "Gather waivers", "File Inventory"],
          dueAnchor: "appointment_date",
          dueOffsetDays: 90,
        },
        {
          title: "Pay Debts / Expenses",
          lane: "assets",
          description:
            "Once the inventory is filed and approved, pay bills from the estate. Track debts and major expenses such as insurance, bond and taxes here.",
          checklist: ["Taxes"],
        },
      ],
    },
    {
      key: "probate_asset",
      name: "Financial asset",
      description: "Add to a case for each bank, brokerage or insurance account to work.",
      tasks: [
        {
          title: "Asset",
          lane: "assets",
          checklist: ["Contact Company", "Get on account", "Get current records", "Enter into Actionstep", "Settle asset"],
        },
      ],
    },
    {
      key: "land_sale",
      name: "Land Sale",
      description: "Court proceeding to sell real estate.",
      tasks: [
        {
          title: "Land Sale",
          lane: "litigation",
          checklist: [
            "Title Search",
            "Draft Complaint",
            "Service",
            "Waivers signed by next of kin",
            "Default",
            "Request Updated Title Search",
            "Find Sale Necessary and Order Appraisal",
            "Bond - ready",
            "Approve Appraisal, Bond, Order of Sale",
            "List House for Sale",
            "In Contract",
            "Confirmation of Sale",
            "Closing",
            "Report of Distribution",
          ],
        },
      ],
    },
    {
      key: "litigation_action",
      name: "Litigation action (concealment, heirship, contested matter)",
      tasks: [
        { title: "Litigation", lane: "litigation", checklist: ["Draft Complaint", "Service", "Default", "Mediation"] },
      ],
    },
  ],
  deadlineRules: [
    {
      key: "inventory_due",
      title: "Inventory Due",
      anchor: "appointment_date",
      offsetDays: 90,
      notes: "Ohio R.C. 2115.02: inventory within three months of appointment.",
    },
    {
      key: "fiduciary_claim_deadline",
      title: "Fiduciary claim deadline",
      anchor: "appointment_date",
      offsetDays: 90,
      notes: "Fiduciary has three months from appointment to present a claim.",
    },
    {
      key: "final_account_due",
      title: "Final Account Due",
      anchor: "appointment_date",
      offsetDays: 180,
      notes: "Ohio R.C. 2109.301: final account within six months of appointment unless extended.",
    },
  ],
};

export const GUARDIANSHIP_BOARD: BoardSeed = {
  id: "guardianship",
  name: "Guardianship Cases",
  description: "Adult and minor guardianships.",
  stages: [
    { key: "new_client_intake", name: "New Client Intake", policy: NEW_CLIENT_INTAKE_POLICY, stuckDays: 7, criticalDays: 14 },
    {
      key: "start_phase",
      name: "Start Phase",
      children: [
        {
          key: "case_intake_soee",
          name: "Case Intake - SOEE and docs",
          policy:
            "Initial - meeting with client, getting retained and gathering documents. Must have a Statement of Expert Evaluation (SOEE) or be working to get it.",
          stuckDays: 14,
          criticalDays: 30,
        },
        {
          key: "application",
          name: "Application",
          policy: "We have the information to draft; drafting application documents and filing for appointment of a guardian.",
          stuckDays: 21,
          criticalDays: 45,
        },
        {
          key: "appointment",
          name: "Appointment",
          policy: "Everything is filed; waiting on a hearing and working on appointment. Once appointed, move to Execution.",
          stuckDays: 30,
          criticalDays: 60,
        },
      ],
    },
    {
      key: "execution_phase",
      name: "Execution Phase",
      children: [
        { key: "execution", name: "Execution", stuckDays: 60, criticalDays: 120 },
        { key: "maintenance", name: "Maintenance", stuckDays: 180, criticalDays: 365 },
        { key: "reporting_fee", name: "Reporting/Fee", stuckDays: 30, criticalDays: 60 },
      ],
    },
    {
      key: "medicaid_spenddown",
      name: "Medicaid Spenddown",
      children: [
        { key: "spenddown_phase", name: "Spenddown Phase", stuckDays: 60, criticalDays: 120 },
        { key: "reports_and_application", name: "Reports and Application", stuckDays: 30, criticalDays: 60 },
        { key: "discharge_bond_release", name: "Discharge & Bond Release", stuckDays: 30, criticalDays: 60 },
      ],
    },
    {
      key: "termination",
      name: "Termination",
      children: [
        { key: "termination_event", name: "Event", stuckDays: 30, criticalDays: 60 },
        { key: "termination_report", name: "Report", stuckDays: 30, criticalDays: 60 },
        { key: "termination_discharge", name: "Discharge", stuckDays: 30, criticalDays: 60 },
      ],
    },
    { key: "closed", name: "Closed", isClosed: true },
    { key: "ready_to_archive", name: "Ready to Archive", isArchive: true },
  ],
  lanes: [
    { key: "paid", name: "Paid Cases" },
    { key: "indigent", name: "Indigent Cases" },
  ],
  caseTypes: [
    { key: "gop", name: "Guardian of Person", prefix: "GOP", color: "#185FA5" },
    { key: "goe", name: "Guardian of Estate", prefix: "GOE", color: "#BA7517" },
    { key: "both", name: "Person + Estate", prefix: "BOTH", color: "#534AB7" },
    { key: "minor", name: "Minor Guardianship", prefix: "MINOR", color: "#639922" },
  ],
  templateSets: [
    {
      key: "guardianship_standard",
      name: "Standard guardianship task set (starter)",
      description: "Starter set based on the guardianship board columns. Edit to match how the firm works.",
      applyOnCreate: true,
      tasks: [
        { title: "Start Case", checklist: ["Open case in Actionstep", "Update information in Actionstep"] },
        {
          title: "Gather Info & Docs",
          checklist: [
            "Collect Case Intake Form",
            "Obtain Statement of Expert Evaluation (SOEE)",
            "Confirm next of kin and interested parties",
            "Gather ward's financial information",
          ],
        },
        { title: "Application Drafting", checklist: ["Draft application for appointment of guardian", "Attorney review documents"] },
        { title: "File with Court", checklist: ["Get documents signed", "File with the Court", "Arrange service on ward and next of kin"] },
        {
          title: "Appointment Hearing",
          checklist: ["Hearing - enter on Calendars", "Notify client and parties of hearing", "Hearing Prep", "Letters of Guardianship received"],
        },
        { title: "Bond", lane: "assets", checklist: ["Obtain bond quote", "File bond"] },
        {
          title: "Guardian's Inventory",
          lane: "assets",
          checklist: ["Gather assets", "Draft inventory", "File inventory"],
          dueAnchor: "appointment_date",
          dueOffsetDays: 90,
        },
        { title: "Guardian's Report / Account", checklist: ["Draft annual guardian's report", "Draft guardian's account", "File with court"] },
      ],
    },
    {
      key: "social_work",
      name: "Social work visit",
      tasks: [{ title: "Social work visit", lane: "social", checklist: ["Schedule visit", "Complete visit", "Write up notes"] }],
    },
  ],
  deadlineRules: [
    {
      key: "guardian_inventory_due",
      title: "Guardian's Inventory Due",
      anchor: "appointment_date",
      offsetDays: 90,
      notes: "Guardian of the estate files an inventory within three months of appointment. Verify against local rules.",
    },
    {
      key: "annual_report_due",
      title: "Annual Guardian's Report Due",
      anchor: "appointment_date",
      offsetDays: 365,
      notes: "Guardian's report is due annually. Verify against local rules.",
    },
    {
      key: "guardian_account_due",
      title: "Guardian's Account Due",
      anchor: "appointment_date",
      offsetDays: 365,
      notes: "First account due one year after appointment in many Ohio counties. Verify against local rules.",
    },
  ],
};

export const BOARD_SEEDS: BoardSeed[] = [PROBATE_BOARD, GUARDIANSHIP_BOARD];

export const PROFILE_SEEDS: { fullName: string; role: UserRole; email?: string }[] = [
  { fullName: "Christopher Gasper", role: "attorney" },
  { fullName: "Grace", role: "attorney" },
  { fullName: "Christine", role: "staff" },
  { fullName: "Laura", role: "staff" },
  { fullName: "Tina", role: "staff" },
];

export const SETTING_SEEDS: Record<string, unknown> = {
  firm_name: "Gasper Legal",
  // Base URL of the firm's Actionstep instance, used to build case links,
  // e.g. "https://go.actionstep.com". Leave empty to store full URLs per case.
  actionstep_base_url: "",
  reminder_days_before: [7, 1],
};
