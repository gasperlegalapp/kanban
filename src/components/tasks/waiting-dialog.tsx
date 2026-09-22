"use client";

import { useState } from "react";
import { Clock } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Field } from "@/components/ui/fields";
import { addDaysToIso, firmTodayIso } from "@/lib/dates";

export const WAITING_ON_OPTIONS = ["Client", "Client signature", "Court", "Bank / financial institution", "Opposing counsel", "Heir / beneficiary", "Third party"];

/** Asks what a task is waiting on and when to check back. */
export function WaitingDialog({
  taskTitle,
  initialWaitingOn,
  initialFollowUp,
  onConfirm,
  onClose,
}: {
  taskTitle: string;
  initialWaitingOn?: string | null;
  initialFollowUp?: string | null;
  onConfirm: (v: { waitingOn: string | null; followUpDate: string }) => void;
  onClose: () => void;
}) {
  const today = firmTodayIso();
  const [waitingOn, setWaitingOn] = useState(initialWaitingOn ?? "");
  const [followUp, setFollowUp] = useState(initialFollowUp ?? addDaysToIso(today, 7));
  return (
    <Modal
      open
      onClose={onClose}
      title={
        <span className="flex items-center gap-2">
          <Clock size={16} className="text-warn" /> Waiting
        </span>
      }
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" disabled={!followUp} onClick={() => onConfirm({ waitingOn: waitingOn.trim() || null, followUpDate: followUp })}>
            Set follow-up
          </button>
        </>
      }
    >
      <p className="mb-3 text-sm text-muted">
        <span className="font-medium text-ink">{taskTitle}</span> will come back up in My work on the follow-up date.
      </p>
      <div className="grid gap-3">
        <Field label="Waiting on">
          <input className="input" list="waiting-on-options" value={waitingOn} onChange={(e) => setWaitingOn(e.target.value)} placeholder="Client signature, bank, court…" autoFocus />
          <datalist id="waiting-on-options">
            {WAITING_ON_OPTIONS.map((o) => (
              <option key={o} value={o} />
            ))}
          </datalist>
        </Field>
        <Field label="Follow up on">
          <div className="flex flex-wrap items-center gap-2">
            <input type="date" className="input w-44" value={followUp} min={today} onChange={(e) => setFollowUp(e.target.value)} />
            {[3, 7, 14, 30].map((d) => (
              <button key={d} type="button" className="btn btn-sm" onClick={() => setFollowUp(addDaysToIso(today, d))}>
                {d === 7 ? "1 week" : d === 14 ? "2 weeks" : d === 30 ? "30 days" : `${d} days`}
              </button>
            ))}
          </div>
        </Field>
      </div>
    </Modal>
  );
}
