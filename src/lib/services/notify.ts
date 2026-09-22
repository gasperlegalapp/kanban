import { after } from "next/server";
import { and, eq, inArray } from "drizzle-orm";
import type { Db } from "@/db";
import { notifications, profiles } from "@/db/schema";
import { sendEmail } from "@/lib/email";

export type NotificationKind = "assigned" | "review" | "approved" | "returned" | "mention" | "comment" | "follow_up" | "reminder";

export type NotifyInput = {
  /** Recipients. Nulls, duplicates and the actor are dropped. */
  userIds: (string | null | undefined)[];
  actorId?: string | null;
  kind: NotificationKind;
  title: string;
  body?: string;
  href?: string;
  dedupeKey?: string;
  /** Also email people who have an address and email notifications on. Default true. */
  email?: boolean;
};

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

/**
 * Records in-app notifications (the bell) and, after the response is sent,
 * emails the recipients who want email. Never throws: a failed notification
 * must not fail the action that caused it.
 */
export async function notify(db: Db, input: NotifyInput): Promise<void> {
  const ids = [...new Set(input.userIds.filter((id): id is string => !!id && id !== input.actorId))];
  if (!ids.length) return;
  try {
    const recipients = await db
      .select({ id: profiles.id, email: profiles.email, fullName: profiles.fullName, notifyEmail: profiles.notifyEmail })
      .from(profiles)
      .where(and(inArray(profiles.id, ids), eq(profiles.isActive, true)));
    if (!recipients.length) return;
    const inserted = await db
      .insert(notifications)
      .values(
        recipients.map((r) => ({
          userId: r.id,
          kind: input.kind,
          title: input.title,
          body: input.body ?? "",
          href: input.href ?? null,
          dedupeKey: input.dedupeKey ?? null,
        })),
      )
      .onConflictDoNothing()
      .returning({ userId: notifications.userId });

    if (input.email === false) return;
    const delivered = new Set(inserted.map((r) => r.userId));
    const emailTo = recipients.filter((r) => delivered.has(r.id) && r.email && r.notifyEmail);
    if (!emailTo.length) return;

    const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");
    const link = input.href ? `${appUrl}${input.href}` : appUrl;
    const send = async () => {
      for (const r of emailTo) {
        const html = `<p>Hi ${escapeHtml(r.fullName.split(" ")[0])},</p><p><strong>${escapeHtml(input.title)}</strong></p>${
          input.body ? `<p style="white-space:pre-wrap">${escapeHtml(input.body)}</p>` : ""
        }<p><a href="${link}">Open in Case Control</a></p><p style="color:#888;font-size:12px">You can turn these emails off on your account page.</p>`;
        try {
          await sendEmail(r.email!, input.title, html);
        } catch (err) {
          console.error("Notification email failed", err);
        }
      }
    };
    try {
      after(send);
    } catch {
      await send(); // outside a request (scripts, tests)
    }
  } catch (err) {
    console.error("notify failed", err);
  }
}

/** Active attorneys, for "anyone who can review" notifications. */
export async function attorneyIds(db: Db): Promise<string[]> {
  const rows = await db
    .select({ id: profiles.id })
    .from(profiles)
    .where(and(eq(profiles.role, "attorney"), eq(profiles.isActive, true)));
  return rows.map((r) => r.id);
}
