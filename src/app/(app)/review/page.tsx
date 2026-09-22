import { redirect } from "next/navigation";
import { isAttorney, requireUser } from "@/lib/auth/session";
import { getPeople } from "@/lib/data/boards";
import { getReviewQueue } from "@/lib/data/work";
import { ReviewScreen } from "@/components/work/review-screen";

export const dynamic = "force-dynamic";
export const metadata = { title: "Review" };

export default async function ReviewPage() {
  const user = await requireUser();
  if (!isAttorney(user)) redirect("/my");
  const [queue, people] = await Promise.all([getReviewQueue(), getPeople()]);
  return <ReviewScreen queue={queue} people={people} currentUserId={user.id} />;
}
