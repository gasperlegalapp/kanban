import { addDays, format, parseISO } from "date-fns";

/** The firm's timezone. Servers run in UTC, so "today" is computed here. */
export const FIRM_TIMEZONE = "America/New_York";

/** Today's date in the firm's timezone, as YYYY-MM-DD. */
export function firmTodayIso(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: FIRM_TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** Midnight of the firm's current date, for date-only comparisons. */
export function firmToday(now: Date = new Date()): Date {
  return parseISO(firmTodayIso(now));
}

export function addDaysToIso(iso: string, days: number): string {
  return format(addDays(parseISO(iso), days), "yyyy-MM-dd");
}
