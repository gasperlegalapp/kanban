"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useTransition } from "react";
import { Bell, CalendarDays, LayoutTemplate, LogOut, Scale, Settings, Users } from "lucide-react";
import clsx from "clsx";
import type { Board, Notification } from "@/db/schema";
import { signOut } from "@/lib/auth/actions";
import { markAllNotificationsRead, markNotificationRead } from "@/lib/actions/notifications";
import { ROLE_LABELS } from "@/lib/domain/constants";
import { formatDistanceToNow } from "date-fns";
import { ToastProvider } from "@/components/ui/toast";

type ShellUser = { id: string; fullName: string; role: "attorney" | "staff" };

export function AppShell({
  user,
  boards,
  unread,
  children,
}: {
  user: ShellUser;
  boards: Board[];
  unread: Notification[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isAttorney = user.role === "attorney";

  const nav = [
    ...boards.map((b) => ({ href: `/boards/${b.id}`, label: b.name, icon: Scale })),
    { href: "/calendar", label: "Calendar", icon: CalendarDays },
    ...(isAttorney
      ? [
          { href: "/templates", label: "Templates", icon: LayoutTemplate },
          { href: "/users", label: "Users", icon: Users },
          { href: "/settings", label: "Settings", icon: Settings },
        ]
      : []),
  ];

  return (
    <ToastProvider>
    <div className="flex h-screen flex-col overflow-hidden">
      <header className="flex h-12 shrink-0 items-center gap-4 border-b border-brand-2/40 bg-brand px-4 text-white shadow-md">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-white/15">
            <Scale size={16} />
          </span>
          Case Control
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          {nav.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={clsx(
                  "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 transition",
                  active ? "bg-white/15 text-white" : "text-white/75 hover:bg-white/10 hover:text-white",
                )}
              >
                <item.icon size={14} />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <NotificationsMenu unread={unread} />
          <div className="flex items-center gap-2 border-l border-white/15 pl-3">
            <div className="text-right leading-tight">
              <div className="text-sm font-medium">{user.fullName}</div>
              <div className="text-[10px] uppercase tracking-wide text-white/60">{ROLE_LABELS[user.role]}</div>
            </div>
            <form action={signOut}>
              <button type="submit" className="rounded-md p-1.5 text-white/70 hover:bg-white/10 hover:text-white" title="Sign out">
                <LogOut size={16} />
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="relative flex min-h-0 flex-1 flex-col">{children}</main>
    </div>
    </ToastProvider>
  );
}

function NotificationsMenu({ unread }: { unread: Notification[] }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="relative rounded-md p-1.5 text-white/80 hover:bg-white/10 hover:text-white"
        title="Notifications"
      >
        <Bell size={16} />
        {unread.length > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-bad px-1 text-[10px] font-bold">
            {unread.length}
          </span>
        )}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-9 z-40 w-80 overflow-hidden rounded-lg border border-line bg-surface text-ink shadow-pop">
            <div className="flex items-center justify-between border-b border-line px-3 py-2">
              <span className="text-sm font-semibold">Notifications</span>
              {unread.length > 0 && (
                <button
                  className="text-xs text-accent hover:underline disabled:opacity-50"
                  disabled={pending}
                  onClick={() => start(async () => void (await markAllNotificationsRead()))}
                >
                  Mark all read
                </button>
              )}
            </div>
            <div className="max-h-96 overflow-y-auto">
              {unread.length === 0 ? (
                <p className="px-3 py-6 text-center text-sm text-muted">You are all caught up.</p>
              ) : (
                unread.map((n) => (
                  <div key={n.id} className="border-b border-line px-3 py-2 last:border-0 hover:bg-surface-2">
                    <div className="flex items-start justify-between gap-2">
                      {n.href ? (
                        <Link href={n.href} className="text-sm font-medium hover:underline" onClick={() => setOpen(false)}>
                          {n.title}
                        </Link>
                      ) : (
                        <span className="text-sm font-medium">{n.title}</span>
                      )}
                      <button
                        className="shrink-0 text-[11px] text-muted hover:text-ink"
                        disabled={pending}
                        onClick={() => start(async () => void (await markNotificationRead(n.id)))}
                      >
                        Dismiss
                      </button>
                    </div>
                    {n.body && <p className="mt-0.5 text-xs text-muted">{n.body}</p>}
                    <p className="mt-1 text-[10px] uppercase tracking-wide text-faint">
                      {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
