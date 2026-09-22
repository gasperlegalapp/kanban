import { notFound } from "next/navigation";
import { getCurrentUser, isAttorney } from "@/lib/auth/session";
import { getBoardConfig, getCaseDetail } from "@/lib/data/boards";
import { CaseDetailScreen } from "@/components/cases/case-detail-screen";

export const dynamic = "force-dynamic";

export default async function CasePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ task?: string }> }) {
  const { id } = await params;
  const { task } = await searchParams;
  const [user, detail] = await Promise.all([getCurrentUser(), getCaseDetail(id)]);
  if (!detail) notFound();
  const config = await getBoardConfig(detail.boardId);
  const initialTaskId = task && detail.tasks.some((t) => t.id === task) ? task : null;
  return <CaseDetailScreen key={initialTaskId ?? "case"} detail={detail} config={config} isAttorney={isAttorney(user)} currentUserId={user!.id} initialTaskId={initialTaskId} />;
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await getCaseDetail(id);
  return { title: detail ? detail.title : "Case" };
}
