import { useIpos } from "@/lib/market/context";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, List } from "lucide-react";
import { MONTHS, todayIso, type Ipo } from "@/lib/ipo-data";
import { PageHead } from "@/components/site";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/calendar")({
  head: () => ({
    meta: [
      { title: "IPO calendar — openings, closings, listings | IPO Lens" },
      {
        name: "description",
        content: "Monthly calendar of Indian IPO open, close, allotment and listing dates.",
      },
      { property: "og:title", content: "IPO calendar | IPO Lens" },
      { property: "og:description", content: "Every IPO date on one monthly calendar." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Cal,
});

const kinds = {
  open: { l: "Opens", c: "bg-positive-soft text-positive" },
  close: { l: "Closes", c: "bg-warning-soft text-warning" },
  allotment: { l: "Allot.", c: "bg-muted text-foreground" },
  listing: { l: "Lists", c: "bg-accent text-primary" },
} as const;
type CalendarEvent = { k: keyof typeof kinds; i: Ipo };

function Cal() {
  const ipos = useIpos("/api/calendar");
  const now = new Date();
  const [m, setM] = useState({ y: now.getFullYear(), mo: now.getMonth() });
  const [view, setView] = useState<"auto" | "grid" | "list">("auto");
  const listRef = useRef<HTMLDivElement>(null);
  const first = new Date(m.y, m.mo, 1);
  const startPad = (first.getDay() + 6) % 7;
  const daysIn = new Date(m.y, m.mo + 1, 0).getDate();
  const t = todayIso();
  const iso = (day: number) =>
    `${m.y}-${String(m.mo + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const monthPrefix = `${m.y}-${String(m.mo + 1).padStart(2, "0")}-`;
  const eventsByDay = useMemo(() => {
    const days = new Map<string, CalendarEvent[]>();
    for (const i of ipos) {
      for (const k of Object.keys(kinds) as (keyof typeof kinds)[]) {
        const date = i[k];
        if (!date?.startsWith(monthPrefix)) continue;
        const events = days.get(date) ?? [];
        events.push({ k, i });
        days.set(date, events);
      }
    }
    return days;
  }, [ipos, monthPrefix]);
  const agendaDays = useMemo(
    () => [...eventsByDay.entries()].sort(([a], [b]) => a.localeCompare(b)),
    [eventsByDay],
  );
  const eventCount = agendaDays.reduce((count, [, events]) => count + events.length, 0);
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const nextDate = monthPrefix === t.slice(0, 7) + "-"
      ? agendaDays.find(([date]) => date >= t)?.[0]
      : undefined;
    const target = nextDate ? list.querySelector<HTMLElement>(`[data-date="${nextDate}"]`) : null;
    list.scrollTop = target
      ? target.getBoundingClientRect().top - list.getBoundingClientRect().top + list.scrollTop
      : 0;
  }, [agendaDays, monthPrefix, t, view]);
  const move = (n: number) =>
    setM(({ y, mo }) => {
      const d = new Date(y, mo + n, 1);
      return { y: d.getFullYear(), mo: d.getMonth() };
    });
  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <PageHead
        title="IPO calendar"
        desc="Openings, closings, allotments and listings in one place. Dates are in IST. Bidding typically closes at 5 PM on the final day."
      >
        <div className="flex items-center gap-2">
          <button
            aria-label="Previous month"
            onClick={() => move(-1)}
            className="grid h-9 w-9 place-items-center rounded-md border"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="w-36 text-center font-semibold">
            {MONTHS[m.mo]} {m.y}
          </span>
          <button
            aria-label="Next month"
            onClick={() => move(1)}
            className="grid h-9 w-9 place-items-center rounded-md border"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </PageHead>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs font-medium text-muted-foreground">
          {eventCount} {eventCount === 1 ? "event" : "events"} in {MONTHS[m.mo]}
        </p>
        <div className="inline-flex rounded-lg border bg-card p-1" aria-label="Calendar view">
          <button
            type="button"
            onClick={() => setView("grid")}
            className={cn(
              "inline-flex min-h-9 items-center gap-1.5 rounded-md px-3 text-xs font-semibold transition-colors",
              view === "grid" && "bg-primary text-primary-foreground",
              view === "auto" && "hidden bg-primary text-primary-foreground md:inline-flex",
              view === "list" && "text-muted-foreground hover:text-foreground",
            )}
          >
            <CalendarDays className="h-3.5 w-3.5" /> Month
          </button>
          {view === "auto" && (
            <button
              type="button"
              onClick={() => setView("grid")}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-md px-3 text-xs font-semibold text-muted-foreground md:hidden"
            >
              <CalendarDays className="h-3.5 w-3.5" /> Month
            </button>
          )}
          <button
            type="button"
            onClick={() => setView("list")}
            className={cn(
              "inline-flex min-h-9 items-center gap-1.5 rounded-md px-3 text-xs font-semibold transition-colors",
              view === "list" && "bg-primary text-primary-foreground",
              view === "auto" && "bg-primary text-primary-foreground md:bg-transparent md:text-muted-foreground",
              view === "grid" && "text-muted-foreground hover:text-foreground",
            )}
          >
            <List className="h-3.5 w-3.5" /> List
          </button>
        </div>
      </div>
      <div className="mb-4 flex flex-wrap gap-2 text-xs">
        {Object.values(kinds).map((k) => (
          <span key={k.l} className={cn("rounded px-1.5 py-0.5 font-medium", k.c)}>
            {k.l}
          </span>
        ))}
      </div>
      <div className={cn("overflow-x-auto", view === "auto" && "hidden md:block", view === "list" && "hidden")}>
        <div className="grid min-w-[760px] grid-cols-7 gap-px overflow-hidden rounded-xl border bg-border text-sm">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
            <div
              key={d}
              className="bg-muted/60 px-2 py-1.5 text-xs font-medium text-muted-foreground"
            >
              {d}
            </div>
          ))}
          {Array.from({ length: startPad }).map((_, i) => (
            <div key={"p" + i} className="bg-card/50" />
          ))}
          {Array.from({ length: daysIn }, (_, i) => i + 1).map((day) => {
            const date = iso(day);
            return (
              <div
                key={day}
                className={cn(
                  "min-h-28 bg-card p-1.5",
                  date === t && "ring-2 ring-inset ring-primary",
                )}
              >
                <div
                  className={cn(
                    "num mb-1 text-xs",
                    date === t ? "font-bold text-primary" : "text-muted-foreground",
                  )}
                >
                  {day}
                </div>
                <div className="space-y-1">
                  {(eventsByDay.get(date) ?? []).map(({ k, i }) => (
                    <Link
                      key={k + i.slug}
                      to="/ipo/$slug"
                      params={{ slug: i.slug }}
                      className={cn(
                        "block truncate rounded px-1 py-0.5 text-[11px] font-medium hover:underline",
                        kinds[k].c,
                      )}
                    >
                      {kinds[k].l} · {i.name}
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div className={cn("overflow-hidden rounded-xl border bg-card", view === "auto" && "md:hidden", view === "grid" && "hidden")}>
        {agendaDays.length ? (
          <div ref={listRef} className="max-h-[70vh] divide-y overflow-y-auto overscroll-contain">
            {agendaDays.map(([date, events]) => {
              const day = Number(date.slice(-2));
              const weekday = new Intl.DateTimeFormat("en-IN", { weekday: "short" }).format(new Date(m.y, m.mo, day));
              return (
                <section key={date} data-date={date} className="grid grid-cols-[3.5rem_minmax(0,1fr)] gap-2 px-3 py-3 sm:grid-cols-[5rem_minmax(0,1fr)] sm:px-4">
                  <div className="sticky top-0 self-start text-center">
                    <div className={cn("num text-xl font-bold", date === t && "text-primary")}>{day}</div>
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{weekday}</div>
                    {date === t && <div className="mt-1 text-[9px] font-bold uppercase text-primary">Today</div>}
                  </div>
                  <div className="space-y-2">
                    {events.map(({ k, i }) => (
                      <Link
                        key={k + i.slug}
                        to="/ipo/$slug"
                        params={{ slug: i.slug }}
                        className="flex min-h-12 items-center gap-3 rounded-lg border bg-background px-3 py-2 transition-colors hover:border-primary/40 hover:bg-accent/40"
                      >
                        <span className={cn("shrink-0 rounded px-1.5 py-1 text-[10px] font-bold", kinds[k].c)}>{kinds[k].l}</span>
                        <span className="min-w-0 flex-1 truncate text-sm font-semibold">{i.name}</span>
                        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                      </Link>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        ) : (
          <p className="px-4 py-12 text-center text-sm text-muted-foreground">No IPO dates reported for {MONTHS[m.mo]} {m.y}.</p>
        )}
      </div>
    </div>
  );
}
