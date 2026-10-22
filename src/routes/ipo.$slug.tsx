import { InvestmentCalculator } from "@/components/market-tools";
import { subscriptionLabel } from "@/lib/market/rules";
import { num, subLabel } from "@/lib/ipo-data";
import { getIpo } from "@/lib/market/server-functions";
import { DataQualityPanel, IssueNote, ObservationNote } from "@/components/data-quality";
import { WatchlistButton } from "@/components/ipo-actions";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ExternalLink,
  FileCheck2,
  FileText,
  TrendingUp,
  TrendingDown,
  Activity,
  Flame,
  Snowflake,
  Gauge,
} from "lucide-react";
import {
  cr,
  estListing,
  fmtDate,
  gmpPct,
  inr,
  latestGmp,
  minInvestment,
  pct,
  shortDate,
  statusOf,
  todayIso,
  type Ipo,
} from "@/lib/ipo-data";
import { CatBadge, Delta, Initials, Panel, StatusBadge } from "@/components/site";
import { GmpChart } from "@/components/gmp-chart";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/ipo/$slug")({
  loader: async ({ params }) => {
    const ipo = await getIpo({ data: { slug: params.slug } });
    if (!ipo) throw notFound();
    return { ipo };
  },
  head: ({ loaderData }) => {
    const n = loaderData?.ipo.name;
    const t = n ? `${n} IPO — GMP, subscription & dates | IPO Lens` : "IPO not found | IPO Lens";
    const d = n
      ? `${n} IPO price band, lot size, GMP trend, subscription status, financials and key dates.`
      : "This IPO could not be found.";
    return {
      meta: [
        { title: t },
        { name: "description", content: d },
        { property: "og:title", content: t },
        { property: "og:description", content: d },
        { property: "og:type", content: "article" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  notFoundComponent: () => (
    <div className="mx-auto max-w-xl p-16 text-center">
      <h1 className="text-xl font-semibold">IPO not found</h1>
      <Link to="/ipos" className="mt-4 inline-block text-primary underline">
        Browse all IPOs
      </Link>
    </div>
  ),
  component: Detail,
});

const tabs = ["Overview", "GMP history", "Subscription", "Financials", "Documents"] as const;

function Detail() {
  const { ipo } = Route.useLoaderData();
  const [tab, setTab] = useState<(typeof tabs)[number]>("Overview");
  const g = latestGmp(ipo);
  const metrics: [string, string][] = [
    ["Price band", `${inr(ipo.priceLow)} – ${inr(ipo.priceHigh)}`],
    ["Lot size", ipo.lot === null ? "Unavailable" : `${num(ipo.lot)} shares`],
    ["Min. investment", inr(minInvestment(ipo))],
    ["Issue size", cr(ipo.issueSizeCr)],
    ["Fresh issue", cr(ipo.freshCr)],
    ["Offer for sale", ipo.ofsCr ? cr(ipo.ofsCr) : "—"],
    ["Est. listing", inr(estListing(ipo))],
    ["Subscription", subLabel(ipo)],
  ];
  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <nav className="mb-4 text-xs text-muted-foreground">
        <Link to="/ipos" className="hover:underline">
          IPOs
        </Link>{" "}
        / {ipo.name}
      </nav>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Initials name={ipo.name} />
          <div>
            <h1 className="text-3xl font-bold tracking-[-0.04em]">{ipo.name} IPO</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <StatusBadge status={statusOf(ipo)} />
              <CatBadge ipo={ipo} />
              {ipo.exchange} · {ipo.sector} · {fmtDate(ipo.open)} – {fmtDate(ipo.close)}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <WatchlistButton ipo={ipo} />
          <div className="rounded-xl border bg-card px-4 py-3 text-right">
            <div className="text-xs text-muted-foreground">Unofficial GMP</div>
            <div className="text-2xl">
              <Delta value={g}>{inr(g)}</Delta>{" "}
              <span className="num text-sm text-muted-foreground">({pct(gmpPct(ipo))})</span>
            </div>
          </div>
        </div>
      </div>
      <IssueNote ipo={ipo} />
      <ObservationNote value={ipo.gmp} />
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-4">
        {metrics.map(([k, v]) => (
          <div key={k} className="bg-card p-3">
            <div className="text-xs text-muted-foreground">{k}</div>
            <div className="num mt-0.5 font-semibold">{v}</div>
          </div>
        ))}
      </div>
      <div className="mt-4">
        <DataQualityPanel ipo={ipo} />
      </div>

      <div
        role="tablist"
        className="mt-6 flex gap-1 overflow-x-auto border-b [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {tabs.map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm",
              tab === t
                ? "border-primary font-semibold text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t}
          </button>
        ))}
      </div>
      <div className="mt-6">
        {tab === "Overview" && <Overview ipo={ipo} />}
        {tab === "GMP history" && (
          <div className="space-y-5">
            <Panel title="Reported GMP history">
              <div className="p-4">
                <GmpChart ipo={ipo} height={280} />
              </div>
              <p className="border-t px-4 py-2 text-xs text-muted-foreground">
                GMP is unofficial and unregulated. It is not a reliable predictor of listing price.
              </p>
            </Panel>
            <Analysis ipo={ipo} />
          </div>
        )}
        {tab === "Subscription" && <SubPanel ipo={ipo} />}
        {tab === "Financials" && <Financials ipo={ipo} />}
        {tab === "Documents" && <DocumentCenter ipo={ipo} />}
      </div>
    </div>
  );
}

function Overview({ ipo }: { ipo: Ipo }) {
  const tl: [string, string | null][] = [
    ["Opens", ipo.open],
    ["Closes", ipo.close],
    ["Allotment", ipo.allotment],
    ["Listing", ipo.listing],
  ];
  const history = ipo.gmpHistory.filter((point) => !point.disputed && point.quality !== "review");
  const currentGmp = latestGmp(ipo);
  const currentGmpPct = gmpPct(ipo);
  const firstGmp = history[0]?.gmp ?? currentGmp;
  const momentum =
    currentGmp !== null && firstGmp !== null && history.length > 1 ? currentGmp - firstGmp : null;
  const peak = history.length ? Math.max(...history.map((point) => point.gmp)) : currentGmp;
  const sentiment =
    currentGmpPct === null
      ? { label: "Unavailable", hint: "Waiting for a valid price and GMP", tone: "flat" as const }
      : currentGmpPct >= 15
        ? {
            label: "Strong positive",
            hint: `${pct(currentGmpPct)} of the upper band`,
            tone: "up" as const,
          }
        : currentGmpPct >= 5
          ? {
              label: "Positive",
              hint: `${pct(currentGmpPct)} of the upper band`,
              tone: "up" as const,
            }
          : currentGmpPct > 0
            ? {
                label: "Mild positive",
                hint: `${pct(currentGmpPct)} of the upper band`,
                tone: "up" as const,
              }
            : currentGmpPct < 0
              ? {
                  label: "Negative",
                  hint: `${pct(currentGmpPct)} of the upper band`,
                  tone: "down" as const,
                }
              : { label: "Flat", hint: "No reported premium", tone: "flat" as const };
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          icon={Gauge}
          label="Market sentiment"
          value={sentiment.label}
          hint={`${sentiment.hint} · rule based`}
          tone={sentiment.tone}
        />
        <StatCard
          icon={currentGmp !== null && currentGmp >= 0 ? TrendingUp : TrendingDown}
          label="Latest reported GMP"
          value={inr(currentGmp)}
          hint={
            ipo.gmp?.observedAt
              ? `Observed ${shortDate(ipo.gmp.observedAt)}`
              : "Source time unavailable"
          }
          tone={currentGmp === null ? "flat" : currentGmp >= 0 ? "up" : "down"}
        />
        <StatCard
          icon={Activity}
          label="Subscription demand"
          value={subLabel(ipo)}
          hint={
            ipo.subscription?.overall?.final ? "Final reported demand" : "Latest reported demand"
          }
        />
        <StatCard
          icon={Activity}
          label="Verified financial history"
          value={ipo.financials.length ? `${ipo.financials.length} periods` : "Unavailable"}
          hint={ipo.financials.length ? "From reviewed disclosures" : "No verified filing data yet"}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
        <Panel
          title="GMP history & momentum"
          action={<span className="text-[10px] text-muted-foreground">Unofficial market data</span>}
        >
          <div className="p-4">
            <GmpChart ipo={ipo} height={230} />
          </div>
          <dl className="grid grid-cols-3 border-t text-center">
            <MiniMetric label="Peak GMP" value={inr(peak)} />
            <MiniMetric
              label="Since first report"
              value={momentum === null ? "—" : signedMoney(momentum)}
            />
            <MiniMetric label="Observations" value={num(history.length || (ipo.gmp ? 1 : 0))} />
          </dl>
        </Panel>
        <DemandSummary ipo={ipo} />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <Panel title="IPO details">
          <dl className="grid grid-cols-2 divide-x divide-y text-sm sm:grid-cols-3">
            {[
              ["Board", ipo.category],
              ["Exchange", ipo.exchange],
              ["Sector", ipo.sector],
              ["Registrar", ipo.registrar],
              ["Lead manager", ipo.leadManager],
              ["Symbol", ipo.symbol || "—"],
            ].map(([label, value]) => (
              <div key={label} className="min-w-0 p-4">
                <dt className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {label}
                </dt>
                <dd className="mt-1 truncate font-semibold" title={value}>
                  {value}
                </dd>
              </div>
            ))}
          </dl>
          {ipo.about !== "Company disclosure has not been verified yet." && (
            <p className="border-t p-4 text-sm leading-relaxed text-muted-foreground">
              {ipo.about}
            </p>
          )}
        </Panel>
        <Panel title="Timeline (IST)">
          <ol className="p-4">
            {tl.map(([k, v], i) => {
              const done = v !== null && v <= todayIso();
              return (
                <li key={k} className="relative flex gap-3 pb-4 last:pb-0">
                  {i < tl.length - 1 && (
                    <span className="absolute left-[5px] top-3 h-full w-px bg-border" />
                  )}
                  <span
                    className={cn(
                      "relative mt-1 h-[11px] w-[11px] rounded-full border-2",
                      done ? "border-primary bg-primary" : "border-border bg-card",
                    )}
                  />
                  <div>
                    <div className="text-sm font-medium">{k}</div>
                    <div className="num text-xs text-muted-foreground">{fmtDate(v)}</div>
                  </div>
                </li>
              );
            })}
          </ol>
        </Panel>
      </div>

      <FinancialSnapshot ipo={ipo} />
      <InvestmentCalculator ipo={ipo} />
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-l p-3 first:border-l-0">
      <dt className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </dt>
      <dd className="num mt-1 font-bold">{value}</dd>
    </div>
  );
}

function signedMoney(value: number) {
  if (value === 0) return "₹0";
  return `${value > 0 ? "+" : "−"}₹${num(Math.abs(value))}`;
}

function shares(value: string | null) {
  if (!value) return "—";
  try {
    return BigInt(value).toLocaleString("en-IN");
  } catch {
    return num(Number(value));
  }
}

function categoryName(value: string) {
  return (
    (
      {
        TOTAL: "Total",
        QIB: "Institutional (QIB)",
        NII: "Non-institutional (NII)",
        RETAIL: "Retail",
        EMPLOYEE: "Employee",
      } as Record<string, string>
    )[value] ?? value
  );
}

function DemandSummary({ ipo }: { ipo: Ipo }) {
  const observations = ipo.subscription?.observations ?? [];
  return (
    <Panel
      title="Reservation & application demand"
      action={
        <span className="num text-xs font-bold">
          {ipo.subscription?.overall ? subscriptionLabel(ipo.subscription.overall) : "—"}
        </span>
      }
    >
      {observations.length ? (
        <>
          <div className="divide-y">
            {observations.slice(0, 6).map((value) => (
              <div key={value.category} className="grid grid-cols-[1fr_auto] gap-3 px-4 py-3">
                <div className="min-w-0">
                  <div className="text-xs font-bold">{categoryName(value.category)}</div>
                  <div className="mt-1 text-[10px] text-muted-foreground">
                    Reserved/offered {shares(value.sharesOffered)} · bids {shares(value.sharesBid)}
                  </div>
                </div>
                <div className="num text-right text-sm font-bold">
                  {value.disputed ? "Review" : subscriptionLabel(value)}
                  <div className="mt-1 text-[9px] font-medium uppercase tracking-wider text-muted-foreground">
                    {value.final ? "Final" : "Latest"}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="border-t px-4 py-2">
            <ObservationNote value={ipo.subscription?.overall ?? null} />
          </div>
        </>
      ) : (
        <div className="p-6">
          <div className="text-sm font-semibold">Demand data has not been reported yet</div>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Category reservations, bid shares and subscription multiples appear here when the
            configured source publishes them. No application count is inferred from share bids.
          </p>
        </div>
      )}
    </Panel>
  );
}

function FinancialSnapshot({ ipo }: { ipo: Ipo }) {
  if (!ipo.financials.length)
    return (
      <Panel title="Company financial dashboard">
        <div className="flex flex-wrap items-center justify-between gap-4 p-5">
          <div>
            <div className="font-semibold">Verified financial statements are unavailable</div>
            <p className="mt-1 max-w-2xl text-xs leading-5 text-muted-foreground">
              Revenue, profit, net worth and borrowings stay hidden until supported by a reviewed
              offer document or filing.
            </p>
          </div>
          <span className="rounded-lg border px-3 py-2 text-xs font-semibold text-muted-foreground">
            0 verified periods
          </span>
        </div>
      </Panel>
    );
  const periods = [...ipo.financials].sort((a, b) => a.year.localeCompare(b.year));
  const latest = periods.at(-1)!;
  const chart = periods.map((period) => ({
    year: period.year,
    revenue: period.revenue,
    profit: period.profit,
  }));
  return (
    <Panel
      title="Company financial dashboard"
      action={<span className="text-[10px] text-positive">Verified disclosure data</span>}
    >
      <div className="grid lg:grid-cols-[1fr_1fr]">
        <div className="h-64 p-4">
          <ResponsiveContainer>
            <BarChart data={chart}>
              <CartesianGrid stroke="var(--border)" vertical={false} />
              <XAxis dataKey="year" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip
                formatter={(value: number) => [`₹${num(value)} Cr`]}
                contentStyle={{ borderRadius: 8, border: "1px solid var(--border)", fontSize: 12 }}
              />
              <Bar dataKey="revenue" name="Revenue" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="profit" name="Profit" fill="var(--positive)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <dl className="grid grid-cols-2 border-t lg:border-l lg:border-t-0">
          <FinancialMetric label="Latest period" value={latest.year} />
          <FinancialMetric label="Revenue" value={cr(latest.revenue)} />
          <FinancialMetric label="Profit after tax" value={cr(latest.profit)} />
          <FinancialMetric label="Net worth" value={cr(latest.netWorth)} />
          <FinancialMetric label="Borrowings" value={cr(latest.borrowings)} />
          <FinancialMetric
            label="PAT margin"
            value={
              latest.revenue && latest.profit !== null
                ? pct((latest.profit / latest.revenue) * 100)
                : "—"
            }
          />
        </dl>
      </div>
    </Panel>
  );
}

function FinancialMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-l-0 p-4 odd:border-r">
      <dt className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </dt>
      <dd className="num mt-1 font-bold">{value}</dd>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: typeof Activity;
  label: string;
  value: string;
  hint?: string;
  tone?: "up" | "down" | "flat";
}) {
  return (
    <div className="card-premium animate-fade-up rounded-xl border bg-card p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon
          className={cn(
            "h-3.5 w-3.5",
            tone === "up" && "text-positive",
            tone === "down" && "text-negative",
          )}
        />
        {label}
      </div>
      <div
        className={cn(
          "num mt-1.5 text-xl font-semibold",
          tone === "up" && "text-positive",
          tone === "down" && "text-negative",
        )}
      >
        {value}
      </div>
      {hint && <div className="mt-0.5 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

function Analysis({ ipo }: { ipo: Ipo }) {
  const hist = ipo.gmpHistory.length
    ? ipo.gmpHistory
    : ipo.gmp && !ipo.gmp.disputed && ipo.gmp.quality !== "review"
      ? [ipo.gmp]
      : [];
  const g = latestGmp(ipo);
  if (
    !hist.length ||
    g === null ||
    ipo.priceHigh === null ||
    ipo.priceHigh <= 0 ||
    ipo.gmp?.disputed ||
    ipo.gmp?.quality === "review"
  )
    return (
      <Panel>
        <p className="p-6 text-sm text-muted-foreground">
          Analysis unavailable until valid GMP history and a price band are reported.
        </p>
      </Panel>
    );
  const first = hist[0]?.gmp ?? 0;
  const peak = Math.max(...hist.map((p) => p.gmp));
  const trough = Math.min(...hist.map((p) => p.gmp));
  const avg = hist.reduce((a, p) => a + p.gmp, 0) / hist.length;
  const changes = hist
    .slice(1)
    .map((p, i) => ({ label: shortDate(p.date), chg: p.gmp - (hist[i]?.gmp ?? p.gmp) }));
  const momentum = g - first;
  const gmpToPrice = gmpPct(ipo)!;
  const upside = ((estListing(ipo)! - ipo.priceHigh) / ipo.priceHigh) * 100;
  const rating =
    gmpToPrice >= 15
      ? {
          label: "Strong positive GMP signal",
          icon: Flame,
          tone: "up" as const,
          note: "The latest reported GMP is at least 15% of the upper price band.",
        }
      : gmpToPrice >= 5
        ? {
            label: "Positive GMP signal",
            icon: Gauge,
            tone: "flat" as const,
            note: "The latest reported GMP is between 5% and 15% of the upper price band.",
          }
        : {
            label: gmpToPrice < 0 ? "Negative GMP signal" : "Muted GMP signal",
            icon: Snowflake,
            tone: "down" as const,
            note:
              gmpToPrice < 0
                ? "The latest reported GMP is below zero."
                : "The latest reported GMP is below 5% of the upper price band.",
          };
  const RatingIcon = rating.icon;
  const gfmt = (v: number) => (v < 0 ? `-₹${Math.abs(Math.round(v))}` : `+₹${Math.round(v)}`);
  const moves = [
    { k: "Session change", v: changes.length ? changes[changes.length - 1]!.chg : 0 },
    { k: "Since first report", v: momentum },
    { k: "Peak to now", v: g - peak },
  ];
  return (
    <div className="space-y-6">
      <div className="card-premium animate-fade-up flex flex-wrap items-center gap-4 rounded-xl border bg-card p-5">
        <span
          className={cn(
            "flex h-12 w-12 items-center justify-center rounded-full",
            rating.tone === "up"
              ? "bg-positive/15 text-positive"
              : rating.tone === "down"
                ? "bg-negative/15 text-negative"
                : "bg-muted text-muted-foreground",
          )}
        >
          <RatingIcon className="h-6 w-6" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-lg font-semibold">{rating.label}</div>
          <p className="text-sm text-muted-foreground">{rating.note}</p>
        </div>
        <div className="text-right">
          <div className="text-xs text-muted-foreground">GMP as % of cap price</div>
          <div className="num text-2xl font-semibold">{gmpToPrice.toFixed(1)}%</div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard
          icon={momentum >= 0 ? TrendingUp : TrendingDown}
          label="Overall momentum"
          value={gfmt(momentum)}
          tone={momentum > 0 ? "up" : momentum < 0 ? "down" : "flat"}
          hint="First report to latest"
        />
        <StatCard icon={TrendingUp} label="Peak GMP" value={`₹${peak}`} hint="Highest reported" />
        <StatCard
          icon={TrendingDown}
          label="Lowest GMP"
          value={`₹${trough}`}
          hint="Lowest reported"
        />
        <StatCard
          icon={Activity}
          label="Average GMP"
          value={`₹${avg.toFixed(0)}`}
          hint={`Across ${hist.length} reports`}
        />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Day-over-day GMP change (₹)">
          <div className="h-56 p-4">
            <ResponsiveContainer>
              <BarChart data={changes} margin={{ left: -8, top: 8 }}>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  formatter={(v: number) => [`${v >= 0 ? "+" : ""}₹${v}`, "Change"]}
                  contentStyle={{
                    borderRadius: 8,
                    border: "1px solid var(--border)",
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="chg" radius={[4, 4, 0, 0]}>
                  {changes.map((c, i) => (
                    <Cell key={i} fill={c.chg >= 0 ? "var(--positive)" : "var(--negative)"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel title="What the numbers suggest">
          <ul className="divide-y text-sm">
            {moves.map((m) => (
              <li key={m.k} className="flex items-center justify-between px-4 py-3">
                <span>{m.k}</span>
                <span
                  className={cn(
                    "num font-semibold",
                    m.v > 0 ? "text-positive" : m.v < 0 ? "text-negative" : "text-muted-foreground",
                  )}
                >
                  {gfmt(m.v)}
                </span>
              </li>
            ))}
            <li className="flex items-center justify-between px-4 py-3">
              <span>Implied listing gain at cap price</span>
              <span
                className={cn(
                  "num font-semibold",
                  upside > 0
                    ? "text-positive"
                    : upside < 0
                      ? "text-negative"
                      : "text-muted-foreground",
                )}
              >
                {pct(upside)}
              </span>
            </li>
            <li className="flex items-center justify-between px-4 py-3">
              <span>GMP vs its own average</span>
              <span
                className={cn(
                  "num font-semibold",
                  g > avg ? "text-positive" : g < avg ? "text-negative" : "text-muted-foreground",
                )}
              >
                {gfmt(g - avg)}
              </span>
            </li>
          </ul>
          <p className="border-t px-4 py-2 text-xs text-muted-foreground">
            Derived from reported GMP history. GMP is unofficial and unregulated — not investment
            advice.
          </p>
        </Panel>
      </div>
    </div>
  );
}

export function SubPanel({ ipo }: { ipo: Ipo }) {
  const s = ipo.subscription;
  if (!s)
    return (
      <Panel>
        <p className="p-8 text-center text-sm text-muted-foreground">
          Subscription data is not available from the configured sources.
        </p>
      </Panel>
    );
  const categoryData = s.observations
    .filter((v) => v.basis === "exact" && !v.disputed && v.multiple !== null)
    .map((v) => ({ k: categoryName(v.category), v: Number(v.multiple) }));
  const total = s.overall;
  const historyProvider = total?.provider;
  const history = s.history
    .filter(
      (value) =>
        (!historyProvider || value.provider === historyProvider) &&
        value.basis === "exact" &&
        !value.disputed &&
        value.multiple !== null &&
        (value.observedAt || value.reportedDate),
    )
    .sort((a, b) =>
      (a.observedAt ?? a.reportedDate ?? "").localeCompare(b.observedAt ?? b.reportedDate ?? ""),
    );
  const momentumMap = new Map<string, Record<string, string | number>>();
  for (const value of history) {
    const key = value.observedAt ?? value.reportedDate!;
    const point = momentumMap.get(key) ?? {
      time: key,
      label: value.observedAt
        ? new Intl.DateTimeFormat("en-IN", {
            timeZone: "Asia/Kolkata",
            day: "2-digit",
            month: "short",
            hour: "numeric",
            minute: "2-digit",
          }).format(new Date(value.observedAt))
        : value.reportedDate!,
    };
    point[value.category] = Number(value.multiple);
    momentumMap.set(key, point);
  }
  const momentum = [...momentumMap.values()];
  const momentumCategories = ["TOTAL", "QIB", "NII", "RETAIL", "EMPLOYEE"].filter((category) =>
    momentum.some((point) => point[category] !== undefined),
  );
  const colors: Record<string, string> = {
    TOTAL: "var(--foreground)",
    QIB: "var(--chart-1)",
    NII: "var(--chart-3)",
    RETAIL: "var(--positive)",
    EMPLOYEE: "var(--chart-4)",
  };
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          icon={Activity}
          label="Overall subscription"
          value={total ? subscriptionLabel(total) : "—"}
          hint={total?.basis === "exact" ? "Exact reported multiple" : "Reported basis shown"}
        />
        <StatCard
          icon={Activity}
          label="Shares reserved / offered"
          value={shares(total?.sharesOffered ?? null)}
          hint="Total issue demand base"
        />
        <StatCard
          icon={TrendingUp}
          label="Shares bid"
          value={shares(total?.sharesBid ?? null)}
          hint="Reported applications in shares"
        />
        <StatCard
          icon={Gauge}
          label="Demand status"
          value={total?.final ? "Final" : "Live / latest"}
          hint={total?.venue ? total.venue.toUpperCase() : "Venue unavailable"}
        />
      </div>
      <Panel
        title="Subscription momentum"
        action={
          <span className="text-[10px] text-muted-foreground">
            {historyProvider ? `${historyProvider.replaceAll("_", ".")} observations` : "Reported observations"}
          </span>
        }
      >
        {momentum.length > 1 ? (
          <>
            <div className="flex flex-wrap gap-3 border-b px-4 py-2">
              {momentumCategories.map((category) => (
                <span key={category} className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-muted-foreground">
                  <span className="h-2 w-2 rounded-full" style={{ background: colors[category] }} />
                  {categoryName(category)}
                </span>
              ))}
            </div>
            <div className="h-72 p-4">
              <ResponsiveContainer>
                <LineChart data={momentum} margin={{ left: -12, right: 12, top: 8 }}>
                  <CartesianGrid stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
                  <Tooltip
                    formatter={(value: number, name: string) => [`${Number(value).toFixed(2)}×`, categoryName(name)]}
                    contentStyle={{ borderRadius: 8, border: "1px solid var(--border)", fontSize: 12 }}
                  />
                  {momentumCategories.map((category) => (
                    <Line
                      key={category}
                      type="monotone"
                      dataKey={category}
                      stroke={colors[category]}
                      strokeWidth={category === "TOTAL" ? 2.5 : 1.75}
                      dot={{ r: 3 }}
                      connectNulls
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </>
        ) : (
          <div className="p-6 text-sm text-muted-foreground">
            Momentum will appear after the provider reports at least two timestamped subscription snapshots. The current snapshot remains available below.
          </div>
        )}
      </Panel>
      <Panel title="Reservation & demand by investor category">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="border-b bg-muted/30 text-[10px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left">Category</th>
                <th className="px-4 text-right">Reserved / offered</th>
                <th className="px-4 text-right">Shares bid</th>
                <th className="px-4 text-right">Subscription</th>
                <th className="px-4 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {s.observations.map((value) => (
                <tr key={value.category}>
                  <td className="px-4 py-3 font-semibold">{categoryName(value.category)}</td>
                  <td className="num px-4 text-right">{shares(value.sharesOffered)}</td>
                  <td className="num px-4 text-right">{shares(value.sharesBid)}</td>
                  <td className="num px-4 text-right font-bold">
                    {value.disputed ? "Needs review" : subscriptionLabel(value)}
                  </td>
                  <td className="px-4 text-right text-xs text-muted-foreground">
                    {value.final ? "Final" : "Latest"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="border-t px-4 py-3">
          <ObservationNote value={total ?? null} />
        </div>
      </Panel>
      {categoryData.length > 0 && (
        <Panel title="Subscription multiple by category">
          <div className="h-72 p-4">
            <ResponsiveContainer>
              <BarChart data={categoryData} margin={{ left: -12 }}>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis
                  dataKey="k"
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  formatter={(v: number) => [`${v}×`, "Subscribed"]}
                  contentStyle={{ borderRadius: 8, fontSize: 12 }}
                />
                <Bar dataKey="v" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      )}
    </div>
  );
}

function DocumentCenter({ ipo }: { ipo: Ipo }) {
  const portals = [
    {
      name: "SEBI offer documents",
      detail: "Draft and final offer documents filed with SEBI",
      url: "https://www.sebi.gov.in/sebiweb/home/HomeAction.do?doListing=yes&sid=3&ssid=15&smid=11",
    },
    {
      name: "NSE issue information",
      detail: "Issue notices, forms, bid information and exchange documents",
      url: "https://www.nseindia.com/market-data/issue-information",
    },
    {
      name: "BSE public issues",
      detail: "Issue summaries, prospectuses and basis of allotment documents",
      url: "https://www.bseindia.com/markets/PublicIssues/Issuesummary.aspx",
    },
  ];
  if (ipo.registrarUrl?.startsWith("https://"))
    portals.push({
      name: `${ipo.registrar} allotment portal`,
      detail: "Registrar website reported for this issue",
      url: ipo.registrarUrl,
    });
  return (
    <div className="space-y-5">
      <Panel
        title="Verified issue documents"
        action={
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-positive">
            <FileCheck2 className="h-3 w-3" /> {ipo.documents.length} verified
          </span>
        }
      >
        {ipo.documents.length ? (
          <div className="grid gap-px bg-border sm:grid-cols-2">
            {ipo.documents.map((document) => (
              <a
                key={document.url}
                href={document.url}
                target="_blank"
                rel="noreferrer"
                className="group flex gap-3 bg-card p-4 hover:bg-muted/60"
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-positive-soft text-positive">
                  <FileText className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-start justify-between gap-2 font-semibold group-hover:underline">
                    {document.title}
                    <ExternalLink className="mt-0.5 h-3 w-3 shrink-0" />
                  </span>
                  <span className="mt-1 block text-[10px] uppercase tracking-wider text-muted-foreground">
                    {document.type.replaceAll("_", " ")} · {document.sourceOrganization}
                  </span>
                  <span className="mt-1 block text-[10px] text-muted-foreground">
                    {document.filingDate ? `Filed ${document.filingDate} · ` : ""}
                    {document.verifiedAt ? `Verified ${document.verifiedAt.slice(0, 10)}` : "Verification date unavailable"}
                  </span>
                </span>
              </a>
            ))}
          </div>
        ) : (
          <div className="p-6">
            <div className="font-semibold">Issue-specific documents are awaiting verification</div>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              A document is listed here only after its URL and source have been reviewed. Use the official portals below while this record is incomplete.
            </p>
          </div>
        )}
      </Panel>
      <Panel title="Official filing portals">
        <div className="grid gap-px bg-border sm:grid-cols-2">
          {portals.map((portal) => (
            <a
              key={portal.url}
              href={portal.url}
              target="_blank"
              rel="noreferrer"
              className="group flex items-center gap-3 bg-card p-4 hover:bg-muted/60"
            >
              <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1">
                <span className="block font-semibold group-hover:underline">{portal.name}</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">{portal.detail}</span>
              </span>
              <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            </a>
          ))}
        </div>
      </Panel>
      <Panel title="Issue intermediaries">
        <dl className="divide-y text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
            <dt className="text-muted-foreground">Registrar</dt>
            <dd className="font-semibold">{ipo.registrar}</dd>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
            <dt className="text-muted-foreground">Book running lead managers</dt>
            <dd className="max-w-2xl text-right font-semibold">{ipo.leadManager}</dd>
          </div>
        </dl>
      </Panel>
    </div>
  );
}

function Financials({ ipo }: { ipo: Ipo }) {
  if (!ipo.financials.length)
    return (
      <Panel>
        <p className="p-6 text-sm text-muted-foreground">
          Verified financial statements are not yet available. Refer to the official offer
          documents.
        </p>
      </Panel>
    );
  const rows: [string, keyof Ipo["financials"][number]][] = [
    ["Revenue", "revenue"],
    ["EBITDA", "ebitda"],
    ["Profit after tax", "profit"],
    ["Net worth", "netWorth"],
    ["Total borrowings", "borrowings"],
  ];
  return (
    <div className="space-y-5">
      <FinancialSnapshot ipo={ipo} />
      <Panel title="Detailed financial statements (₹ Cr)">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] text-sm">
            <thead className="border-b bg-muted/50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">
                  Metric
                </th>
                {ipo.financials.map((f) => (
                  <th
                    key={f.year}
                    className="px-4 py-2 text-right text-xs font-medium text-muted-foreground"
                  >
                    {f.year}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map(([l, k]) => (
                <tr key={k}>
                  <td className="px-4 py-2.5">{l}</td>
                  {ipo.financials.map((f) => (
                    <td key={f.year} className="num px-4 text-right">
                      {num(f[k] as number | null)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 border-t px-4 py-3 text-xs text-muted-foreground">
          {ipo.financials.map((period) => (
            <a
              key={period.year + period.sourceUrl}
              href={period.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 underline"
            >
              {period.year} source <ExternalLink className="h-3 w-3" />
            </a>
          ))}
        </div>
      </Panel>
    </div>
  );
}
