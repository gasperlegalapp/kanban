"use server";

import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { notifications } from "@/db/schema";
import { requireActor } from "@/lib/auth/session";
import { runAction, type ActionResult } from "./result";

export async function markNotificationRead(id: string): Promise<ActionResult> {
  return runAction(async () => {
    const actor = await requireActor();
    const db = await getDb();
    await db.update(notifications).set({ readAt: new Date() }).where(and(eq(notifications.id, id), eq(notifications.userId, actor.id)));
    revalidatePath("/", "layout");
    return undefined;
  });
}

export async function markAllNotificationsRead(): Promise<ActionResult> {
  return runAction(async () => {
    const actor = await requireActor();
    const db = await getDb();
    await db.update(notifications).set({ readAt: new Date() }).where(and(eq(notifications.userId, actor.id), isNull(notifications.readAt)));
    revalidatePath("/", "layout");
    return undefined;
  });
}
