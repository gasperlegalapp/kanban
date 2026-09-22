import { and, eq, lte, sql } from "drizzle-orm";
import { addDays, differenceInCalendarDays, format, parseISO } from "date-fns";
import type { Db } from "@/db";
import { cases, events, notifications, profiles, settings, tasks } from "@/db/schema";
import { sendEmail } from "@/lib/email";
import { firmToday } from "@/lib/dates";

type Reminder = { userId: string; kind: string; title: string; body: string; href: string; dedupeKey: string };

/**
 * Daily job. Builds reminders for upcoming/overdue hearings and deadlines,
 * tasks due tomorrow, overdue tasks and waiting tasks whose follow-up date has
 * arrived; stores them as in-app notifications (deduplicated) and emails one
 * digest to each person who wants email.
 */
export async function runReminders(db: Db, now = new Date()): Promise<{ notifications: number; emails: number }> {
  const today = firmToday(now);
  const todayIso = format(today, "yyyy-MM-dd");
  const daysBeforeSetting = await db.query.settings.findFirst({ where: eq(settings.key, "reminder_days_before") });
  const daysBefore = Array.isArray(daysBeforeSetting?.value) ? (daysBeforeSetting!.value as number[]) : [7, 1];
  const horizon = format(addDays(today, Math.max(...daysBefore, 0)), "yyyy-MM-dd");
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");

  const people = await db.select().from(profiles).where(eq(profiles.isActive, true));
  const attorneys = people.filter((p) => p.role === "attorney");

  const reminders: Reminder[] = [];

  // Hearings and deadlines: due within the reminder window or overdue.
  const dueEvents = await db
    .select({ event: events, c: cases })
    .from(events)
    .innerJoin(cases, eq(events.caseId, cases.id))
    .where(and(eq(events.status, "pending"), lte(events.date, horizon), eq(cases.status, "active")));
  for (const { event, c } of dueEvents) {
    const n = differenceInCalendarDays(parseISO(event.date), today);
    const fires = n < 0 || daysBefore.includes(n);
    if (!fires) continue;
    const when = n < 0 ? `${-n} day${n === -1 ? "" : "s"} overdue` : n === 0 ? "today" : `in ${n} day${n === 1 ? "" : "s"}`;
    const recipients = new Set<string>([...(c.ownerId ? [c.ownerId] : []), ...attorneys.map((a) => a.id)]);
    for (const userId of recipients) {
      reminders.push({
        userId,
        kind: "reminder",
        title: `${event.kind === "hearing" ? "Hearing" : "Deadline"} ${when}: ${event.title}`,
        body: `${c.title}${c.caseNumber ? ` (${c.caseNumber})` : ""} · ${format(parseISO(event.date), "EEE, MMM d")}${event.time ? ` ${event.time}` : ""}`,
        href: `/cases/${c.id}`,
        dedupeKey: `event:${event.id}:${n < 0 ? "overdue:" + todayIso : "d" + n}`,
      });
    }
  }

  // Overdue tasks: once per day to the assignee (or the case owner if unassigned).
  const overdueTasks = await db
    .select({ task: tasks, c: cases })
    .from(tasks)
    .innerJoin(cases, eq(tasks.caseId, cases.id))
    .where(and(sql`${tasks.status} <> 'done'`, sql`${tasks.dueDate} < ${todayIso}`, eq(cases.status, "active")));
  for (const { task, c } of overdueTasks) {
    const userId = task.assigneeId ?? c.ownerId;
    if (!userId) continue;
    const n = differenceInCalendarDays(today, parseISO(task.dueDate!));
    reminders.push({
      userId,
      kind: "reminder",
      title: `Task overdue by ${n} day${n === 1 ? "" : "s"}: ${task.title}`,
      body: `${c.title}${c.caseNumber ? ` (${c.caseNumber})` : ""}`,
      href: `/cases/${c.id}?task=${task.id}`,
      dedupeKey: `task:${task.id}:overdue:${todayIso}`,
    });
  }

  // Tasks due tomorrow: a heads-up to the assignee.
  const tomorrowIso = format(addDays(today, 1), "yyyy-MM-dd");
  const dueTomorrow = await db
    .select({ task: tasks, c: cases })
    .from(tasks)
    .innerJoin(cases, eq(tasks.caseId, cases.id))
    .where(and(sql`${tasks.status} <> 'done'`, eq(tasks.dueDate, tomorrowIso), eq(cases.status, "active")));
  for (const { task, c } of dueTomorrow) {
    const userId = task.assigneeId ?? c.ownerId;
    if (!userId) continue;
    reminders.push({
      userId,
      kind: "reminder",
      title: `Due tomorrow: ${task.title}`,
      body: `${c.title}${c.caseNumber ? ` (${c.caseNumber})` : ""}`,
      href: `/cases/${c.id}?task=${task.id}`,
      dedupeKey: `task:${task.id}:due:${tomorrowIso}`,
    });
  }

  // Waiting tasks whose follow-up date has arrived: once per follow-up date.
  const followUps = await db
    .select({ task: tasks, c: cases })
    .from(tasks)
    .innerJoin(cases, eq(tasks.caseId, cases.id))
    .where(and(eq(tasks.status, "waiting"), lte(tasks.followUpDate, todayIso), eq(cases.status, "active")));
  for (const { task, c } of followUps) {
    const userId = task.assigneeId ?? c.ownerId;
    if (!userId) continue;
    reminders.push({
      userId,
      kind: "follow_up",
      title: `Follow up: ${task.title}`,
      body: `${task.waitingOn ? `Waiting on ${task.waitingOn} · ` : ""}${c.title}${c.caseNumber ? ` (${c.caseNumber})` : ""}`,
      href: `/cases/${c.id}?task=${task.id}`,
      dedupeKey: `task:${task.id}:follow_up:${task.followUpDate}`,
    });
  }

  // Store as notifications, skipping ones already delivered.
  let stored = 0;
  const fresh: Reminder[] = [];
  for (const r of reminders) {
    const inserted = await db
      .insert(notifications)
      .values({ userId: r.userId, kind: r.kind, title: r.title, body: r.body, href: r.href, dedupeKey: r.dedupeKey })
      .onConflictDoNothing()
      .returning({ id: notifications.id });
    if (inserted.length) {
      stored++;
      fresh.push(r);
    }
  }

  // One digest email per person with something new.
  let emails = 0;
  const byUser = new Map<string, Reminder[]>();
  for (const r of fresh) {
    if (!byUser.has(r.userId)) byUser.set(r.userId, []);
    byUser.get(r.userId)!.push(r);
  }
  for (const [userId, list] of byUser) {
    const person = people.find((p) => p.id === userId);
    if (!person?.email || !person.notifyEmail) continue;
    const rows = list.map((r) => `<li><a href="${appUrl}${r.href}">${escapeHtml(r.title)}</a><br><span style="color:#666">${escapeHtml(r.body)}</span></li>`).join("");
    const html = `<p>Hi ${escapeHtml(person.fullName.split(" ")[0])},</p><p>Here is what needs attention:</p><ul>${rows}</ul><p><a href="${appUrl}/my">Open My work</a></p>`;
    try {
      await sendEmail(person.email, `Case Control: ${list.length} reminder${list.length === 1 ? "" : "s"}`, html);
      emails++;
    } catch (err) {
      console.error("Reminder email failed", err);
    }
  }

  // Housekeeping: drop read notifications older than 60 days.
  await db.delete(notifications).where(and(sql`${notifications.readAt} is not null`, lte(notifications.createdAt, addDays(today, -60))));

  return { notifications: stored, emails };
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
