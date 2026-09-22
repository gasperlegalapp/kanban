import { asc } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { templateSets, templateTasks } from "@/db/schema";
import { isAttorney, requireUser } from "@/lib/auth/session";
import { getBoardConfig, getBoards } from "@/lib/data/boards";
import { TemplatesScreen } from "@/components/templates/templates-screen";

export const dynamic = "force-dynamic";
export const metadata = { title: "Templates" };

export default async function TemplatesPage() {
  const user = await requireUser();
  if (!isAttorney(user)) redirect("/");
  const db = await getDb();
  const [boards, sets] = await Promise.all([
    getBoards(),
    db.query.templateSets.findMany({ orderBy: [asc(templateSets.boardId), asc(templateSets.position)], with: { tasks: { orderBy: [asc(templateTasks.position)] } } }),
  ]);
  const stagesByBoard: Record<string, { id: string; name: string }[]> = {};
  for (const b of boards) {
    const config = await getBoardConfig(b.id);
    stagesByBoard[b.id] = config.leafStages.filter((st) => !st.isClosed && !st.isArchive).map((st) => ({ id: st.id, name: st.name }));
  }
  return <TemplatesScreen boards={boards} sets={sets} stagesByBoard={stagesByBoard} />;
}
