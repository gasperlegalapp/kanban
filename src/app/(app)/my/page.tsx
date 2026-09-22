import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { getMyWork } from "@/lib/data/work";
import { MyWorkScreen } from "@/components/work/my-work-screen";

export const dynamic = "force-dynamic";
export const metadata = { title: "My work" };

export default async function MyWorkPage({ searchParams }: { searchParams: Promise<{ user?: string }> }) {
  const user = await requireUser();
  const { user: viewing } = await searchParams;
  const data = await getMyWork(viewing && /^[0-9a-f-]{36}$/i.test(viewing) ? viewing : user.id);
  if (!data) notFound();
  return <MyWorkScreen data={data} currentUserId={user.id} />;
}
