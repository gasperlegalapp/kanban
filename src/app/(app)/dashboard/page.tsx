import { requireUser } from "@/lib/auth/session";
import { getDashboard } from "@/lib/data/work";
import { DashboardScreen } from "@/components/work/dashboard-screen";

export const dynamic = "force-dynamic";
export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const user = await requireUser();
  const data = await getDashboard();
  return <DashboardScreen data={data} firstName={user.fullName.split(" ")[0]} isAttorney={user.role === "attorney"} />;
}
