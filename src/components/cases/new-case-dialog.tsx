"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/modal";
import { Field } from "@/components/ui/fields";
import { useToast } from "@/components/ui/toast";
import { createCase } from "@/lib/actions/cases";
import type { BoardConfig } from "@/lib/data/types";
import { WILL_STATUS_LABELS } from "@/lib/domain/constants";

export function NewCaseDialog({ open, onClose, config }: { open: boolean; onClose: () => void; config: BoardConfig }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const isProbate = config.board.id === "probate";

  function submit(form: FormData) {
    const v = (k: string) => String(form.get(k) ?? "").trim();
    start(async () => {
      const res = await createCase({
        boardId: config.board.id,
        title: v("title"),
        clientName: v("clientName") || null,
        caseNumber: v("caseNumber") || null,
        county: v("county") || null,
        fiduciary: v("fiduciary") || null,
        willStatus: (v("willStatus") || "unknown") as "testate" | "intestate" | "unknown",
        ownerId: v("ownerId") || null,
        laneId: v("laneId") || null,
        caseTypeId: v("caseTypeId") || null,
        stageId: v("stageId") || undefined,
        actionstepUrl: v("actionstepUrl") || null,
        appointmentDate: v("appointmentDate") || null,
        dateOfDeath: v("dateOfDeath") || null,
        description: v("description"),
        applyTemplates: form.get("applyTemplates") === "on",
      });
      if (!res.ok) return toast.error(res.error);
      toast.notify("Case created.");
      onClose();
      router.push(`/cases/${res.data.id}`);
    });
  }

  const defaultSets = config.templateSets.filter((s) => s.applyOnCreate);

  return (
    <Modal open={open} onClose={onClose} title={`New ${config.board.name.replace(/ Cases$/, "")} case`} width="max-w-2xl">
      <form action={submit} className="grid grid-cols-2 gap-3">
        <Field label="Case title" className="col-span-2" hint="Decedent or ward, last name first. Example: Adkins, John">
          <input name="title" className="input" required autoFocus />
        </Field>
        <Field label="Case type">
          <select name="caseTypeId" className="select" defaultValue={config.caseTypes[0]?.id ?? ""}>
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
          <select name="laneId" className="select" defaultValue={config.lanes[0]?.id ?? ""}>
            <option value="">None</option>
            {config.lanes.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Starting stage">
          <select name="stageId" className="select" defaultValue={config.leafStages[0]?.id}>
            {config.leafStages
              .filter((s) => !s.isClosed && !s.isArchive)
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
          </select>
        </Field>
        <Field label="Responsible">
          <select name="ownerId" className="select" defaultValue="">
            <option value="">Unassigned</option>
            {config.people
              .filter((p) => p.isActive)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.fullName}
                </option>
              ))}
          </select>
        </Field>
        <Field label="Client / contact">
          <input name="clientName" className="input" />
        </Field>
        <Field label="Court case number">
          <input name="caseNumber" className="input" />
        </Field>
        <Field label="County">
          <input name="county" className="input" placeholder="Franklin" />
        </Field>
        {isProbate ? (
          <>
            <Field label="Fiduciary">
              <input name="fiduciary" className="input" />
            </Field>
            <Field label="Will">
              <select name="willStatus" className="select" defaultValue="unknown">
                {Object.entries(WILL_STATUS_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Date of death">
              <input name="dateOfDeath" type="date" className="input" />
            </Field>
          </>
        ) : (
          <div />
        )}
        <Field label="Appointment date" hint="Deadlines are calculated from this date.">
          <input name="appointmentDate" type="date" className="input" />
        </Field>
        <Field label="Actionstep link" className="col-span-2">
          <input name="actionstepUrl" className="input" placeholder="https://…actionstep.com/…" />
        </Field>
        <Field label="Notes" className="col-span-2">
          <textarea name="description" className="textarea" />
        </Field>
        {defaultSets.length > 0 && (
          <label className="col-span-2 flex items-center gap-2 rounded-md bg-surface-2 px-3 py-2 text-sm">
            <input type="checkbox" name="applyTemplates" defaultChecked />
            Create the standard tasks ({defaultSets.map((s) => s.name).join(", ")})
          </label>
        )}
        <div className="col-span-2 flex justify-end gap-2 pt-1">
          <button type="button" className="btn" onClick={onClose} disabled={pending}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={pending}>
            {pending ? "Creating…" : "Create case"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
