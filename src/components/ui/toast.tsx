"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import clsx from "clsx";
import { AlertTriangle, CheckCircle2, X } from "lucide-react";

type Toast = { id: number; message: string; tone: "ok" | "error" };
type ToastApi = { notify: (message: string) => void; error: (message: string) => void };

const ToastContext = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((message: string, tone: Toast["tone"]) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, message, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), tone === "error" ? 7000 : 3500);
  }, []);
  const api = useMemo<ToastApi>(() => ({ notify: (m) => push(m, "ok"), error: (m) => push(m, "error") }), [push]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-80 flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={clsx(
              "pointer-events-auto flex items-start gap-2 rounded-lg border px-3 py-2 text-sm shadow-pop",
              t.tone === "error" ? "border-bad/40 bg-white text-bad" : "border-ok/40 bg-white text-ink",
            )}
          >
            {t.tone === "error" ? <AlertTriangle size={16} className="mt-0.5 shrink-0" /> : <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-ok" />}
            <span className="flex-1">{t.message}</span>
            <button className="text-muted hover:text-ink" onClick={() => setToasts((x) => x.filter((y) => y.id !== t.id))}>
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside ToastProvider");
  return ctx;
}
