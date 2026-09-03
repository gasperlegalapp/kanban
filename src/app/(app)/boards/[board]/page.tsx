import { getCurrentUser, isAttorney } from "@/lib/auth/session";
import { getBoardCases, getBoardConfig } from "@/lib/data/boards";
import { BoardScreen } from "@/components/board/board-screen";

export const dynamic = "force-dynamic";

export default async function BoardPage({
  params,
  searchParams,
}: {
  params: Promise<{ board: string }>;
  searchParams: Promise<{ closed?: string; case?: string }>;
}) {
  const { board } = await params;
  const sp = await searchParams;
  const showClosed = sp.closed === "1";
  const [user, config, cases] = await Promise.all([getCurrentUser(), getBoardConfig(board), getBoardCases(board, { includeClosed: showClosed })]);
  return (
    <BoardScreen
      key={`${board}-${showClosed}`}
      config={config}
      cases={cases}
      showClosed={showClosed}
      isAttorney={isAttorney(user)}
      initialCaseId={sp.case && cases.some((c) => c.id === sp.case) ? sp.case : null}
    />
  );
}

export async function generateMetadata({ params }: { params: Promise<{ board: string }> }) {
  const { board } = await params;
  const config = await getBoardConfig(board);
  return { title: config.board.name };
}
