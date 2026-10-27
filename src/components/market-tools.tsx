import { useState } from "react";
import Decimal from "decimal.js";
import { Panel } from "./site";
import { ObservationNote } from "./data-quality";
import type { Ipo } from "../lib/ipo-data";
import { estimatedListing, estimatedLotGain, minimumInvestment } from "../lib/market/rules";
const money = (value: string | null) =>
  value === null ? "Unavailable" : "₹" + new Decimal(value).toFixed(2);
export function InvestmentCalculator({ ipo }: { ipo: Ipo }) {
  const [lotInput, setLotInput] = useState("1");
  const parsedLots = Number(lotInput);
  const validLots = Number.isInteger(parsedLots) && parsedLots >= 1 && parsedLots <= 1000;
  const lots = validLots ? parsedLots : 1;
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
            step="1"
            inputMode="numeric"
            value={lotInput}
            onChange={(e) => setLotInput(e.target.value)}
            onBlur={() =>
              setLotInput(String(Math.max(1, Math.min(1000, Math.trunc(parsedLots || 1)))))
            }
            className="w-24 rounded-md border bg-card p-2 tabular-nums"
          />
        </label>
        {!validLots && (
          <p className="text-xs text-warning" role="status">
            Enter a whole number from 1 to 1,000 lots.
          </p>
        )}
        <dl className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-3">
          <dt className="min-w-0">
            Amount at upper price band ({lots} {lots === 1 ? "lot" : "lots"})
          </dt>
          <dd className="num text-right">{money(minimumInvestment(ipo.priceHigh, shares))}</dd>
          <dt className="min-w-0">Unofficial estimated listing price per share</dt>
          <dd className="num text-right">{money(estimatedListing(ipo.priceHigh, gmp))}</dd>
          <dt className="min-w-0">
            Unofficial estimated gain ({lots} {lots === 1 ? "lot" : "lots"})
          </dt>
          <dd className="num text-right">{money(estimatedLotGain(gmp, shares))}</dd>
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

