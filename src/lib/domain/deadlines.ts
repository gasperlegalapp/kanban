import { addDays, format, parseISO } from "date-fns";
import type { Case, DeadlineAnchor, DeadlineRule } from "@/db/schema";

export type ComputedDeadline = {
  ruleKey: string;
  title: string;
  kind: DeadlineRule["kind"];
  date: string; // YYYY-MM-DD
};

/** Resolve the anchor date for a rule from the case, if it is known. */
export function anchorDate(
  c: Pick<Case, "appointmentDate" | "dateOfDeath" | "createdAt">,
  anchor: DeadlineAnchor,
): string | null {
  switch (anchor) {
    case "appointment_date":
      return c.appointmentDate ?? null;
    case "date_of_death":
      return c.dateOfDeath ?? null;
    case "case_opened":
      return format(c.createdAt, "yyyy-MM-dd");
  }
}

/**
 * Compute every deadline the active rules can produce for a case. Rules whose
 * anchor date is not yet known are skipped; they appear once the date is set.
 */
export function computeDeadlines(
  c: Pick<Case, "appointmentDate" | "dateOfDeath" | "createdAt">,
  rules: DeadlineRule[],
): ComputedDeadline[] {
  const out: ComputedDeadline[] = [];
  for (const rule of rules) {
    if (!rule.isActive) continue;
    const base = anchorDate(c, rule.anchor);
    if (!base) continue;
    out.push({
      ruleKey: rule.key,
      title: rule.title,
      kind: rule.kind,
      date: format(addDays(parseISO(base), rule.offsetDays), "yyyy-MM-dd"),
    });
  }
  return out;
}

export function addDaysIso(base: string, days: number): string {
  return format(addDays(parseISO(base), days), "yyyy-MM-dd");
}
