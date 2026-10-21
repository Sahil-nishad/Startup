import { z } from "zod";
import { numeric, normalizedName, observationTime } from "../../lib/market/rules";
import type {
  Master,
  NormalizedIssue,
  Provider,
  SubscriptionObservation,
} from "../../lib/market/models";
import type { Db } from "../db";
import { enabled } from "../config";
import { providerJson } from "./http";
const number = z
  .union([z.number(), z.string()])
  .nullish()
  .transform(numeric)
  .refine((v) => v === null || Number(v) >= 0);
export const manifestSchema = z
  .object({
    generated: z.string(),
    issues: z.array(
      z
        .object({
          symbol: z.string().nullable(),
          slug: z.string(),
          name: z.string(),
          board: z.enum(["mainboard", "sme", "debt"]),
          status: z.string(),
          as_of: z.string().nullable(),
          basis: z.enum(["exact", "lower_bound", "bids_only"]),
          path: z.string(),
        })
        .passthrough(),
    ),
  })
  .passthrough();
const schema = z
  .object({
    symbol: z.string().nullish(),
    slug: z.string(),
    name: z.string(),
    board: z.enum(["mainboard", "sme", "debt"]),
    status: z.enum(["open", "upcoming", "closed", "listed", "post_listing", "withdrawn"]),
    as_of: z.string().nullish(),
    venue: z.string(),
    final: z.boolean(),
    basis: z.enum(["exact", "lower_bound", "bids_only"]),
    total_bid: number,
    total_offered: number,
    total_times: number,
    lower_bound_times: number,
    categories: z.record(z.object({ offered: number, bid: number, times: number }).passthrough()),
    exchange: z
      .object({ nse: z.string().nullable().optional(), bse: z.string().nullable().optional() })
      .optional(),
  })
  .passthrough();
export class IposMarketsSubscriptionProvider implements Provider {
  id = "ipos_markets";
  enabled = enabled("IPOS_MARKETS_ENABLED");
  constructor(private db: Db) {}
  fetchMaster() {
    return providerJson(this.db, this.id, "https://ipos.markets/api/v1/subscription");
  }
  fetchDetail(key: string) {
    return providerJson(
      this.db,
      this.id,
      "https://ipos.markets/api/v1/subscription?symbol=" + encodeURIComponent(key),
    );
  }
  normalize(payload: unknown): NormalizedIssue[] {
    const r = schema.parse(payload),
      time = observationTime(r.as_of),
      sourceUrl =
        "https://ipos.markets/api/v1/subscription?symbol=" + encodeURIComponent(r.symbol ?? r.slug);
    if (
      (r.basis === "exact" && r.total_times === null) ||
      (r.basis === "lower_bound" && r.lower_bound_times === null)
    )
      throw new Error("Subscription basis missing value");
    const master: Master = {
      slug: r.slug,
      company_name: r.name,
      normalized_company_name: normalizedName(r.name),
      board: r.board,
      status: r.status === "post_listing" ? "listed" : r.status,
      nse_symbol: r.exchange?.nse ?? (r.venue === "nse" ? (r.symbol ?? null) : null),
      bse_symbol: r.exchange?.bse ?? null,
      exchange: r.venue.toUpperCase(),
      sector: null,
      registrar: null,
      open_date: null,
      close_date: null,
      allotment_date: null,
      listing_date: null,
      price_min: null,
      price_max: null,
      lot_size: null,
      issue_size: null,
      fresh_issue_amount: null,
      offer_for_sale_amount: null,
      minimum_investment: null,
      primary_source_url: sourceUrl,
      last_observed_at: time.observedAt,
    };
    const common = {
      venue: r.venue,
      final: r.final,
      observedAt: time.observedAt,
      reportedDate: time.reportedDate,
      reportedAtRaw: time.raw,
      sourceUrl,
    };
    const subscriptions: SubscriptionObservation[] = [
      {
        ...common,
        category: "TOTAL",
        basis: r.basis,
        sharesBid: r.total_bid,
        sharesOffered: r.total_offered,
        multiple: r.basis === "exact" ? r.total_times : null,
        lowerBound: r.basis === "lower_bound" ? r.lower_bound_times : null,
        raw: payload,
      },
    ];
    for (const [category, v] of Object.entries(r.categories))
      subscriptions.push({
        ...common,
        category:
          ({ RII: "RETAIL", EMP: "EMPLOYEE" } as Record<string, string>)[category] ?? category,
        basis: v.times === null ? "bids_only" : "exact",
        sharesBid: v.bid,
        sharesOffered: v.offered,
        multiple: v.times,
        lowerBound: null,
        raw: v,
      });
    return [
      {
        provider: this.id,
        externalId: r.symbol ?? r.slug,
        master,
        gmp: [],
        subscriptions,
        listing: null,
        disclaimer:
          "Subscription data provided by IPOs.Markets. Official data © NSE · BSE · SEBI · registrars. Not investment advice.",
        raw: payload,
        warnings: [],
      },
    ];
  }
}
