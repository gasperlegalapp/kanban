import { differenceInCalendarDays, format, formatDistanceToNowStrict, parseISO, startOfDay } from "date-fns";

export function toDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  // Date-only strings are treated as local dates, not UTC midnight.
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return parseISO(value);
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function fmtDate(value: string | Date | null | undefined, pattern = "MMM d, yyyy"): string {
  const d = toDate(value);
  return d ? format(d, pattern) : "";
}

export function fmtDateShort(value: string | Date | null | undefined): string {
  return fmtDate(value, "M/d/yy");
}

export function relTime(value: string | Date | null | undefined): string {
  const d = toDate(value);
  return d ? formatDistanceToNowStrict(d, { addSuffix: true }) : "";
}

/** Days from today to a date: negative = past. */
export function daysUntil(value: string | Date | null | undefined, now = new Date()): number | null {
  const d = toDate(value);
  return d ? differenceInCalendarDays(startOfDay(d), startOfDay(now)) : null;
}

export function dueLabel(value: string | Date | null | undefined): { text: string; tone: "ok" | "warn" | "bad" | "muted" } {
  const n = daysUntil(value);
  if (n === null) return { text: "", tone: "muted" };
  if (n < 0) return { text: `${-n}d overdue`, tone: "bad" };
  if (n === 0) return { text: "Due today", tone: "warn" };
  if (n === 1) return { text: "Due tomorrow", tone: "warn" };
  if (n <= 7) return { text: `Due in ${n}d`, tone: "warn" };
  return { text: fmtDateShort(value), tone: "muted" };
}

export function todayIso(): string {
  return format(new Date(), "yyyy-MM-dd");
}

export function plural(n: number, word: string, pluralWord = word + "s"): string {
  return `${n} ${n === 1 ? word : pluralWord}`;
}
