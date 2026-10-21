import { useState } from "react";
import Decimal from "decimal.js";
import { Panel } from "./site";
import { ObservationNote } from "./data-quality";
import {
  inr,
  cr,
  fmtDate,
  gmpPct,
  latestGmp,
  minInvestment,
  pct,
  statusOf,
  subLabel,
  type Ipo,
} from "../lib/ipo-data";
import { estimatedListing, estimatedLotGain, minimumInvestment } from "../lib/market/rules";
import { useComparison } from "../lib/ipo-lists";
import { X } from "lucide-react";
const money = (value: string | null) =>
  value === null ? "Unavailable" : "₹" + new Decimal(value).toFixed(2);
export function InvestmentCalculator({ ipo }: { ipo: Ipo }) {
  const [lots, setLots] = useState(1);
  const gmp = ipo.gmp && !ipo.gmp.disputed && ipo.gmp.quality !== "review" ? ipo.gmp.gmp : null;
  const shares = ipo.lot === null ? null : new Decimal(ipo.lot).mul(lots).toString();
  return (
    <Panel title="Investment calculator">
      <div className="space-y-3 p-4 text-sm">
        <label className="flex items-center gap-3">
          Number of lots
          <input
            aria-label="Number of lots"
            type="number"
            min="1"
            max="1000"
            value={lots}
            onChange={(e) =>
              setLots(Math.max(1, Math.min(1000, Math.trunc(Number(e.target.value) || 1))))
            }
            className="w-24 rounded-md border bg-card p-2"
          />
        </label>
        <dl className="grid grid-cols-2 gap-3">
          <dt>Amount at upper price band</dt>
          <dd className="num">{money(minimumInvestment(ipo.priceHigh, shares))}</dd>
          <dt>Unofficial estimated listing price</dt>
          <dd className="num">{money(estimatedListing(ipo.priceHigh, gmp))}</dd>
          <dt>Unofficial estimated gain for these lots</dt>
          <dd className="num">{money(estimatedLotGain(gmp, shares))}</dd>
        </dl>
        <p className="text-xs text-muted-foreground">
          Uses the reported upper price band and shares per lot. Discounts, category eligibility,
          minimum application lots, fees and taxes are not included. Check the offer document for
          application rules. GMP estimates are not forecasts.
        </p>
        <ObservationNote value={ipo.gmp} />
      </div>
    </Panel>
  );
}
export function IpoComparison({ ipos }: { ipos: Ipo[] }) {
  const comparison = useComparison();
  const chosen = comparison.slugs
    .map((slug) => ipos.find((ipo) => ipo.slug === slug))
    .filter((ipo): ipo is Ipo => Boolean(ipo));
  const slots = Array.from({ length: 4 }, (_, index) => chosen[index]);
  const select = (index: number, slug: string) => {
    const next = [...comparison.slugs];
    if (!slug) next.splice(index, 1);
    else next[index] = slug;
    comparison.save(next.filter(Boolean));
  };
  const latestFinancial = (ipo: Ipo) =>
    [...ipo.financials].sort((a, b) => a.year.localeCompare(b.year)).at(-1);
  const metrics: { label: string; value: (ipo: Ipo) => string }[] = [
    { label: "Status", value: (ipo) => statusOf(ipo) },
    { label: "Board / exchange", value: (ipo) => `${ipo.category} · ${ipo.exchange}` },
    { label: "Price band", value: (ipo) => `${inr(ipo.priceLow)} – ${inr(ipo.priceHigh)}` },
    { label: "Lot / minimum", value: (ipo) => `${ipo.lot ?? "—"} · ${inr(minInvestment(ipo))}` },
    { label: "Issue size", value: (ipo) => cr(ipo.issueSizeCr) },
    { label: "Reported GMP", value: (ipo) => `${inr(latestGmp(ipo))} · ${pct(gmpPct(ipo))}` },
    { label: "Subscription", value: (ipo) => subLabel(ipo) },
    { label: "Open → close", value: (ipo) => `${fmtDate(ipo.open)} → ${fmtDate(ipo.close)}` },
    { label: "Latest revenue", value: (ipo) => cr(latestFinancial(ipo)?.revenue) },
    { label: "Latest profit", value: (ipo) => cr(latestFinancial(ipo)?.profit) },
  ];
  return (
    <div id="compare" className="mt-6 scroll-mt-20">
      <Panel
        title="Compare up to 4 IPOs"
        action={
          comparison.slugs.length ? (
            <button onClick={comparison.clear} className="text-[10px] font-semibold text-muted-foreground hover:text-foreground">
              Clear comparison
            </button>
          ) : undefined
        }
      >
        <div className="grid gap-2 border-b bg-muted/20 p-3 sm:grid-cols-2 xl:grid-cols-4">
          {slots.map((ipo, index) => (
            <div key={index} className="relative">
              <select
                aria-label={"Compare IPO " + (index + 1)}
                value={ipo?.slug ?? ""}
                onChange={(event) => select(index, event.target.value)}
                className="h-10 w-full rounded-lg border bg-card px-3 pr-8 text-xs font-semibold"
              >
                <option value="">IPO {index + 1}</option>
                {ipos
                  .filter((item) => item.slug === ipo?.slug || !comparison.slugs.includes(item.slug))
                  .map((i) => (
                  <option key={i.slug} value={i.slug}>
                    {i.name}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
        {chosen.length >= 2 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="border-b bg-muted/25">
                <tr>
                  <th className="w-44 px-4 py-3 text-left text-[10px] uppercase tracking-wider text-muted-foreground">Metric</th>
                  {chosen.map((ipo) => (
                    <th key={ipo.slug} className="min-w-44 px-4 py-3 text-left">
                      <div className="flex items-start justify-between gap-2">
                        <span>{ipo.name}</span>
                        <button aria-label={`Remove ${ipo.name}`} onClick={() => comparison.remove(ipo.slug)}>
                          <X className="h-3.5 w-3.5 text-muted-foreground" />
                        </button>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {metrics.map((metric) => (
                  <tr key={metric.label}>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">{metric.label}</th>
                    {chosen.map((ipo) => (
                      <td key={ipo.slug} className="num px-4 py-3 font-semibold">{metric.value(ipo)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-8 text-center text-sm text-muted-foreground">
            Select at least two IPOs to compare their reported numbers side by side.
          </div>
        )}
      </Panel>
    </div>
  );
}
