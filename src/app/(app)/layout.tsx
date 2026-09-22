import { and, desc, eq, isNull } from "drizzle-orm";
import { getDb } from "@/db";
import { notifications } from "@/db/schema";
import { isAttorney, requireUser } from "@/lib/auth/session";
import { getBoards } from "@/lib/data/boards";
import { getNavCounts } from "@/lib/data/work";
import { AppShell } from "@/components/shell/app-shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const db = await getDb();
  const [boards, unread, counts] = await Promise.all([
    getBoards(),
    db
      .select()
      .from(notifications)
      .where(and(eq(notifications.userId, user.id), isNull(notifications.readAt)))
      .orderBy(desc(notifications.createdAt))
      .limit(30),
    getNavCounts(user.id, isAttorney(user)),
  ]);

  return (
    <AppShell user={{ id: user.id, fullName: user.fullName, role: user.role }} boards={boards} unread={unread} counts={counts}>
      {children}
    </AppShell>
  );
}
