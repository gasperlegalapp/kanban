import { addDays, endOfMonth, endOfWeek, format, parse, startOfMonth, startOfWeek } from "date-fns";
import { getCalendarData } from "@/lib/data/boards";
import { CalendarView } from "@/components/calendar/calendar-view";

export const dynamic = "force-dynamic";
export const metadata = { title: "Calendar" };

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const { month } = await searchParams;
  const base = month && /^\d{4}-\d{2}$/.test(month) ? parse(month, "yyyy-MM", new Date()) : new Date();
  const gridStart = startOfWeek(startOfMonth(base), { weekStartsOn: 0 });
  const gridEnd = endOfWeek(endOfMonth(base), { weekStartsOn: 0 });
  // Also load the upcoming list beyond the visible grid.
  const listEnd = addDays(new Date(), 30);
  const to = listEnd > gridEnd ? listEnd : gridEnd;
  const data = await getCalendarData(format(gridStart, "yyyy-MM-dd"), format(to, "yyyy-MM-dd"));
  return <CalendarView month={format(base, "yyyy-MM")} gridStart={format(gridStart, "yyyy-MM-dd")} gridEnd={format(gridEnd, "yyyy-MM-dd")} events={data.events} tasks={data.tasks} />;
}
