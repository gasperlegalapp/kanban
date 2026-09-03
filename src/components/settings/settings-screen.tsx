"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { Plus, Trash2 } from "lucide-react";
import type { DeadlineAnchor, DeadlineRule, Stage } from "@/db/schema";
import type { BoardConfig } from "@/lib/data/types";
import { Field } from "@/components/ui/fields";
import { useToast } from "@/components/ui/toast";
import { createCaseType, createDeadlineRule, createLane, deleteDeadlineRule, renameLane, updateCaseType, updateDeadlineRule, updateGeneralSettings, updateStage } from "@/lib/actions/settings";

const ANCHORS: { id: DeadlineAnchor; label: string }[] = [
  { id: "appointment_date", label: "Appointment date" },
  { id: "date_of_death", label: "Date of death" },
  { id: "case_opened", label: "Case opened" },
];

type General = { firm_name: string; actionstep_base_url: string; reminder_days_before: number[] };

export function SettingsScreen({ configs, general }: { configs: BoardConfig[]; general: General }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const [boardId, setBoardId] = useState(configs[0]?.board.id ?? "probate");
  const config = configs.find((c) => c.board.id === boardId) ?? configs[0];

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, okMsg = "Saved.") =>
    start(async () => {
      const res = await fn();
      if (!res.ok) return toast.error(res.error ?? "Failed");
      toast.notify(okMsg);
      router.refresh();
    });

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-5xl px-5 py-4">
        <h1 className="mb-4 text-lg font-semibold">Settings</h1>

        <section className="card mb-4 p-4">
          <h2 className="panel-title mb-3">General</h2>
          <form
            action={(fd) =>
              run(() =>
                updateGeneralSettings({
                  firm_name: String(fd.get("firm_name") ?? ""),
                  actionstep_base_url: String(fd.get("actionstep_base_url") ?? ""),
                  reminder_days_before: String(fd.get("reminder_days_before") ?? "")
                    .split(",")
                    .map((s) => Number(s.trim()))
                    .filter((n) => Number.isInteger(n) && n >= 0),
                }),
              )
            }
            className="grid grid-cols-3 gap-3"
          >
            <Field label="Firm name">
              <input name="firm_name" className="input" defaultValue={general.firm_name} />
            </Field>
            <Field label="Actionstep base URL" hint="Optional. Your Actionstep address, for reference.">
              <input name="actionstep_base_url" className="input" defaultValue={general.actionstep_base_url} placeholder="https://go.actionstep.com" />
            </Field>
            <Field label="Remind days before deadlines" hint="Comma separated, e.g. 7, 1">
              <input name="reminder_days_before" className="input" defaultValue={general.reminder_days_before.join(", ")} />
            </Field>
            <div className="col-span-3">
              <button className="btn btn-primary btn-sm" disabled={pending}>
                Save general settings
              </button>
            </div>
          </form>
        </section>

        <div className="mb-3 flex rounded-md border border-line bg-surface p-0.5 w-fit">
          {configs.map((c) => (
            <button key={c.board.id} className={clsx("rounded px-3 py-1 text-sm", boardId === c.board.id ? "bg-brand text-white" : "text-muted hover:text-ink")} onClick={() => setBoardId(c.board.id)}>
              {c.board.name}
            </button>
          ))}
        </div>

        {config && (
          <div className="grid gap-4">
            <section className="card p-4">
              <h2 className="panel-title mb-1">Stage health thresholds</h2>
              <p className="mb-3 text-xs text-muted">A case turns yellow after the “watch” number of days in a stage and red after the “critical” number. Leave blank for never.</p>
              <table className="w-full text-sm">
                <thead className="text-left text-[11px] font-bold uppercase tracking-wider text-muted">
                  <tr>
                    <th className="py-1 pr-3">Stage</th>
                    <th className="w-28 py-1 pr-3">Watch (days)</th>
                    <th className="w-28 py-1 pr-3">Critical (days)</th>
                    <th className="py-1">Guidance shown on the column</th>
                    <th className="w-20" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {config.leafStages.map((s) => (
                    <StageRow key={s.id} stage={s} pending={pending} onSave={(v) => run(() => updateStage(s.id, v))} />
                  ))}
                </tbody>
              </table>
            </section>

            <section className="card p-4">
              <h2 className="panel-title mb-1">Deadline rules</h2>
              <p className="mb-3 text-xs text-muted">Deadlines created automatically for each case once the anchor date is known. Ohio statutory periods are the defaults; check them against your local rules.</p>
              <table className="w-full text-sm">
                <thead className="text-left text-[11px] font-bold uppercase tracking-wider text-muted">
                  <tr>
                    <th className="py-1 pr-3">Title</th>
                    <th className="w-40 py-1 pr-3">Anchor</th>
                    <th className="w-24 py-1 pr-3">Days after</th>
                    <th className="w-20 py-1 pr-3">Active</th>
                    <th className="py-1">Notes</th>
                    <th className="w-24" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {config.deadlineRules.map((r) => (
                    <RuleRow key={r.id} rule={r} pending={pending} onSave={(v) => run(() => updateDeadlineRule(r.id, v))} onDelete={() => confirm(`Delete rule "${r.title}"?`) && run(() => deleteDeadlineRule(r.id), "Rule deleted.")} />
                  ))}
                  <NewRuleRow pending={pending} onCreate={(v) => run(() => createDeadlineRule({ boardId: config.board.id, ...v }), "Rule added.")} />
                </tbody>
              </table>
            </section>

            <div className="grid grid-cols-2 gap-4">
              <section className="card p-4">
                <h2 className="panel-title mb-3">Lanes</h2>
                <ul className="mb-2 grid gap-1.5">
                  {config.lanes.map((l) => (
                    <li key={l.id} className="flex items-center gap-2">
                      <input className="input" defaultValue={l.name} onBlur={(e) => e.target.value.trim() && e.target.value.trim() !== l.name && run(() => renameLane(l.id, e.target.value.trim()))} disabled={pending} />
                    </li>
                  ))}
                </ul>
                <form
                  action={(fd) => {
                    const name = String(fd.get("name") ?? "").trim();
                    if (name) run(() => createLane({ boardId: config.board.id, name }), "Lane added.");
                  }}
                  className="flex gap-2"
                >
                  <input name="name" className="input" placeholder="New lane name" />
                  <button className="btn btn-sm" disabled={pending}>
                    <Plus size={12} /> Add
                  </button>
                </form>
              </section>
              <section className="card p-4">
                <h2 className="panel-title mb-3">Case types</h2>
                <ul className="mb-2 grid gap-1.5">
                  {config.caseTypes.map((t) => (
                    <li key={t.id} className="flex items-center gap-2">
                      <input type="color" className="h-8 w-10 cursor-pointer rounded border border-line" defaultValue={t.color} onChange={(e) => run(() => updateCaseType(t.id, { color: e.target.value }))} disabled={pending} />
                      <input className="input w-20" defaultValue={t.prefix ?? ""} placeholder="Prefix" onBlur={(e) => (e.target.value.trim() || "") !== (t.prefix ?? "") && run(() => updateCaseType(t.id, { prefix: e.target.value.trim() }))} disabled={pending} />
                      <input className="input" defaultValue={t.name} onBlur={(e) => e.target.value.trim() && e.target.value.trim() !== t.name && run(() => updateCaseType(t.id, { name: e.target.value.trim() }))} disabled={pending} />
                    </li>
                  ))}
                </ul>
                <form
                  action={(fd) => {
                    const name = String(fd.get("name") ?? "").trim();
                    if (name) run(() => createCaseType({ boardId: config.board.id, name, prefix: String(fd.get("prefix") ?? "").trim(), color: String(fd.get("color") ?? "#64748b") }), "Case type added.");
                  }}
                  className="flex gap-2"
                >
                  <input name="color" type="color" className="h-8 w-10 cursor-pointer rounded border border-line" defaultValue="#64748b" />
                  <input name="prefix" className="input w-20" placeholder="Prefix" />
                  <input name="name" className="input" placeholder="New case type" />
                  <button className="btn btn-sm" disabled={pending}>
                    <Plus size={12} /> Add
                  </button>
                </form>
              </section>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StageRow({ stage, pending, onSave }: { stage: Stage; pending: boolean; onSave: (v: { stuckDays: number | null; criticalDays: number | null; policy: string | null }) => void }) {
  const [stuck, setStuck] = useState(stage.stuckDays?.toString() ?? "");
  const [critical, setCritical] = useState(stage.criticalDays?.toString() ?? "");
  const [policy, setPolicy] = useState(stage.policy ?? "");
  const dirty = stuck !== (stage.stuckDays?.toString() ?? "") || critical !== (stage.criticalDays?.toString() ?? "") || policy !== (stage.policy ?? "");
  return (
    <tr>
      <td className="py-1.5 pr-3 font-medium">{stage.name}</td>
      <td className="py-1.5 pr-3">
        <input className="input" value={stuck} onChange={(e) => setStuck(e.target.value)} inputMode="numeric" />
      </td>
      <td className="py-1.5 pr-3">
        <input className="input" value={critical} onChange={(e) => setCritical(e.target.value)} inputMode="numeric" />
      </td>
      <td className="py-1.5">
        <input className="input" value={policy} onChange={(e) => setPolicy(e.target.value)} />
      </td>
      <td className="py-1.5 text-right">
        <button className="btn btn-sm" disabled={!dirty || pending} onClick={() => onSave({ stuckDays: stuck === "" ? null : Number(stuck), criticalDays: critical === "" ? null : Number(critical), policy: policy || null })}>
          Save
        </button>
      </td>
    </tr>
  );
}

function RuleRow({ rule, pending, onSave, onDelete }: { rule: DeadlineRule; pending: boolean; onSave: (v: { title: string; anchor: DeadlineAnchor; offsetDays: number; isActive: boolean; notes: string }) => void; onDelete: () => void }) {
  const [v, setV] = useState({ title: rule.title, anchor: rule.anchor, offsetDays: rule.offsetDays, isActive: rule.isActive, notes: rule.notes });
  const dirty = v.title !== rule.title || v.anchor !== rule.anchor || v.offsetDays !== rule.offsetDays || v.isActive !== rule.isActive || v.notes !== rule.notes;
  return (
    <tr>
      <td className="py-1.5 pr-3">
        <input className="input" value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} />
      </td>
      <td className="py-1.5 pr-3">
        <select className="select" value={v.anchor} onChange={(e) => setV({ ...v, anchor: e.target.value as DeadlineAnchor })}>
          {ANCHORS.map((a) => (
            <option key={a.id} value={a.id}>
              {a.label}
            </option>
          ))}
        </select>
      </td>
      <td className="py-1.5 pr-3">
        <input className="input" type="number" value={v.offsetDays} onChange={(e) => setV({ ...v, offsetDays: Number(e.target.value) })} />
      </td>
      <td className="py-1.5 pr-3">
        <input type="checkbox" checked={v.isActive} onChange={(e) => setV({ ...v, isActive: e.target.checked })} />
      </td>
      <td className="py-1.5">
        <input className="input" value={v.notes} onChange={(e) => setV({ ...v, notes: e.target.value })} />
      </td>
      <td className="py-1.5 text-right">
        <div className="flex justify-end gap-1">
          <button className="btn btn-sm" disabled={!dirty || pending} onClick={() => onSave(v)}>
            Save
          </button>
          <button className="btn btn-ghost btn-sm text-bad" disabled={pending} onClick={onDelete}>
            <Trash2 size={12} />
          </button>
        </div>
      </td>
    </tr>
  );
}

function NewRuleRow({ pending, onCreate }: { pending: boolean; onCreate: (v: { title: string; anchor: DeadlineAnchor; offsetDays: number; notes: string }) => void }) {
  const [v, setV] = useState({ title: "", anchor: "appointment_date" as DeadlineAnchor, offsetDays: 90, notes: "" });
  return (
    <tr className="bg-surface-2/60">
      <td className="py-1.5 pr-3">
        <input className="input" placeholder="New rule title" value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} />
      </td>
      <td className="py-1.5 pr-3">
        <select className="select" value={v.anchor} onChange={(e) => setV({ ...v, anchor: e.target.value as DeadlineAnchor })}>
          {ANCHORS.map((a) => (
            <option key={a.id} value={a.id}>
              {a.label}
            </option>
          ))}
        </select>
      </td>
      <td className="py-1.5 pr-3">
        <input className="input" type="number" value={v.offsetDays} onChange={(e) => setV({ ...v, offsetDays: Number(e.target.value) })} />
      </td>
      <td className="py-1.5 pr-3" />
      <td className="py-1.5">
        <input className="input" placeholder="Notes" value={v.notes} onChange={(e) => setV({ ...v, notes: e.target.value })} />
      </td>
      <td className="py-1.5 text-right">
        <button
          className="btn btn-sm"
          disabled={!v.title.trim() || pending}
          onClick={() => {
            onCreate(v);
            setV({ title: "", anchor: "appointment_date", offsetDays: 90, notes: "" });
          }}
        >
          <Plus size={12} /> Add
        </button>
      </td>
    </tr>
  );
}
