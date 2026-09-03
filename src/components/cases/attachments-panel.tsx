"use client";

import { useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileText, Paperclip, Trash2, Upload } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { deleteAttachment, uploadAttachment } from "@/lib/actions/attachments";
import type { Attachment } from "@/db/schema";
import { fmtDate } from "@/lib/format";

function size(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function AttachmentsPanel({ caseId, taskId, items, canDelete }: { caseId?: string; taskId?: string; items: Attachment[]; canDelete: (a: Attachment) => boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  function onPick(files: FileList | null) {
    if (!files?.length) return;
    start(async () => {
      for (const f of Array.from(files)) {
        const fd = new FormData();
        fd.set("file", f);
        if (caseId) fd.set("caseId", caseId);
        if (taskId) fd.set("taskId", taskId);
        const res = await uploadAttachment(fd);
        if (!res.ok) {
          toast.error(res.error);
          break;
        }
      }
      if (inputRef.current) inputRef.current.value = "";
      router.refresh();
    });
  }

  return (
    <div>
      <ul className="mb-2 divide-y divide-line rounded-md border border-line text-sm empty:hidden">
        {items.map((a) => (
          <li key={a.id} className="group flex items-center gap-2 px-2 py-1.5">
            <FileText size={14} className="shrink-0 text-muted" />
            <a href={`/api/attachments/${a.id}`} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate hover:underline">
              {a.fileName}
            </a>
            <span className="text-[11px] text-faint">
              {size(a.sizeBytes)} · {fmtDate(a.createdAt, "M/d/yy")}
            </span>
            {canDelete(a) && (
              <button
                className="text-faint opacity-0 hover:text-bad group-hover:opacity-100"
                disabled={pending}
                onClick={() => {
                  if (!confirm(`Remove ${a.fileName}?`)) return;
                  start(async () => {
                    const res = await deleteAttachment(a.id);
                    if (!res.ok) return toast.error(res.error);
                    router.refresh();
                  });
                }}
                aria-label="Remove file"
              >
                <Trash2 size={13} />
              </button>
            )}
          </li>
        ))}
      </ul>
      <label className="btn btn-sm cursor-pointer">
        {pending ? <Upload size={12} className="animate-pulse" /> : <Paperclip size={12} />}
        {pending ? "Uploading…" : "Attach file"}
        <input ref={inputRef} type="file" multiple className="hidden" onChange={(e) => onPick(e.target.files)} disabled={pending} />
      </label>
    </div>
  );
}
