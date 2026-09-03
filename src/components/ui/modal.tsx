"use client";

import { useEffect } from "react";
import clsx from "clsx";
import { X } from "lucide-react";

export function Modal({
  open,
  onClose,
  title,
  children,
  width = "max-w-lg",
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  children: React.ReactNode;
  width?: string;
  footer?: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/40 p-4 pt-[6vh] backdrop-blur-[2px]" onMouseDown={onClose}>
      <div className={clsx("card w-full shadow-pop", width)} onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="flex items-center justify-between border-b border-line px-5 py-3">
          <h2 className="text-base font-semibold">{title}</h2>
          <button className="rounded-md p-1 text-muted hover:bg-surface-2 hover:text-ink" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
        {footer && <div className="flex items-center justify-end gap-2 border-t border-line px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}

/** Right-hand slide-over panel. */
export function Drawer({
  open,
  onClose,
  title,
  children,
  width = "w-[560px]",
}: {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  children: React.ReactNode;
  width?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-ink/30" onMouseDown={onClose}>
      <div className={clsx("flex h-full max-w-full flex-col bg-surface shadow-pop", width)} onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-line px-5 py-3">
          <div className="min-w-0 flex-1 text-base font-semibold">{title}</div>
          <button className="rounded-md p-1 text-muted hover:bg-surface-2 hover:text-ink" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  );
}
