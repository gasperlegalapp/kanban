"use client";

import clsx from "clsx";

export function Field({ label, children, hint, className }: { label: string; children: React.ReactNode; hint?: string; className?: string }) {
  return (
    <label className={clsx("block", className)}>
      <span className="label">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

export function HealthDot({ health, size = 8 }: { health: "green" | "yellow" | "red"; size?: number }) {
  const color = health === "red" ? "#ef4444" : health === "yellow" ? "#f59e0b" : "#10b981";
  return <span className="inline-block shrink-0 rounded-full" style={{ width: size, height: size, background: color }} />;
}

export function Spinner({ className }: { className?: string }) {
  return <span className={clsx("inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent", className)} />;
}
