import { notFound } from "next/navigation";
import { getCurrentUser, isAttorney } from "@/lib/auth/session";
import { getBoardConfig, getCaseDetail } from "@/lib/data/boards";
import { CaseDetailScreen } from "@/components/cases/case-detail-screen";

export const dynamic = "force-dynamic";

export default async function CasePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [user, detail] = await Promise.all([getCurrentUser(), getCaseDetail(id)]);
  if (!detail) notFound();
  const config = await getBoardConfig(detail.boardId);
  return <CaseDetailScreen detail={detail} config={config} isAttorney={isAttorney(user)} currentUserId={user!.id} />;
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await getCaseDetail(id);
  return { title: detail ? detail.title : "Case" };
}
