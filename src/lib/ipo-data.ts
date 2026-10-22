import {
  estimatedListing,
  gmpPercentage,
  minimumInvestment,
  listingPercentage,
  indiaToday,
  subscriptionLabel,
  type Basis,
} from "./market/rules";
export { articles } from "./articles";
export type Category = "Mainboard" | "SME" | "Debt";
export type Exchange = string;
export type Status = "Upcoming" | "Open" | "Closed" | "Listed" | "Withdrawn";
export type Quality = "recent" | "stale" | "historical" | "unknown" | "review";
export interface SourceValue {
  provider: string;
  sourceUrl: string;
  observedAt: string | null;
  reportedDate: string | null;
  retrievedAt: string;
  quality: Quality;
  disputed: boolean;
}
export interface GmpPoint extends SourceValue {
  date: string;
  gmp: number;
  reportedPercentage: number | null;
}
export interface SubValue extends SourceValue {
  category: string;
  venue: string;
  basis: Basis;
  multiple: string | null;
  lowerBound: string | null;
  sharesBid: string | null;
  sharesOffered: string | null;
  final: boolean;
}
export interface Subscription {
  qib: number | null;
  nii: number | null;
  retail: number | null;
  employee: number | null;
  total: number | null;
  observations: SubValue[];
  history: SubValue[];
  overall: SubValue | null;
}
export interface Financial {
  year: string;
  revenue: number | null;
  ebitda: number | null;
  profit: number | null;
  netWorth: number | null;
  borrowings: number | null;
  sourceUrl: string;
  verifiedAt: string | null;
}
export interface Ipo {
  fieldSources: Record<string, { sourceUrl: string; verifiedAt: string | null; status: string }>;
  id: string;
  slug: string;
  name: string;
  symbol: string;
  sector: string;
  category: Category;
  exchange: string;
  status: Status;
  priceLow: number | null;
  priceHigh: number | null;
  lot: number | null;
  issueSizeCr: number | null;
  freshCr: number | null;
  ofsCr: number | null;
  open: string | null;
  close: string | null;
  allotment: string | null;
  listing: string | null;
  registrar: string;
  registrarUrl: string | null;
  leadManager: string;
  about: string;
  gmpHistory: GmpPoint[];
  gmp: GmpPoint | null;
  subscription: Subscription | null;
  listingPrice: number | null;
  issuePrice: number | null;
  currentPrice: number | null;
  financials: Financial[];
  strengths: string[];
  risks: string[];
  documents: {
    title: string;
    url: string;
    type: string;
    sourceOrganization: string;
    filingDate: string | null;
    verifiedAt: string | null;
    lastCheckedAt: string | null;
  }[];
  sourceUrl: string;
  observedAt: string | null;
  quality: Quality;
  review: boolean;
  listingSource: SourceValue | null;
}
export interface DataSource {
  provider: string;
  status: string;
  lastSuccessAt: string | null;
  lastReportedAt: string | null;
  disclaimer: string | null;
}
export interface MarketSnapshot {
  items: Ipo[];
  total: number | null;
  available: boolean;
  error: string | null;
  sources: DataSource[];
  generatedAt: string;
}
export const todayIso = () => indiaToday();
export const statusOf = (ipo: Ipo): Status => {
  if (ipo.status === "Withdrawn") return "Withdrawn";
  const today = indiaToday();
  if (ipo.listing && ipo.listing <= today) return "Listed";
  if (ipo.open && ipo.close) {
    if (today < ipo.open) return "Upcoming";
    if (today <= ipo.close) return "Open";
    return "Closed";
  }
  return ipo.status;
};
export const latestGmp = (ipo: Ipo) => ipo.gmp?.gmp ?? null;
const asNumber = (n: string | null) => (n === null ? null : Number(n));
export const gmpPct = (ipo: Ipo) =>
  ipo.gmp?.disputed || ipo.gmp?.quality === "review"
    ? null
    : asNumber(gmpPercentage(ipo.priceHigh, latestGmp(ipo)));
export const estListing = (ipo: Ipo) =>
  ipo.gmp?.disputed || ipo.gmp?.quality === "review"
    ? null
    : asNumber(estimatedListing(ipo.priceHigh, latestGmp(ipo)));
export const minInvestment = (ipo: Ipo) => asNumber(minimumInvestment(ipo.priceHigh, ipo.lot));
export const listingGainPct = (ipo: Ipo) =>
  asNumber(listingPercentage(ipo.issuePrice, ipo.listingPrice));
export const num = (n: number | null | undefined, digits?: number) =>
  n == null || !Number.isFinite(n)
    ? "—"
    : n.toLocaleString(
        "en-IN",
        digits === undefined
          ? {}
          : { minimumFractionDigits: digits, maximumFractionDigits: digits },
      );
export const inr = (n: number | null | undefined) => (n == null ? "—" : "₹" + num(n));
export const cr = (n: number | null | undefined) => (n == null ? "—" : inr(n) + " Cr");
export const pct = (n: number | null | undefined, digits = 1) =>
  n == null || !Number.isFinite(n) ? "—" : (n > 0 ? "+" : "") + n.toFixed(digits) + "%";
export const subLabel = (ipo: Ipo) =>
  ipo.subscription?.overall?.disputed
    ? "Needs review"
    : subscriptionLabel(ipo.subscription?.overall);
export const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
export const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
export const shortDate = (iso: string | null | undefined) =>
  iso
    ? `${iso.slice(8, 10)} ${MONTHS[Number(iso.slice(5, 7)) - 1]?.slice(0, 3) ?? ""}`
    : "Unavailable";
export const fmtDate = (iso: string | null | undefined) =>
  iso ? `${shortDate(iso)} ${iso.slice(0, 4)}` : "Unavailable";
export const longToday = () =>
  new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());
