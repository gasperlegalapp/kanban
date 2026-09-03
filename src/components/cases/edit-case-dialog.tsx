"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/modal";
import { Field } from "@/components/ui/fields";
import { useToast } from "@/components/ui/toast";
import { updateCase } from "@/lib/actions/cases";
import type { BoardConfig, CaseDetail } from "@/lib/data/types";
import { WILL_STATUS_LABELS } from "@/lib/domain/constants";

export function EditCaseDialog({ open, onClose, detail, config }: { open: boolean; onClose: () => void; detail: CaseDetail; config: BoardConfig }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const isProbate = config.board.id === "probate";

  function submit(form: FormData) {
    const v = (k: string) => String(form.get(k) ?? "").trim();
    start(async () => {
      const res = await updateCase(detail.id, {
        title: v("title"),
        clientName: v("clientName") || null,
        caseNumber: v("caseNumber") || null,
        county: v("county") || null,
        court: v("court") || null,
        fiduciary: v("fiduciary") || null,
        willStatus: (v("willStatus") || "unknown") as "testate" | "intestate" | "unknown",
        ownerId: v("ownerId") || null,
        laneId: v("laneId") || null,
        caseTypeId: v("caseTypeId") || null,
        actionstepUrl: v("actionstepUrl") || null,
        appointmentDate: v("appointmentDate") || null,
        dateOfDeath: v("dateOfDeath") || null,
        description: v("description"),
      });
      if (!res.ok) return toast.error(res.error);
      toast.notify("Saved.");
      onClose();
      router.refresh();
    });
  }

  return (
    <Modal open={open} onClose={onClose} title="Edit case details" width="max-w-2xl">
      <form action={submit} className="grid grid-cols-2 gap-3">
        <Field label="Case title" className="col-span-2">
          <input name="title" className="input" defaultValue={detail.title} required />
        </Field>
        <Field label="Case type">
          <select name="caseTypeId" className="select" defaultValue={detail.caseTypeId ?? ""}>
            <option value="">None</option>
            {config.caseTypes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.prefix ? `[${t.prefix}] ` : ""}
                {t.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Lane">
          <select name="laneId" className="select" defaultValue={detail.laneId ?? ""}>
            <option value="">None</option>
            {config.lanes.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Responsible">
          <select name="ownerId" className="select" defaultValue={detail.ownerId ?? ""}>
            <option value="">Unassigned</option>
            {config.people
              .filter((p) => p.isActive || p.id === detail.ownerId)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.fullName}
                </option>
              ))}
          </select>
        </Field>
        <Field label="Client / contact">
          <input name="clientName" className="input" defaultValue={detail.clientName ?? ""} />
        </Field>
        <Field label="Court case number">
          <input name="caseNumber" className="input" defaultValue={detail.caseNumber ?? ""} />
        </Field>
        <Field label="County">
          <input name="county" className="input" defaultValue={detail.county ?? ""} />
        </Field>
        <Field label="Court">
          <input name="court" className="input" defaultValue={detail.court ?? ""} placeholder="Franklin County Probate Court" />
        </Field>
        {isProbate ? (
          <>
            <Field label="Fiduciary">
              <input name="fiduciary" className="input" defaultValue={detail.fiduciary ?? ""} />
            </Field>
            <Field label="Will">
              <select name="willStatus" className="select" defaultValue={detail.willStatus}>
                {Object.entries(WILL_STATUS_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Date of death">
              <input name="dateOfDeath" type="date" className="input" defaultValue={detail.dateOfDeath ?? ""} />
            </Field>
          </>
        ) : (
          <div />
        )}
        <Field label="Appointment date" hint="Rule-based deadlines move with this date.">
          <input name="appointmentDate" type="date" className="input" defaultValue={detail.appointmentDate ?? ""} />
        </Field>
        <Field label="Actionstep link" className="col-span-2">
          <input name="actionstepUrl" className="input" defaultValue={detail.actionstepUrl ?? ""} placeholder="https://…actionstep.com/…" />
        </Field>
        <Field label="Notes" className="col-span-2">
          <textarea name="description" className="textarea min-h-32" defaultValue={detail.description} />
        </Field>
        <div className="col-span-2 flex justify-end gap-2 pt-1">
          <button type="button" className="btn" onClick={onClose} disabled={pending}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={pending}>
            {pending ? "Saving…" : "Save changes"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
