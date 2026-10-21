import type { Basis } from "./rules";
export interface Master {
  slug: string;
  company_name: string;
  normalized_company_name: string;
  board: "mainboard" | "sme" | "debt";
  status: "upcoming" | "open" | "closed" | "listed" | "withdrawn";
  nse_symbol: string | null;
  bse_symbol: string | null;
  exchange: string | null;
  sector: string | null;
  registrar: string | null;
  open_date: string | null;
  close_date: string | null;
  allotment_date: string | null;
  listing_date: string | null;
  price_min: string | null;
  price_max: string | null;
  lot_size: string | null;
  issue_size: string | null;
  fresh_issue_amount: string | null;
  offer_for_sale_amount: string | null;
  minimum_investment: string | null;
  primary_source_url: string;
  last_observed_at: string | null;
}
export interface GmpObservation {
  value: string;
  percentage: string | null;
  observedAt: string | null;
  reportedDate: string | null;
  reportedAtRaw: string | null;
  sourceUrl: string;
  sourceCount: number | null;
  sourceSpread: string | null;
  disputed: boolean;
  validation: "reported" | "review";
  raw: unknown;
}
export interface SubscriptionObservation {
  category: string;
  venue: string;
  basis: Basis;
  sharesBid: string | null;
  sharesOffered: string | null;
  multiple: string | null;
  lowerBound: string | null;
  final: boolean;
  observedAt: string | null;
  reportedDate: string | null;
  reportedAtRaw: string | null;
  sourceUrl: string;
  raw: unknown;
}
export interface NormalizedIssue {
  externalId: string;
  provider: string;
  master: Master;
  gmp: GmpObservation[];
  subscriptions: SubscriptionObservation[];
  listing: {
    issuePrice: string;
    listingPrice: string;
    exchange: string | null;
    date: string;
    observedAt: string | null;
  } | null;
  disclaimer: string;
  raw: unknown;
  warnings: string[];
}
export interface Provider {
  id: string;
  enabled: boolean;
  fetchMaster(): Promise<unknown>;
  fetchDetail(key: string): Promise<unknown>;
  normalize(payload: unknown, detail?: boolean): NormalizedIssue[];
}
