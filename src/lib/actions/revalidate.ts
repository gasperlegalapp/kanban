import { revalidatePath } from "next/cache";

export function revalidateCase(boardId: string, caseId?: string | null): void {
  revalidatePath(`/boards/${boardId}`);
  if (caseId) revalidatePath(`/cases/${caseId}`);
  revalidatePath("/calendar");
}
