import Decimal from "decimal.js";

export type Amount = string | number | null | undefined;
export type Basis = "exact" | "lower_bound" | "bids_only";
export function numeric(value: unknown): string | null {
  if (value === null || value === undefined || value === "" || value === "—" || value === "-")
    return null;
  if (typeof value !== "string" && typeof value !== "number")
    throw new Error("Invalid numeric type");
  const raw = String(value).trim();
  if (!/^[+-]?(?:\d+|\d{1,3}(?:,\d{3})+|\d{1,2}(?:,\d{2})*,\d{3})(?:\.\d+)?$/.test(raw))
    throw new Error("Malformed numeric value");
  const n = new Decimal(raw.replaceAll(",", ""));
  if (!n.isFinite() || n.abs().gt("1000000000000000000"))
    throw new Error("Numeric value out of range");
  return n.toString();
}
function calc(a: Amount, b: Amount, op: (x: Decimal, y: Decimal) => Decimal): string | null {
  const x = numeric(a),
    y = numeric(b);
  return x === null || y === null ? null : op(new Decimal(x), new Decimal(y)).toString();
}
export const estimatedListing = (price: Amount, gmp: Amount) =>
  Number(price) > 0 ? calc(price, gmp, (a, b) => a.plus(b)) : null;
export const gmpPercentage = (price: Amount, gmp: Amount) =>
  Number(price) > 0 ? calc(gmp, price, (a, b) => a.div(b).mul(100)) : null;
export const estimatedLotGain = (gmp: Amount, lot: Amount) =>
  Number.isInteger(Number(lot)) && Number(lot) > 0 ? calc(gmp, lot, (a, b) => a.mul(b)) : null;
export const minimumInvestment = (price: Amount, lot: Amount) =>
  Number(price) > 0 ? estimatedLotGain(price, lot) : null;
export const listingGain = (issue: Amount, listing: Amount) =>
  Number(issue) > 0 && Number(listing) > 0 ? calc(listing, issue, (a, b) => a.minus(b)) : null;
export const listingPercentage = (issue: Amount, listing: Amount) =>
  gmpPercentage(issue, listingGain(issue, listing));
export function dateOnly(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}(?:T00:00:00(?:\.000)?Z)?$/.test(value))
    throw new Error("Invalid date-only value");
  const d = value.slice(0, 10);
  if (new Date(d + "T00:00:00Z").toISOString().slice(0, 10) !== d)
    throw new Error("Impossible calendar date");
  return d;
}
export function observationTime(value: unknown): {
  observedAt: string | null;
  reportedDate: string | null;
  raw: string | null;
} {
  if (typeof value !== "string" || !value.trim())
    return { observedAt: null, reportedDate: null, raw: null };
  if (/^\d{4}-\d{2}-\d{2}$/.test(value))
    return { observedAt: null, reportedDate: dateOnly(value), raw: value };
  let iso = value;
  const m =
    /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) (\d{1,2}) (\d{4}) (\d{1,2}):(\d{2})(AM|PM)$/.exec(
      value,
    );
  if (m) {
    const month =
      ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"].indexOf(
        m[1]!,
      ) + 1;
    const hour = (Number(m[4]) % 12) + (m[6] === "PM" ? 12 : 0);
    iso = `${m[3]}-${String(month).padStart(2, "0")}-${m[2]!.padStart(2, "0")}T${String(hour).padStart(2, "0")}:${m[5]}:00+05:30`;
  }
  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(iso) ||
    !Number.isFinite(Date.parse(iso))
  )
    return { observedAt: null, reportedDate: null, raw: value };
  return { observedAt: new Date(iso).toISOString(), reportedDate: null, raw: value };
}
export const indiaToday = (now = new Date()) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
export const istTime = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat("en-IN", {
        timeZone: "Asia/Kolkata",
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(value)) + " IST"
    : "Observation time unavailable";
export function freshness(
  observedAt: string | null,
  hours: number,
  historical = false,
  now = Date.now(),
) {
  if (historical) return "historical" as const;
  if (!observedAt) return "unknown" as const;
  const age = now - Date.parse(observedAt);
  if (!Number.isFinite(age) || age < -300000) return "review" as const;
  return age > hours * 3600000 ? ("stale" as const) : ("recent" as const);
}
export function subscriptionLabel(
  value:
    { basis: Basis; multiple: Amount; lowerBound: Amount; sharesBid: Amount } | null | undefined,
) {
  if (!value) return "Unavailable";
  if (value.basis === "exact" && value.multiple != null)
    return new Decimal(value.multiple).toFixed(2) + "×";
  if (value.basis === "lower_bound" && value.lowerBound != null)
    return "At least " + new Decimal(value.lowerBound).toFixed(2) + "×";
  return value.sharesBid != null
    ? new Decimal(value.sharesBid).toFixed(0) + " shares bid"
    : "Unavailable";
}
export const normalizedName = (name: string) =>
  name
    .toLowerCase()
    .replace(/\b(limited|ltd|private|pvt)\b/g, "")
    .replace(/[^a-z0-9]/g, "");
export function changedImplausibly(previous: Amount, next: Amount) {
  if (previous == null || next == null || Number(previous) === 0) return false;
  return new Decimal(next).minus(previous).abs().div(new Decimal(previous).abs()).gt("0.5");
}
