"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { CheckCircle2, ClipboardCheck, Undo2 } from "lucide-react";
import type { WorkTask } from "@/lib/data/work";
import type { PersonLite } from "@/lib/data/types";
import { approveTask, returnTask } from "@/lib/actions/tasks";
import { relTime } from "@/lib/format";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { TaskDrawer } from "@/components/tasks/task-drawer";
import { WorkTaskRow } from "@/components/tasks/work-task-row";

export function ReviewScreen({ queue, people, currentUserId }: { queue: WorkTask[]; people: PersonLite[]; currentUserId: string }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const [scope, setScope] = useState<"mine" | "all">("mine");
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  const [returning, setReturning] = useState<WorkTask | null>(null);
  const [note, setNote] = useState("");

  const mine = queue.filter((t) => t.reviewerId === currentUserId || !t.reviewerId);
  const shown = scope === "mine" ? mine : queue;

  const approve = (t: WorkTask) =>
    start(async () => {
      const res = await approveTask(t.id);
      if (!res.ok) return toast.error(res.error);
      toast.notify(`Approved: ${t.title}`);
      router.refresh();
    });

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-5xl px-5 py-4">
        <div className="mb-2 flex flex-wrap items-center gap-3">
          <ClipboardCheck size={18} className="text-brand" />
          <h1 className="text-lg font-semibold">Attorney review</h1>
          <div className="ml-auto flex rounded-md border border-line bg-surface p-0.5 text-sm">
            {(
              [
                ["mine", `For me (${mine.length})`],
                ["all", `Everything in review (${queue.length})`],
              ] as const
            ).map(([id, label]) => (
              <button key={id} className={clsx("rounded px-3 py-1", scope === id ? "bg-brand text-white" : "text-muted hover:text-ink")} onClick={() => setScope(id)}>
                {label}
              </button>
            ))}
          </div>
        </div>
        <p className="mb-4 text-sm text-muted">
          Tasks land here when someone moves them to Review. Approve marks the task done; Return sends it back to the assignee with your note. &ldquo;For me&rdquo; shows tasks assigned to you
          plus those with no specific reviewer.
        </p>

        {shown.length === 0 ? (
          <div className="card px-5 py-10 text-center text-sm text-muted">Nothing waiting for review.</div>
        ) : (
          <section className="card overflow-hidden">
            <ul className="divide-y divide-line">
              {shown.map((t) => (
                <WorkTaskRow
                  key={t.id}
                  t={t}
                  showAssignee
                  onOpen={() => setOpenTaskId(t.id)}
                  pending={pending}
                  right={
                    <div className="flex shrink-0 items-center gap-1">
                      <span className="hidden w-28 truncate text-right text-[11px] text-faint lg:inline" title={t.reviewerName ? `Reviewer: ${t.reviewerName}` : "Any attorney"}>
                        {t.reviewRequestedAt ? `sent ${relTime(t.reviewRequestedAt)}` : ""}
                      </span>
                      <button className="btn btn-sm btn-primary" disabled={pending} onClick={() => approve(t)} title="Approve and mark done">
                        <CheckCircle2 size={12} /> Approve
                      </button>
                      <button
                        className="btn btn-sm"
                        disabled={pending}
                        onClick={() => {
                          setNote("");
                          setReturning(t);
                        }}
                        title="Send back with a note"
                      >
                        <Undo2 size={12} /> Return
                      </button>
                    </div>
                  }
                />
              ))}
            </ul>
          </section>
        )}
      </div>

      {returning && (
        <Modal
          open
          onClose={() => setReturning(null)}
          title="Return for changes"
          footer={
            <>
              <button className="btn" onClick={() => setReturning(null)} disabled={pending}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                disabled={pending || note.trim().length < 3}
                onClick={() =>
                  start(async () => {
                    const res = await returnTask(returning.id, note);
                    if (!res.ok) return toast.error(res.error);
                    toast.notify(`Returned to ${returning.assigneeName ?? "the team"}.`);
                    setReturning(null);
                    router.refresh();
                  })
                }
              >
                Send back
              </button>
            </>
          }
        >
          <p className="mb-2 text-sm text-muted">
            <span className="font-medium text-ink">{returning.title}</span> goes back to In Progress
            {returning.assigneeName ? ` for ${returning.assigneeName}` : ""}. Your note is added as a comment and sent to them.
          </p>
          <textarea className="textarea" placeholder="What needs to change?" value={note} onChange={(e) => setNote(e.target.value)} autoFocus />
        </Modal>
      )}
      <TaskDrawer taskId={openTaskId} onClose={() => setOpenTaskId(null)} people={people} canDelete />
    </div>
  );
}
