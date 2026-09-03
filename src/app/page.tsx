import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";

export default async function Home() {
  await requireUser();
  redirect("/boards/probate");
}
