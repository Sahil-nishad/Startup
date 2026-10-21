import { useIpos } from "@/lib/market/context";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { MONTHS, todayIso } from "@/lib/ipo-data";
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

function Cal() {
  const ipos = useIpos("/api/calendar");
  const now = new Date();
  const [m, setM] = useState({ y: now.getFullYear(), mo: now.getMonth() });
  const first = new Date(m.y, m.mo, 1);
  const startPad = (first.getDay() + 6) % 7;
  const daysIn = new Date(m.y, m.mo + 1, 0).getDate();
  const t = todayIso();
  const iso = (day: number) =>
    `${m.y}-${String(m.mo + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const ev = (date: string) =>
    ipos.flatMap((i) =>
      (Object.keys(kinds) as (keyof typeof kinds)[])
        .filter((k) => i[k] === date)
        .map((k) => ({ k, i })),
    );
  const move = (n: number) =>
    setM(({ y, mo }) => {
      const d = new Date(y, mo + n, 1);
      return { y: d.getFullYear(), mo: d.getMonth() };
    });
  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <PageHead
        title="IPO calendar"
        desc="Dates are in IST. Bidding typically closes at 5 PM on the final day."
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
      <div className="mb-3 flex flex-wrap gap-2 text-xs">
        {Object.values(kinds).map((k) => (
          <span key={k.l} className={cn("rounded px-1.5 py-0.5 font-medium", k.c)}>
            {k.l}
          </span>
        ))}
      </div>
      <div className="overflow-x-auto">
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
                  {ev(date).map(({ k, i }) => (
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
    </div>
  );
}
