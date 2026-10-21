import { z } from "zod";
import Decimal from "decimal.js";
import {
  dateOnly,
  numeric,
  normalizedName,
  observationTime,
  gmpPercentage,
} from "../../lib/market/rules";
import type { Master, NormalizedIssue, Provider, GmpObservation } from "../../lib/market/models";
import type { Db } from "../db";
import { enabled } from "../config";
import { providerJson } from "./http";
const number = z.union([z.number(), z.string()]).nullish().transform(numeric);
const rowSchema = z
  .object({
    id: z.string().optional(),
    slug: z.string().regex(/^[a-z0-9-]+$/),
    name: z.string().min(2),
    board: z.enum(["MAINBOARD", "SME"]),
    status: z.enum(["UPCOMING", "OPEN", "CLOSED", "LISTED", "WITHDRAWN"]),
    priceMin: number,
    priceMax: number,
    lotSize: number,
    issueSizeCr: number,
    openDate: z.string().nullish(),
    closeDate: z.string().nullish(),
    allotmentDate: z.string().nullish(),
    listingDate: z.string().nullish(),
    symbol: z.string().nullish(),
    exchange: z.string().nullish(),
    sector: z.string().nullish(),
    registrar: z.string().nullish(),
    lastGmp: number,
    lastGmpPct: number,
    gmpSources: z.number().int().nonnegative().nullish(),
    gmpSpread: number,
    gmpDisputed: z.boolean().optional(),
    updatedAt: z.string().nullish(),
    issuePrice: number,
    listingPrice: number,
    gmp: z
      .array(
        z
          .object({
            observedAt: z.string().nullish(),
            gmp: number,
            gmpPct: number,
            source: z.string().nullish(),
            unofficial: z.boolean().optional(),
          })
          .passthrough(),
      )
      .optional(),
    subs: z
      .array(
        z
          .object({ category: z.string(), timesSub: number, observedAt: z.string().nullish() })
          .passthrough(),
      )
      .optional(),
  })
  .passthrough();
export class XflotProvider implements Provider {
  id = "xflot";
  enabled = enabled("XFLOT_ENABLED");
  rejected: { raw: unknown; reason: string }[] = [];
  constructor(private db: Db) {}
  fetchMaster() {
    return providerJson(this.db, this.id, "https://www.xflot.com/api/public/market/ipos?limit=200");
  }
  fetchDetail(key: string) {
    return providerJson(
      this.db,
      this.id,
      "https://www.xflot.com/api/public/market/ipos/" + encodeURIComponent(key),
    );
  }
  normalize(payload: unknown, detail = false): NormalizedIssue[] {
    this.rejected = [];
    const envelope = z
      .object({
        ok: z.literal(true),
        disclaimer: z.string().min(1),
        ipos: z.array(z.unknown()).optional(),
        ipo: z.unknown().optional(),
      })
      .parse(payload);
    const records = detail ? [envelope.ipo] : envelope.ipos;
    if (!records) throw new Error("Missing IPO list");
    return records.flatMap((raw) => {
      try {
        const r = rowSchema.parse(raw),
          sourceUrl = "https://www.xflot.com/api/public/market/ipos/" + r.slug;
        const master: Master = {
          slug: r.slug,
          company_name: r.name,
          normalized_company_name: normalizedName(r.name),
          board: r.board.toLowerCase() as Master["board"],
          status: r.status.toLowerCase() as Master["status"],
          nse_symbol: r.exchange?.includes("NSE") ? (r.symbol ?? null) : null,
          bse_symbol: r.exchange === "BSE" ? (r.symbol ?? null) : null,
          exchange: r.exchange ?? null,
          sector: r.sector ?? null,
          registrar: r.registrar ?? null,
          open_date: dateOnly(r.openDate),
          close_date: dateOnly(r.closeDate),
          allotment_date: dateOnly(r.allotmentDate),
          listing_date: dateOnly(r.listingDate),
          price_min: r.priceMin,
          price_max: r.priceMax,
          lot_size: r.lotSize,
          issue_size:
            r.issueSizeCr === null ? null : new Decimal(r.issueSizeCr).mul(10000000).toString(),
          fresh_issue_amount: null,
          offer_for_sale_amount: null,
          minimum_investment: null,
          primary_source_url: sourceUrl,
          last_observed_at: observationTime(r.updatedAt).observedAt,
        };
        if (
          (master.open_date && master.close_date && master.open_date > master.close_date) ||
          (master.close_date && master.listing_date && master.close_date > master.listing_date)
        )
          throw new Error("Inconsistent issue dates");
        if (
          (r.priceMin !== null && Number(r.priceMin) <= 0) ||
          (r.priceMax !== null && Number(r.priceMax) <= 0) ||
          (r.priceMin !== null && r.priceMax !== null && new Decimal(r.priceMin).gt(r.priceMax)) ||
          (r.lotSize !== null && (!new Decimal(r.lotSize).isInteger() || Number(r.lotSize) <= 0)) ||
          (r.issueSizeCr !== null && Number(r.issueSizeCr) < 0)
        )
          throw new Error("Invalid issue amounts");
        const gmp: GmpObservation[] = [];
        const points = r.gmp?.length
          ? r.gmp
          : r.lastGmp !== null
            ? [{ gmp: r.lastGmp, gmpPct: r.lastGmpPct, observedAt: r.updatedAt }]
            : [];
        for (const point of points) {
          if (point.gmp === null) continue;
          const time = observationTime(point.observedAt);
          const calculated = gmpPercentage(r.priceMax, point.gmpPct === null ? null : point.gmp);
          const inconsistent =
            calculated !== null &&
            point.gmpPct !== null &&
            new Decimal(calculated).minus(point.gmpPct).abs().gt(1);
          gmp.push({
            value: point.gmp,
            percentage: point.gmpPct,
            observedAt: time.observedAt,
            reportedDate: time.reportedDate,
            reportedAtRaw: time.raw,
            sourceUrl,
            sourceCount: r.gmpSources ?? null,
            sourceSpread: r.gmpSpread,
            disputed: r.gmpDisputed ?? false,
            validation: inconsistent ? "review" : "reported",
            raw: point,
          });
        }
        const subscriptions = (r.subs ?? [])
          .filter((s) => s.timesSub !== null && Number(s.timesSub) >= 0)
          .map((s) => {
            const time = observationTime(s.observedAt);
            return {
              category: s.category.toUpperCase(),
              venue: "aggregated",
              basis: "exact" as const,
              sharesBid: null,
              sharesOffered: null,
              multiple: s.timesSub,
              lowerBound: null,
              final: false,
              observedAt: time.observedAt,
              reportedDate: time.reportedDate,
              reportedAtRaw: time.raw,
              sourceUrl,
              raw: s,
            };
          });
        const listing =
          r.status === "LISTED" &&
          r.listingPrice !== null &&
          r.issuePrice !== null &&
          Number(r.issuePrice) > 0 &&
          Number(r.listingPrice) > 0 &&
          master.listing_date
            ? {
                issuePrice: r.issuePrice,
                listingPrice: r.listingPrice,
                exchange: master.exchange,
                date: master.listing_date,
                observedAt: null,
              }
            : null;
        return [
          {
            provider: this.id,
            externalId: r.id ?? r.slug,
            master,
            gmp,
            subscriptions,
            listing,
            disclaimer: envelope.disclaimer,
            raw,
            warnings: gmp.some((g) => g.validation === "review") ? ["GMP_PERCENTAGE_MISMATCH"] : [],
          },
        ];
      } catch {
        this.rejected.push({ raw, reason: "INVALID_XFLOT_RECORD" });
        return [];
      }
    });
  }
}
