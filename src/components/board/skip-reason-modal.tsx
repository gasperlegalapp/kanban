"use client";

import { useState } from "react";
import { ArrowRight, SkipForward } from "lucide-react";
import { Modal } from "@/components/ui/modal";

export const SKIP_REASON_MIN = 10;

export function SkipReasonModal({
  open,
  caseTitle,
  fromStage,
  toStage,
  backward,
  onConfirm,
  onClose,
  pending,
}: {
  open: boolean;
  caseTitle: string;
  fromStage: string;
  toStage: string;
  backward: boolean;
  onConfirm: (reason: string) => void;
  onClose: () => void;
  pending?: boolean;
}) {
  const [reason, setReason] = useState("");
  const ok = reason.trim().length >= SKIP_REASON_MIN;
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={
        <span className="flex items-center gap-2">
          <SkipForward size={16} className="text-warn" /> {backward ? "Move case back" : "Skip ahead"}
        </span>
      }
      footer={
        <>
          <button className="btn" onClick={onClose} disabled={pending}>
            Cancel
          </button>
          <button className="btn btn-primary" style={{ background: "#d97706", borderColor: "#d97706" }} disabled={!ok || pending} onClick={() => onConfirm(reason.trim())}>
            Confirm and log
          </button>
        </>
      }
    >
      <p className="text-sm text-muted">
        <span className="font-medium text-ink">{caseTitle}</span> is moving out of the normal order. A reason is required and will be
        recorded in the case history.
      </p>
      <div className="my-3 flex items-center justify-center gap-3 rounded-md bg-surface-2 px-3 py-2 text-sm">
        <span className="font-medium">{fromStage}</span>
        <ArrowRight size={14} className="text-muted" />
        <span className="font-medium">{toStage}</span>
      </div>
      <textarea className="textarea" placeholder="Why is this case moving out of order?" value={reason} onChange={(e) => setReason(e.target.value)} autoFocus />
      <div className="mt-1 text-right text-xs text-faint">
        {reason.trim().length}/{SKIP_REASON_MIN} minimum
      </div>
    </Modal>
  );
}
