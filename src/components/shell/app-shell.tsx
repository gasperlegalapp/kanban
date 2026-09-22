"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Bell, CalendarDays, ChevronDown, ClipboardCheck, Inbox, LayoutDashboard, LayoutTemplate, LogOut, Scale, Settings, Users } from "lucide-react";
import clsx from "clsx";
import { formatDistanceToNow } from "date-fns";
import type { Board, Notification } from "@/db/schema";
import { signOut } from "@/lib/auth/actions";
import { markAllNotificationsRead, markNotificationRead } from "@/lib/actions/notifications";
import { ROLE_LABELS } from "@/lib/domain/constants";
import { ToastProvider } from "@/components/ui/toast";

type ShellUser = { id: string; fullName: string; role: "attorney" | "staff" };
type NavItem = { href: string; label: string; icon: typeof Scale; badge?: number; badgeTone?: "bad" | "warn" };

export function AppShell({
  user,
  boards,
  unread,
  counts,
  children,
}: {
  user: ShellUser;
  boards: Board[];
  unread: Notification[];
  counts: { myUrgent: number; review: number };
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isAttorney = user.role === "attorney";

  const nav: NavItem[] = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/my", label: "My work", icon: Inbox, badge: counts.myUrgent, badgeTone: "bad" },
    ...(isAttorney ? [{ href: "/review", label: "Review", icon: ClipboardCheck, badge: counts.review, badgeTone: "warn" as const }] : []),
    ...boards.map((b) => ({ href: `/boards/${b.id}`, label: b.name.replace(/ Cases$/, ""), icon: Scale })),
    { href: "/calendar", label: "Calendar", icon: CalendarDays },
  ];
  const admin: NavItem[] = isAttorney
    ? [
        { href: "/templates", label: "Templates", icon: LayoutTemplate },
        { href: "/users", label: "Users", icon: Users },
        { href: "/settings", label: "Settings", icon: Settings },
      ]
    : [];
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  return (
    <ToastProvider>
      <div className="flex h-screen flex-col overflow-hidden">
        <header className="flex h-12 shrink-0 items-center gap-3 border-b border-brand-2/40 bg-brand px-4 text-white shadow-md">
          <Link href="/dashboard" className="flex shrink-0 items-center gap-2 font-semibold tracking-tight">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-white/15">
              <Scale size={16} />
            </span>
            <span className="hidden xl:inline">Case Control</span>
          </Link>
          <nav className="flex min-w-0 items-center gap-0.5 overflow-x-auto text-sm">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={clsx(
                  "flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 transition",
                  isActive(item.href) ? "bg-white/15 text-white" : "text-white/75 hover:bg-white/10 hover:text-white",
                )}
              >
                <item.icon size={14} />
                {item.label}
                {!!item.badge && (
                  <span
                    className={clsx(
                      "min-w-4 rounded-full px-1 text-center text-[10px] font-bold leading-4",
                      item.badgeTone === "warn" ? "bg-amber-400 text-ink" : "bg-bad text-white",
                    )}
                  >
                    {item.badge}
                  </span>
                )}
              </Link>
            ))}
            {admin.length > 0 && <AdminMenu items={admin} active={admin.some((a) => isActive(a.href))} />}
          </nav>
          <div className="ml-auto flex shrink-0 items-center gap-2">
            <NotificationsMenu unread={unread} />
            <div className="flex items-center gap-2 border-l border-white/15 pl-3">
              <Link href="/account" className="text-right leading-tight hover:opacity-80" title="My account and notification settings">
                <div className="text-sm font-medium">{user.fullName}</div>
                <div className="text-[10px] uppercase tracking-wide text-white/60">{ROLE_LABELS[user.role]}</div>
              </Link>
              <form action={signOut}>
                <button type="submit" className="rounded-md p-1.5 text-white/70 hover:bg-white/10 hover:text-white" title="Sign out" aria-label="Sign out">
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

function AdminMenu({ items, active }: { items: NavItem[]; active: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={clsx("flex items-center gap-1 rounded-md px-2.5 py-1.5", active ? "bg-white/15 text-white" : "text-white/75 hover:bg-white/10 hover:text-white")}
      >
        <Settings size={14} /> Admin <ChevronDown size={12} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-9 z-40 w-44 overflow-hidden rounded-lg border border-line bg-surface py-1 text-ink shadow-pop">
            {items.map((i) => (
              <Link key={i.href} href={i.href} onClick={() => setOpen(false)} className="flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-surface-2">
                <i.icon size={14} className="text-muted" /> {i.label}
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function NotificationsMenu({ unread }: { unread: Notification[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="relative rounded-md p-1.5 text-white/80 hover:bg-white/10 hover:text-white"
        title="Notifications"
        aria-label={`Notifications${unread.length ? ` (${unread.length} unread)` : ""}`}
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
          <div className="absolute right-0 top-9 z-40 w-96 overflow-hidden rounded-lg border border-line bg-surface text-ink shadow-pop">
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
            <div className="max-h-[28rem] overflow-y-auto">
              {unread.length === 0 ? (
                <p className="px-3 py-6 text-center text-sm text-muted">You are all caught up.</p>
              ) : (
                unread.map((n) => (
                  <div key={n.id} className="border-b border-line px-3 py-2 last:border-0 hover:bg-surface-2">
                    <div className="flex items-start justify-between gap-2">
                      <button
                        className="text-left text-sm font-medium hover:underline"
                        onClick={() => {
                          setOpen(false);
                          start(async () => {
                            await markNotificationRead(n.id);
                            if (n.href) router.push(n.href);
                          });
                        }}
                      >
                        {n.title}
                      </button>
                      <button
                        className="shrink-0 text-[11px] text-muted hover:text-ink"
                        disabled={pending}
                        onClick={() => start(async () => void (await markNotificationRead(n.id)))}
                      >
                        Dismiss
                      </button>
                    </div>
                    {n.body && <p className="mt-0.5 line-clamp-3 whitespace-pre-wrap text-xs text-muted">{n.body}</p>}
                    <p className="mt-1 text-[10px] uppercase tracking-wide text-faint">{formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}</p>
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
