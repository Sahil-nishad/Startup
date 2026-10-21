import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, CalendarDays, Search, SlidersHorizontal } from "lucide-react";
import { useIpos } from "@/lib/market/context";
import {
  gmpPct,
  inr,
  latestGmp,
  minInvestment,
  num,
  pct,
  shortDate,
  statusOf,
  subLabel,
  todayIso,
  type Ipo,
  type Status,
} from "@/lib/ipo-data";
import { Delta, StatusBadge } from "@/components/site";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "IPO Lens — IPO GMP, subscription and dates" },
      {
        name: "description",
        content: "Indian IPO price bands, GMP, subscription, lot size and key dates in one table.",
      },
    ],
  }),
  component: Home,
});

const filters = ["All", "Open", "Upcoming", "Closed", "Listed"] as const;
const boards = ["All", "Mainboard", "SME"] as const;
const exchanges = ["All", "NSE", "BSE"] as const;
const statusDot: Record<(typeof filters)[number], string> = {
  All: "bg-slate-400",
  Open: "bg-positive",
  Upcoming: "bg-warning",
  Closed: "bg-negative",
  Listed: "bg-sky-500",
};
const activeFilter: Record<(typeof filters)[number], string> = {
  All: "bg-foreground text-background shadow-sm",
  Open: "bg-positive-soft text-positive",
  Upcoming: "bg-warning-soft text-warning",
  Closed: "bg-negative/10 text-negative",
  Listed: "bg-sky-500/10 text-sky-500",
};
const rowSurface: Record<Status, string> = {
  Open: "bg-positive-soft/45 hover:bg-positive-soft/80",
  Upcoming: "bg-warning-soft/45 hover:bg-warning-soft/80",
  Closed: "bg-negative/5 hover:bg-negative/10",
  Listed: "bg-sky-500/5 hover:bg-sky-500/10",
  Withdrawn: "bg-muted/40 hover:bg-muted/70",
};
const rowBorder: Record<Status, string> = {
  Open: "border-l-positive",
  Upcoming: "border-l-warning",
  Closed: "border-l-negative",
  Listed: "border-l-sky-500",
  Withdrawn: "border-l-muted-foreground",
};
const isCurrentUpcoming = (ipo: Ipo, today: string) =>
  statusOf(ipo) === "Upcoming" && (!ipo.open || ipo.open >= today);
const compactSubscription = (ipo: Ipo) => {
  const basis = ipo.subscription?.overall?.basis;
  return basis === "exact" || basis === "lower_bound" ? subLabel(ipo) : "—";
};

function Home() {
  const ipos = useIpos();
  const [filter, setFilter] = useState<(typeof filters)[number]>("All");
  const [board, setBoard] = useState<(typeof boards)[number]>("All");
  const [exchange, setExchange] = useState<(typeof exchanges)[number]>("All");
  const [pageSize, setPageSize] = useState(50);
  const [query, setQuery] = useState("");
  const today = todayIso();
  const marketCounts = useMemo(
    () => ({
      Open: ipos.filter((ipo) => statusOf(ipo) === "Open").length,
      Upcoming: ipos.filter((ipo) => isCurrentUpcoming(ipo, today)).length,
      Closed: ipos.filter((ipo) => statusOf(ipo) === "Closed").length,
      Listed: ipos.filter((ipo) => statusOf(ipo) === "Listed").length,
      All: ipos.length,
    }),
    [ipos, today],
  );
  const scopedIpos = useMemo(
    () =>
      ipos
        .filter((ipo) => board === "All" || ipo.category === board)
        .filter((ipo) => exchange === "All" || ipo.exchange.includes(exchange))
        .filter((ipo) => (ipo.name + ipo.symbol).toLowerCase().includes(query.toLowerCase())),
    [board, exchange, ipos, query],
  );
  const statusCounts = useMemo(
    () => ({
      Open: scopedIpos.filter((ipo) => statusOf(ipo) === "Open").length,
      Upcoming: scopedIpos.filter((ipo) => isCurrentUpcoming(ipo, today)).length,
      Closed: scopedIpos.filter((ipo) => statusOf(ipo) === "Closed").length,
      Listed: scopedIpos.filter((ipo) => statusOf(ipo) === "Listed").length,
      All: scopedIpos.length,
    }),
    [scopedIpos, today],
  );
  const filteredRows = useMemo(
    () =>
      scopedIpos
        .filter(
          (ipo) =>
            filter === "All" ||
            (filter === "Upcoming" ? isCurrentUpcoming(ipo, today) : statusOf(ipo) === filter),
        )
        .sort((a, b) => {
          if (filter === "Open") return (a.close ?? "9999").localeCompare(b.close ?? "9999");
          if (filter === "Upcoming") return (a.open ?? "9999").localeCompare(b.open ?? "9999");
          if (filter === "All") {
            const priority: Record<Status, number> = {
              Open: 0,
              Upcoming: 1,
              Closed: 2,
              Listed: 3,
              Withdrawn: 4,
            };
            const byStatus = priority[statusOf(a)] - priority[statusOf(b)];
            if (byStatus) return byStatus;
          }
          return (b.open ?? "").localeCompare(a.open ?? "");
        }),
    [filter, scopedIpos, today],
  );
  const rows = filteredRows.slice(0, pageSize);
  const maxGmp = [...ipos]
    .filter(
      (ipo) => (statusOf(ipo) === "Open" || isCurrentUpcoming(ipo, today)) && gmpPct(ipo) !== null,
    )
    .sort((a, b) => (gmpPct(b) ?? -Infinity) - (gmpPct(a) ?? -Infinity))[0];
  const maxSub = [...ipos]
    .filter((ipo) => ipo.subscription?.total !== null && ipo.subscription?.total !== undefined)
    .sort((a, b) => (b.subscription?.total ?? 0) - (a.subscription?.total ?? 0))[0];
  const events = ipos
    .flatMap((ipo) => [
      { date: ipo.open, label: "OPEN", ipo },
      { date: ipo.close, label: "CLOSE", ipo },
      { date: ipo.allotment, label: "ALLOT", ipo },
      { date: ipo.listing, label: "LIST", ipo },
    ])
    .filter(
      (event): event is typeof event & { date: string } =>
        event.date !== null && event.date >= today,
    )
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 7);

  return (
    <div className="mx-auto max-w-[1440px] px-3 py-5 sm:px-5 lg:px-7">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Indian IPO market · {today}
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-[-0.055em] sm:text-5xl">The numbers.</h1>
        </div>
        <div className="grid grid-cols-3 overflow-hidden rounded-xl border bg-card">
          <MarketNumber label="Open" value={marketCounts.Open} />
          <MarketNumber label="Upcoming" value={marketCounts.Upcoming} />
          <MarketNumber label="Total" value={marketCounts.All} />
        </div>
      </header>

      <section className="market-board overflow-hidden rounded-2xl border bg-card">
        <div className="flex flex-col gap-3 border-b p-3 lg:flex-row lg:items-center lg:justify-between">
          <div
            role="tablist"
            aria-label="IPO status"
            className="flex gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {filters.map((item) => (
              <button
                key={item}
                role="tab"
                aria-selected={filter === item}
                onClick={() => setFilter(item)}
                className={cn(
                  "inline-flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-xs font-semibold transition-all",
                  filter === item
                    ? activeFilter[item]
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <span className={cn("h-2 w-2 rounded-full", statusDot[item])} />
                {item} <span className="ml-1 opacity-60">{statusCounts[item]}</span>
              </button>
            ))}
          </div>
          <div className="inline-flex self-start overflow-hidden rounded-lg border bg-background lg:self-auto">
            {boards.map((item) => (
              <button
                key={item}
                type="button"
                aria-pressed={board === item}
                onClick={() => setBoard(item)}
                className={cn(
                  "border-l px-3 py-2 text-xs font-semibold first:border-l-0",
                  board === item
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {item}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 border-b bg-muted/20 px-3 py-2">
          <label className="flex h-8 items-center gap-1.5 text-[11px] text-muted-foreground">
            Show
            <select
              aria-label="Rows per page"
              value={pageSize}
              onChange={(event) => setPageSize(Number(event.target.value))}
              className="h-8 rounded-lg border bg-background px-2 font-bold text-foreground outline-none"
            >
              {[25, 50, 100].map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
            entries
          </label>
          <span className="mx-1 hidden h-4 w-px bg-border sm:block" />
          <SlidersHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
          <MarketFilter
            label="Exchange"
            value={exchange}
            options={exchanges}
            onChange={(value) => setExchange(value as (typeof exchanges)[number])}
          />
          {(board !== "All" || exchange !== "All" || query) && (
            <button
              type="button"
              onClick={() => {
                setBoard("All");
                setExchange("All");
                setQuery("");
              }}
              className="px-2 py-1 text-[11px] font-semibold text-muted-foreground hover:text-foreground"
            >
              Clear
            </button>
          )}
          <span className="ml-auto text-[10px] font-medium text-muted-foreground">
            {filteredRows.length} matching IPOs
          </span>
          <label className="flex h-9 min-w-[13rem] items-center gap-2 rounded-lg border bg-background px-3 sm:w-64">
            <Search className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="sr-only">Search IPOs</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search company"
              className="min-w-0 flex-1 bg-transparent text-xs outline-none"
            />
          </label>
        </div>
        <MarketTable rows={rows} />
        <div className="flex items-center justify-between border-t px-4 py-3 text-xs text-muted-foreground">
          <span>
            Showing {rows.length} of {filteredRows.length} records
          </span>
          <Link
            to="/ipos"
            className="inline-flex items-center gap-1 font-semibold text-foreground hover:underline"
          >
            View all IPOs <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </section>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1fr_1.35fr]">
        <SignalCard
          title="Highest reported GMP"
          ipo={maxGmp}
          value={maxGmp ? pct(gmpPct(maxGmp)) : "—"}
          sub={maxGmp ? inr(latestGmp(maxGmp)) : "—"}
        />
        <SignalCard
          title="Highest exact subscription"
          ipo={maxSub}
          value={maxSub ? subLabel(maxSub) : "—"}
          sub="Total demand"
        />
        <section className="rounded-2xl border bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Next dates
            </h2>
            <Link to="/calendar" aria-label="IPO calendar">
              <CalendarDays className="h-4 w-4" />
            </Link>
          </div>
          <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            {events.map((event) => (
              <Link
                key={event.label + event.ipo.slug}
                to="/ipo/$slug"
                params={{ slug: event.ipo.slug }}
                className="group flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-muted"
              >
                <span className="num w-12 text-sm font-bold">{shortDate(event.date)}</span>
                <span className="w-10 text-[9px] font-bold tracking-wider text-muted-foreground">
                  {event.label}
                </span>
                <span className="min-w-0 flex-1 truncate text-xs font-semibold group-hover:underline">
                  {event.ipo.name}
                </span>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function MarketFilter({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex h-8 items-center gap-1.5 rounded-lg border bg-background px-2.5 text-[11px] shadow-sm">
      <span className="font-medium text-muted-foreground">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="bg-transparent font-bold text-foreground outline-none"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option === "All" ? `All ${label.toLowerCase()}s` : option}
          </option>
        ))}
      </select>
    </label>
  );
}

function MarketNumber({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-20 border-l px-4 py-2.5 first:border-l-0">
      <div className="num text-xl font-bold leading-none">{value}</div>
      <div className="mt-1 text-[9px] font-semibold uppercase tracking-widest text-muted-foreground">
        {label}
      </div>
    </div>
  );
}

function MarketTable({ rows }: { rows: Ipo[] }) {
  if (!rows.length)
    return <div className="p-16 text-center text-sm text-muted-foreground">No matching IPOs.</div>;
  return (
    <>
      <div className="divide-y md:hidden">
        {rows.map((ipo) => (
          <MobileMarketRow key={ipo.slug} ipo={ipo} />
        ))}
      </div>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[960px] text-sm">
          <thead>
            <tr className="border-b text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
              <th className="px-4 py-3 text-left">IPO</th>
              <th className="px-3 text-left">Status</th>
              <th className="px-3 text-right">Price</th>
              <th className="px-3 text-right">GMP</th>
              <th className="px-3 text-right">GMP %</th>
              <th className="px-3 text-right">Subscription</th>
              <th className="px-3 text-right">Lot</th>
              <th className="px-3 text-right">Min amount</th>
              <th className="px-4 text-right">Dates</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((ipo) => (
              <MarketRow key={ipo.slug} ipo={ipo} />
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function MobileMarketRow({ ipo }: { ipo: Ipo }) {
  const status = statusOf(ipo);
  return (
    <Link
      to="/ipo/$slug"
      params={{ slug: ipo.slug }}
      className={cn("block border-l-[3px] p-4", rowSurface[status], rowBorder[status])}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate font-bold tracking-tight">{ipo.name}</div>
          <div className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {ipo.category} · {shortDate(ipo.open)} → {shortDate(ipo.close)}
          </div>
        </div>
        <StatusBadge status={status} />
      </div>
      <div className="mt-4 grid grid-cols-4 gap-2">
        <MobileValue label="Price" value={`${inr(ipo.priceLow)}–${num(ipo.priceHigh)}`} />
        <MobileValue label="GMP" value={inr(latestGmp(ipo))} positive={(latestGmp(ipo) ?? 0) > 0} />
        <MobileValue label="GMP %" value={pct(gmpPct(ipo))} positive={(gmpPct(ipo) ?? 0) > 0} />
        <MobileValue label="Subs." value={compactSubscription(ipo)} />
      </div>
    </Link>
  );
}

function MobileValue({
  label,
  value,
  positive,
}: {
  label: string;
  value: string;
  positive?: boolean;
}) {
  return (
    <div className="min-w-0">
      <div className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className={cn("num mt-1 truncate text-sm font-bold", positive && "text-positive")}>
        {value}
      </div>
    </div>
  );
}

function MarketRow({ ipo }: { ipo: Ipo }) {
  const quality = ipo.gmp?.disputed || ipo.gmp?.quality === "review" ? "review" : ipo.gmp?.quality;
  const status = statusOf(ipo);
  return (
    <tr className={cn("group transition-colors", rowSurface[status])}>
      <td className={cn("border-l-[3px] px-4 py-3", rowBorder[status])}>
        <Link to="/ipo/$slug" params={{ slug: ipo.slug }} className="block max-w-[280px]">
          <span className="block truncate font-bold tracking-tight group-hover:underline">
            {ipo.name}
          </span>
          <span className="mt-0.5 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {ipo.category} · {ipo.exchange || "—"}
          </span>
        </Link>
      </td>
      <td className="px-3">
        <StatusBadge status={status} />
      </td>
      <td className="num px-3 text-right font-semibold">
        {inr(ipo.priceLow)}–{num(ipo.priceHigh)}
      </td>
      <td className="px-3 text-right">
        <span className="inline-flex items-center gap-1.5">
          <span
            title={quality ?? "not reported"}
            className={cn(
              "h-1.5 w-1.5 rounded-full",
              quality === "recent"
                ? "bg-positive"
                : quality === "review"
                  ? "bg-negative"
                  : "bg-warning",
            )}
          />
          <Delta value={latestGmp(ipo)}>{inr(latestGmp(ipo))}</Delta>
        </span>
      </td>
      <td className="num px-3 text-right font-bold">{pct(gmpPct(ipo))}</td>
      <td className="num px-3 text-right font-bold">{compactSubscription(ipo)}</td>
      <td className="num px-3 text-right">{num(ipo.lot)}</td>
      <td className="num px-3 text-right">{inr(minInvestment(ipo))}</td>
      <td className="num whitespace-nowrap px-4 text-right text-xs">
        <span className="font-semibold">{shortDate(ipo.open)}</span>
        <span className="mx-1 text-muted-foreground">→</span>
        <span>{shortDate(ipo.close)}</span>
      </td>
    </tr>
  );
}

function SignalCard({
  title,
  ipo,
  value,
  sub,
}: {
  title: string;
  ipo: Ipo | undefined;
  value: string;
  sub: string;
}) {
  return (
    <section className="rounded-2xl border bg-card p-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {title}
      </p>
      <div className="mt-4 flex items-end justify-between gap-3">
        <div>
          <div className="num text-4xl font-bold tracking-[-0.05em]">{value}</div>
          <div className="num mt-1 text-xs text-muted-foreground">{sub}</div>
        </div>
        {ipo && (
          <Link
            to="/ipo/$slug"
            params={{ slug: ipo.slug }}
            className="max-w-[55%] truncate text-right text-xs font-semibold hover:underline"
          >
            {ipo.name}
          </Link>
        )}
      </div>
    </section>
  );
}
