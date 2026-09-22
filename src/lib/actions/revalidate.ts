import { revalidatePath } from "next/cache";

/**
 * A case or task change shows up on the boards, the case page, the calendar,
 * the dashboard, My work, the review queue and the nav badges, so refresh the
 * whole app layout. The arguments document what changed; they are not needed.
 */
export function revalidateCase(...changed: [boardId?: string, caseId?: string | null]): void {
  void changed;
  revalidatePath("/", "layout");
}
