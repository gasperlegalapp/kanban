"use client";

import { Search, X } from "lucide-react";
import type { BoardConfig } from "@/lib/data/types";

export type CaseFilters = {
  search: string;
  ownerId: string;
  health: "" | "green" | "yellow" | "red";
  stuckDays: number;
  caseTypeId: string;
  laneId: string;
};

export const EMPTY_FILTERS: CaseFilters = { search: "", ownerId: "", health: "", stuckDays: 0, caseTypeId: "", laneId: "" };

export function FilterBar({ config, filters, onChange }: { config: BoardConfig; filters: CaseFilters; onChange: (f: CaseFilters) => void }) {
  const set = <K extends keyof CaseFilters>(k: K, v: CaseFilters[K]) => onChange({ ...filters, [k]: v });
  const active = JSON.stringify(filters) !== JSON.stringify(EMPTY_FILTERS);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative">
        <Search size={13} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-faint" />
        <input
          className="input h-8 w-56 pl-7"
          placeholder="Search title, number, client…"
          value={filters.search}
          onChange={(e) => set("search", e.target.value)}
        />
      </div>
      <select className="select h-8 w-auto" value={filters.ownerId} onChange={(e) => set("ownerId", e.target.value)}>
        <option value="">All owners</option>
        {config.people
          .filter((p) => p.isActive)
          .map((p) => (
            <option key={p.id} value={p.id}>
              {p.fullName}
            </option>
          ))}
      </select>
      <select className="select h-8 w-auto" value={filters.health} onChange={(e) => set("health", e.target.value as CaseFilters["health"])}>
        <option value="">Any health</option>
        <option value="green">Green</option>
        <option value="yellow">Yellow</option>
        <option value="red">Red</option>
      </select>
      <select className="select h-8 w-auto" value={filters.stuckDays} onChange={(e) => set("stuckDays", Number(e.target.value))}>
        <option value={0}>Any duration</option>
        <option value={7}>Stuck &gt; 7 days</option>
        <option value={14}>Stuck &gt; 14 days</option>
        <option value={30}>Stuck &gt; 30 days</option>
        <option value={60}>Stuck &gt; 60 days</option>
        <option value={90}>Stuck &gt; 90 days</option>
      </select>
      {config.caseTypes.length > 0 && (
        <select className="select h-8 w-auto" value={filters.caseTypeId} onChange={(e) => set("caseTypeId", e.target.value)}>
          <option value="">All types</option>
          {config.caseTypes.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      )}
      {active && (
        <button className="btn btn-ghost btn-sm text-muted" onClick={() => onChange(EMPTY_FILTERS)}>
          <X size={12} /> Reset
        </button>
      )}
    </div>
  );
}
