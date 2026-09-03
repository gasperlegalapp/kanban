import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { isAttorney, requireUser } from "@/lib/auth/session";
import { getBoardConfig, getBoards } from "@/lib/data/boards";
import { SettingsScreen } from "@/components/settings/settings-screen";

export const dynamic = "force-dynamic";
export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = await requireUser();
  if (!isAttorney(user)) redirect("/");
  const db = await getDb();
  const boards = await getBoards();
  const configs = await Promise.all(boards.map((b) => getBoardConfig(b.id)));
  const rows = await db.query.settings.findMany();
  const general = Object.fromEntries(rows.map((r) => [r.key, r.value])) as Record<string, unknown>;
  return (
    <SettingsScreen
      configs={configs}
      general={{
        firm_name: typeof general.firm_name === "string" ? general.firm_name : "",
        actionstep_base_url: typeof general.actionstep_base_url === "string" ? general.actionstep_base_url : "",
        reminder_days_before: Array.isArray(general.reminder_days_before) ? (general.reminder_days_before as number[]) : [7, 1],
      }}
    />
  );
}
