import { useIpos } from "@/lib/market/context";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Search, SlidersHorizontal, Star, X } from "lucide-react";
import { gmpPct, statusOf } from "@/lib/ipo-data";
import { IpoTable, sortFns, type SortKey } from "@/components/ipo-table";
import { PageHead, Panel } from "@/components/site";
import { MarketSelect } from "@/components/market-select";
import { useWatchlist } from "@/lib/ipo-lists";
import { useState } from "react";
import { cn } from "@/lib/utils";

type U<T> = T | undefined;
type S = {
  q?: U<string>;
  status?: U<string>;
  category?: U<string>;
  exchange?: U<string>;
  sort?: U<SortKey>;
  dir?: U<"asc" | "desc">;
  page?: U<number>;
  size?: U<number>;
  sector?: U<string>;
  gmpMin?: U<number>;
  gmpMax?: U<number>;
  subMin?: U<number>;
  sizeMin?: U<number>;
  sizeMax?: U<number>;
  financials?: U<"verified" | "profitable">;
  freshness?: U<"fresh" | "review">;
  watchlist?: U<true>;
};

const finite = (value: unknown) => {
  if (value === "" || value === null || value === undefined) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

export const Route = createFileRoute("/ipos")({
  validateSearch: (raw: Record<string, unknown>): S => {
    const s = raw as {
      q?: unknown;
      status?: unknown;
      category?: unknown;
      exchange?: unknown;
      sort?: unknown;
      dir?: unknown;
      page?: unknown;
      size?: unknown;
      sector?: unknown;
      gmpMin?: unknown;
      gmpMax?: unknown;
      subMin?: unknown;
      sizeMin?: unknown;
      sizeMax?: unknown;
      financials?: unknown;
      freshness?: unknown;
      watchlist?: unknown;
    };
    return {
      q: typeof s.q === "string" ? s.q : undefined,
      status: typeof s.status === "string" ? s.status : undefined,
      category: typeof s.category === "string" ? s.category : undefined,
      exchange: typeof s.exchange === "string" ? s.exchange : undefined,
      sort: typeof s.sort === "string" && s.sort in sortFns ? (s.sort as SortKey) : undefined,
      dir: s.dir === "asc" ? "asc" : s.dir === "desc" ? "desc" : undefined,
      page: Number(s.page) > 0 ? Number(s.page) : undefined,
      size: [10, 25, 50].includes(Number(s.size)) ? Number(s.size) : undefined,
      sector: typeof s.sector === "string" ? s.sector : undefined,
      gmpMin: finite(s.gmpMin),
      gmpMax: finite(s.gmpMax),
      subMin: finite(s.subMin),
      sizeMin: finite(s.sizeMin),
      sizeMax: finite(s.sizeMax),
      financials:
        s.financials === "verified" || s.financials === "profitable" ? s.financials : undefined,
      freshness: s.freshness === "fresh" || s.freshness === "review" ? s.freshness : undefined,
      watchlist: s.watchlist === true || s.watchlist === "true" ? true : undefined,
    };
  },
  head: () => ({
    meta: [
      { title: "All IPOs — Mainboard & SME | IPO Lens" },
      {
        name: "description",
        content:
          "Filter and sort every Indian IPO by status, category, exchange, GMP and subscription.",
      },
      { property: "og:title", content: "All IPOs | IPO Lens" },
      {
        property: "og:description",
        content: "Searchable, sortable table of Indian Mainboard and SME IPOs.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: IposPage,
});

function IposPage() {
  const ipos = useIpos();
  const s = Route.useSearch();
  const navigate = useNavigate({ from: "/ipos" });
  const watchlist = useWatchlist();
  const [advancedOpen, setAdvancedOpen] = useState(
    Boolean(
      s.sector ||
        s.gmpMin !== undefined ||
        s.gmpMax !== undefined ||
        s.subMin !== undefined ||
        s.sizeMin !== undefined ||
        s.sizeMax !== undefined ||
        s.financials ||
        s.freshness,
    ),
  );
  const set = (patch: Partial<S>) =>
    navigate({ search: (p) => ({ ...p, page: undefined, ...patch }), replace: true });
  const sort = s.sort ?? "open";
  const dir = s.dir ?? "desc";
  const size = s.size ?? 10;
  const page = s.page ?? 1;

  const sectors = [...new Set(ipos.map((ipo) => ipo.sector).filter((sector) => sector && sector !== "Unavailable"))].sort();
  let rows = ipos.filter((i) => {
    const searchText = [i.name, i.symbol, i.sector, i.registrar, i.leadManager].join(" ").toLowerCase();
    const gmp = gmpPct(i);
    const subscription = i.subscription?.total;
    const issueSize = i.issueSizeCr;
    const latestFinancial = [...i.financials].sort((a, b) => a.year.localeCompare(b.year)).at(-1);
    return (
      (!s.q || searchText.includes(s.q.toLowerCase())) &&
      (!s.status || statusOf(i) === s.status) &&
      (!s.category || i.category === s.category) &&
      (!s.exchange || i.exchange.includes(s.exchange)) &&
      (!s.sector || i.sector === s.sector) &&
      (s.gmpMin === undefined || (gmp !== null && gmp >= s.gmpMin)) &&
      (s.gmpMax === undefined || (gmp !== null && gmp <= s.gmpMax)) &&
      (s.subMin === undefined || (subscription !== null && subscription !== undefined && subscription >= s.subMin)) &&
      (s.sizeMin === undefined || (issueSize !== null && issueSize >= s.sizeMin)) &&
      (s.sizeMax === undefined || (issueSize !== null && issueSize <= s.sizeMax)) &&
      (!s.financials ||
        (s.financials === "verified" && i.financials.length > 0) ||
        (s.financials === "profitable" && latestFinancial?.profit !== null && (latestFinancial?.profit ?? 0) > 0)) &&
      (!s.freshness ||
        (s.freshness === "fresh" && i.gmp?.quality === "recent" && !i.gmp.disputed) ||
        (s.freshness === "review" && (i.review || i.gmp?.disputed || i.gmp?.quality === "review"))) &&
      (!s.watchlist || watchlist.includes(i.slug))
    );
  });
  rows = [...rows].sort((a, b) => (dir === "asc" ? 1 : -1) * sortFns[sort](a, b));
  const pages = Math.max(1, Math.ceil(rows.length / size));
  const shown = rows.slice((page - 1) * size, page * size);
  const active = !!(
    s.q ||
    s.status ||
    s.category ||
    s.exchange ||
    s.sector ||
    s.gmpMin !== undefined ||
    s.gmpMax !== undefined ||
    s.subMin !== undefined ||
    s.sizeMin !== undefined ||
    s.sizeMax !== undefined ||
    s.financials ||
    s.freshness ||
    s.watchlist
  );
  const advancedCount = [
    s.sector,
    s.gmpMin,
    s.gmpMax,
    s.subMin,
    s.sizeMin,
    s.sizeMax,
    s.financials,
    s.freshness,
  ].filter((value) => value !== undefined).length;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <PageHead
        title="IPOs"
        desc="Every Mainboard and SME issue with price band, GMP, subscription and key dates."
      />
      <Panel>
        <div className="flex flex-wrap items-center gap-2 border-b p-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <input
              defaultValue={s.q}
              onChange={(e) => set({ q: e.target.value || undefined })}
              placeholder="Search company or symbol"
              className="h-9 w-60 rounded-md border bg-card pl-8 pr-2 text-sm outline-none focus:border-primary"
            />
          </div>
          <IpoFilterSelect label="Status" value={s.status} options={["Open", "Upcoming", "Closed", "Listed"]} onChange={(value) => set({ status: value })} />
          <IpoFilterSelect label="Category" value={s.category} options={["Mainboard", "SME", "Debt"]} onChange={(value) => set({ category: value })} />
          <IpoFilterSelect label="Exchange" value={s.exchange} options={["NSE", "BSE"]} onChange={(value) => set({ exchange: value })} />
          <button
            type="button"
            aria-pressed={s.watchlist === true}
            onClick={() => set({ watchlist: s.watchlist ? undefined : true })}
            className={cn(
              "inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-sm font-medium",
              s.watchlist === true ? "border-warning/40 bg-warning-soft text-warning" : "bg-card text-muted-foreground",
            )}
          >
            <Star className={cn("h-3.5 w-3.5", s.watchlist === true && "fill-current")} />
            Watchlist {watchlist.slugs.length ? `(${watchlist.slugs.length})` : ""}
          </button>
          <button
            type="button"
            aria-expanded={advancedOpen}
            onClick={() => setAdvancedOpen((open) => !open)}
            className={cn(
              "inline-flex h-9 items-center gap-1.5 rounded-md border bg-card px-3 text-sm font-medium",
              advancedCount ? "border-primary text-primary" : "text-muted-foreground",
            )}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Advanced {advancedCount ? `(${advancedCount})` : ""}
          </button>
          {active && (
            <button
              onClick={() => navigate({ search: {}, replace: true })}
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
              Clear filters
            </button>
          )}
          <span className="num ml-auto text-xs text-muted-foreground">{rows.length} IPOs</span>
        </div>
        {advancedOpen && (
          <div className="grid gap-3 border-b bg-muted/20 p-3 sm:grid-cols-2 lg:grid-cols-4">
            <IpoFilterSelect label="Sector" value={s.sector} options={sectors} onChange={(value) => set({ sector: value })} />
            <IpoFilterSelect label="Financials" value={s.financials} options={["verified", "profitable"]} onChange={(value) => set({ financials: value as S["financials"] })} />
            <IpoFilterSelect label="Data quality" value={s.freshness} options={["fresh", "review"]} onChange={(value) => set({ freshness: value as S["freshness"] })} />
            <NumberFilter label="Min GMP %" value={s.gmpMin} onChange={(value) => set({ gmpMin: value })} />
            <NumberFilter label="Max GMP %" value={s.gmpMax} onChange={(value) => set({ gmpMax: value })} />
            <NumberFilter label="Min subscription ×" value={s.subMin} onChange={(value) => set({ subMin: value })} />
            <NumberFilter label="Min issue size ₹ Cr" value={s.sizeMin} onChange={(value) => set({ sizeMin: value })} />
            <NumberFilter label="Max issue size ₹ Cr" value={s.sizeMax} onChange={(value) => set({ sizeMax: value })} />
          </div>
        )}
        <IpoTable
          rows={shown}
          sort={sort}
          dir={dir}
          onSort={(k) => set({ sort: k, dir: sort === k && dir === "desc" ? "asc" : "desc" })}
        />
        <div className="flex items-center justify-between border-t px-3 py-2 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            Rows
            <MarketSelect
              label="Rows per page"
              value={String(size)}
              onValueChange={(value) => set({ size: Number(value) })}
              options={[10, 25, 50].map((n) => ({ value: String(n), label: String(n) }))}
              className="h-8 min-w-16 rounded-lg px-2"
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              disabled={page <= 1}
              onClick={() => navigate({ search: (p) => ({ ...p, page: page - 1 }) })}
              className="rounded-md border px-2.5 py-1 disabled:opacity-40"
            >
              Prev
            </button>
            <span className="num text-muted-foreground">
              {page} / {pages}
            </span>
            <button
              disabled={page >= pages}
              onClick={() => navigate({ search: (p) => ({ ...p, page: page + 1 }) })}
              className="rounded-md border px-2.5 py-1 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </Panel>
    </div>
  );
}

function IpoFilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string | undefined;
  options: readonly string[];
  onChange: (value: string | undefined) => void;
}) {
  return (
    <MarketSelect
      label={label}
      prefix={label}
      value={value ?? "__all__"}
      onValueChange={(next) => onChange(next === "__all__" ? undefined : next)}
      options={[
        { value: "__all__", label: "All" },
        ...options.map((option) => ({ value: option, label: option })),
      ]}
      className="max-w-[16rem] text-xs"
      active={value !== undefined}
    />
  );
}

function NumberFilter({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | undefined;
  onChange: (value: number | undefined) => void;
}) {
  return (
    <label className="space-y-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
      {label}
      <input
        type="number"
        step="any"
        value={value ?? ""}
        onChange={(event) => onChange(finite(event.target.value))}
        className="mt-1 h-9 w-full rounded-md border bg-card px-3 text-sm font-medium normal-case tracking-normal text-foreground outline-none focus:border-primary"
      />
    </label>
  );
}
