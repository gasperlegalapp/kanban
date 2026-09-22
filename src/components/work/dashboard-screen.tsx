import Link from "next/link";
import clsx from "clsx";
import { differenceInCalendarDays, parseISO } from "date-fns";
import { AlertTriangle, CalendarClock, CircleAlert, ClipboardCheck, Clock, Hourglass, Moon } from "lucide-react";
import type { Dashboard } from "@/lib/data/work";
import type { CaseSummary } from "@/lib/data/types";
import { HEALTH_COLORS } from "@/lib/domain/constants";
import { dueLabel, fmtDate, relTime } from "@/lib/format";

const STALE_DAYS = 30;

export function DashboardScreen({ data, firstName, isAttorney }: { data: Dashboard; firstName: string; isAttorney: boolean }) {
  const today = parseISO(data.today);
  const red = data.cases.filter((c) => c.metrics.health === "red");
  const yellow = data.cases.filter((c) => c.metrics.health === "yellow");
  const attention = [...red, ...yellow].slice(0, 14);
  const stale = data.cases
    .filter((c) => differenceInCalendarDays(today, new Date(c.lastActivityAt)) >= STALE_DAYS)
    .sort((a, b) => new Date(a.lastActivityAt).getTime() - new Date(b.lastActivityAt).getTime())
    .slice(0, 8);
  const thisWeek = data.events.filter((e) => differenceInCalendarDays(parseISO(e.date), today) <= 7).length;
  const overdueEvents = data.events.filter((e) => e.date < data.today).length;

  const tiles: { label: string; value: number; href: string; tone?: "bad" | "warn"; icon: typeof Clock; note?: string; noteTone?: "bad" }[] = [
    { label: "Active cases", value: data.cases.length, href: "/boards/probate", icon: Hourglass },
    { label: "Cases in red", value: red.length, href: "#attention", tone: red.length ? "bad" : undefined, icon: CircleAlert, note: `${yellow.length} yellow` },
    { label: "Overdue tasks", value: data.overdueTasks, href: "#workload", tone: data.overdueTasks ? "bad" : undefined, icon: AlertTriangle },
    { label: "Follow-ups due", value: data.followUpsDue, href: "#workload", tone: data.followUpsDue ? "warn" : undefined, icon: Clock },
    { label: "Awaiting review", value: data.reviewQueue, href: isAttorney ? "/review" : "#workload", tone: data.reviewQueue ? "warn" : undefined, icon: ClipboardCheck },
    {
      label: "Hearings & deadlines, 7 days",
      value: thisWeek,
      href: "#upcoming",
      tone: overdueEvents ? "bad" : undefined,
      icon: CalendarClock,
      note: overdueEvents ? `${overdueEvents} overdue` : undefined,
      noteTone: overdueEvents ? "bad" : undefined,
    },
  ];

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-7xl px-5 py-4">
        <div className="mb-4 flex items-baseline gap-3">
          <h1 className="text-lg font-semibold">Good {greeting()}, {firstName}</h1>
          <span className="text-sm text-muted">{fmtDate(data.today, "EEEE, MMMM d")}</span>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          {tiles.map((t) => (
            <Link key={t.label} href={t.href} className="card group px-4 py-3 transition hover:shadow-card-hover">
              <div className="flex items-center gap-1.5 text-xs font-medium text-muted">
                <t.icon size={13} className={clsx(t.tone === "bad" ? "text-bad" : t.tone === "warn" ? "text-amber-600" : "text-faint")} />
                {t.label}
              </div>
              <div className="mt-1 text-3xl font-semibold tabular-nums text-ink">{t.value}</div>
              {t.note && <div className={clsx("text-[11px]", t.noteTone === "bad" ? "font-medium text-bad" : "text-muted")}>{t.note}</div>}
            </Link>
          ))}
        </div>

        <div className="grid gap-4 lg:grid-cols-5">
          <div className="grid content-start gap-4 lg:col-span-3">
            <section id="attention" className="card overflow-hidden">
              <Header title="Cases needing attention" count={red.length + yellow.length} hint="Red first, then yellow. Hover a case for all reasons." />
              {attention.length === 0 ? (
                <Empty text="Every active case is on track." />
              ) : (
                <ul className="divide-y divide-line">
                  {attention.map((c) => (
                    <CaseRow key={c.id} c={c} />
                  ))}
                </ul>
              )}
              {red.length + yellow.length > attention.length && (
                <p className="border-t border-line px-3 py-2 text-xs text-muted">
                  {red.length + yellow.length - attention.length} more on the boards (filter by health).
                </p>
              )}
            </section>

            <section className="card overflow-hidden">
              <Header title={`No activity in ${STALE_DAYS}+ days`} count={stale.length} icon={<Moon size={12} />} hint="Oldest first." />
              {stale.length === 0 ? (
                <Empty text="Every case has been touched in the last month." />
              ) : (
                <ul className="divide-y divide-line">
                  {stale.map((c) => (
                    <li key={c.id}>
                      <Link href={`/cases/${c.id}`} className="flex items-center gap-3 px-3 py-2 text-sm hover:bg-surface-2">
                        <span className="min-w-0 flex-1 truncate font-medium">{c.title}</span>
                        <span className="hidden text-xs text-muted sm:inline">{c.stage.name}</span>
                        <span className="w-28 truncate text-right text-xs text-muted">{c.ownerName ?? "Unassigned"}</span>
                        <span className="w-28 text-right text-xs text-muted">{relTime(c.lastActivityAt)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          <div className="grid content-start gap-4 lg:col-span-2">
            <section id="workload" className="card overflow-hidden">
              <Header title="Workload" hint="Open tasks by person. Click a name to see their list." />
              <table className="w-full text-sm">
                <thead className="text-left text-[10px] font-bold uppercase tracking-wider text-muted">
                  <tr className="border-b border-line">
                    <th className="px-3 py-1.5">Person</th>
                    <th className="px-2 py-1.5 text-right">Open</th>
                    <th className="px-2 py-1.5 text-right">Overdue</th>
                    <th className="px-2 py-1.5 text-right">Due ≤7d</th>
                    <th className="px-2 py-1.5 text-right">Follow-up</th>
                    <th className="px-3 py-1.5 text-right">In review</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {data.workload.map((w) => (
                    <tr key={w.person.id} className="hover:bg-surface-2">
                      <td className="px-3 py-1.5">
                        <Link href={`/my?user=${w.person.id}`} className="font-medium hover:underline">
                          {w.person.fullName}
                        </Link>
                      </td>
                      <Num v={w.open} />
                      <Num v={w.overdue} tone="bad" />
                      <Num v={w.dueSoon} />
                      <Num v={w.followUps} tone="warn" />
                      <Num v={w.inReview} className="pr-3" />
                    </tr>
                  ))}
                  <tr className="bg-surface-2/60 text-muted">
                    <td className="px-3 py-1.5 italic">Unassigned</td>
                    <Num v={data.unassigned} />
                    <td colSpan={4} />
                  </tr>
                </tbody>
              </table>
            </section>

            <section id="upcoming" className="card overflow-hidden">
              <Header title="Hearings and deadlines" hint="Next 14 days, plus anything overdue." icon={<CalendarClock size={12} />} />
              {data.events.length === 0 ? (
                <Empty text="Nothing scheduled in the next two weeks." />
              ) : (
                <ul className="divide-y divide-line">
                  {data.events.map((e) => {
                    const due = dueLabel(e.date);
                    return (
                      <li key={e.id}>
                        <Link href={`/cases/${e.caseId}`} className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-surface-2">
                          <span className={clsx("badge", e.kind === "hearing" ? "bg-violet-100 text-violet-700" : "bg-red-50 text-red-700")}>{e.kind}</span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate">{e.title}</span>
                            <span className="block truncate text-[11px] text-muted">{e.caseTitle}</span>
                          </span>
                          <span className="text-right">
                            <span className="block font-mono text-xs">
                              {fmtDate(e.date, "EEE M/d")}
                              {e.time ? ` ${e.time}` : ""}
                            </span>
                            {due.text && (
                              <span className={clsx("block text-[11px] font-semibold", due.tone === "bad" && "text-bad", due.tone === "warn" && "text-amber-700", due.tone === "muted" && "font-normal text-faint")}>
                                {due.text}
                              </span>
                            )}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

function greeting(): string {
  const h = Number(new Intl.DateTimeFormat("en-US", { hour: "numeric", hour12: false, timeZone: "America/New_York" }).format(new Date()));
  return h < 12 ? "morning" : h < 17 ? "afternoon" : "evening";
}

function Header({ title, count, hint, icon }: { title: string; count?: number; hint?: string; icon?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 border-b border-line bg-surface-2 px-3 py-2">
      <h2 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-ink-2">
        {icon}
        {title}
      </h2>
      {count !== undefined && <span className="rounded-full bg-surface px-1.5 text-[10px] text-muted">{count}</span>}
      {hint && <span className="ml-auto hidden text-[11px] text-faint sm:inline">{hint}</span>}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="px-3 py-6 text-center text-sm text-muted">{text}</p>;
}

function Num({ v, tone, className }: { v: number; tone?: "bad" | "warn"; className?: string }) {
  return (
    <td className={clsx("px-2 py-1.5 text-right tabular-nums", v === 0 ? "text-faint" : tone === "bad" ? "font-semibold text-bad" : tone === "warn" ? "font-semibold text-amber-700" : "text-ink", className)}>
      {v}
    </td>
  );
}

function CaseRow({ c }: { c: CaseSummary }) {
  const m = c.metrics;
  return (
    <li>
      <Link href={`/cases/${c.id}`} className="flex items-center gap-3 px-3 py-2 hover:bg-surface-2" title={m.reasons.join("\n")}>
        <span className="flex w-14 shrink-0 items-center gap-1.5 text-[11px] font-semibold uppercase" style={{ color: HEALTH_COLORS[m.health] }}>
          <span className="h-2 w-2 rounded-full" style={{ background: HEALTH_COLORS[m.health] }} />
          <span className="text-ink-2">{m.health === "red" ? "Red" : "Yellow"}</span>
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{c.title}</span>
          <span className="block truncate text-[11px] text-muted">{m.reasons.join(" · ")}</span>
        </span>
        <span className="hidden w-32 truncate text-right text-xs text-muted md:inline">{c.stage.name}</span>
        <span className="w-28 truncate text-right text-xs text-muted">{c.ownerName ?? "Unassigned"}</span>
      </Link>
    </li>
  );
}
