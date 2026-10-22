import { useState } from "react";
import Decimal from "decimal.js";
import { Panel } from "./site";
import { ObservationNote } from "./data-quality";
import type { Ipo } from "../lib/ipo-data";
import { estimatedListing, estimatedLotGain, minimumInvestment } from "../lib/market/rules";
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
