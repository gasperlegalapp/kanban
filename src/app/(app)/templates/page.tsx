import { asc } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { templateSets, templateTasks } from "@/db/schema";
import { isAttorney, requireUser } from "@/lib/auth/session";
import { getBoardConfig, getBoards, getPeople } from "@/lib/data/boards";
import type { StageNode } from "@/lib/data/types";
import { TemplatesScreen } from "@/components/templates/templates-screen";

export const dynamic = "force-dynamic";
export const metadata = { title: "Templates" };

export default async function TemplatesPage() {
  const user = await requireUser();
  if (!isAttorney(user)) redirect("/");
  const db = await getDb();
  const [boards, people, sets] = await Promise.all([
    getBoards(),
    getPeople(),
    db.query.templateSets.findMany({ orderBy: [asc(templateSets.boardId), asc(templateSets.position)], with: { tasks: { orderBy: [asc(templateTasks.position)] } } }),
  ]);
  // Open columns in board order, each with its phase name (e.g. "Start phase").
  const stagesByBoard: Record<string, { id: string; name: string; group: string | null }[]> = {};
  for (const b of boards) {
    const config = await getBoardConfig(b.id);
    stagesByBoard[b.id] = config.stageTree
      .flatMap((node): { st: StageNode; group: string | null }[] => (node.children.length ? node.children.map((st) => ({ st, group: node.name })) : [{ st: node, group: null }]))
      .filter(({ st }) => !st.isClosed && !st.isArchive)
      .map(({ st, group }) => ({ id: st.id, name: st.name, group }));
  }
  return <TemplatesScreen boards={boards} sets={sets} stagesByBoard={stagesByBoard} people={people.filter((p) => p.isActive)} />;
}
