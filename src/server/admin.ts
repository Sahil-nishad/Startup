import { z } from "zod";
import type { Db } from "./db";
import { numeric, dateOnly } from "../lib/market/rules";
import { ServiceError } from "./config";
const input = z.object({
  ipoId: z.string().uuid(),
  field: z.enum([
    "price_min",
    "price_max",
    "lot_size",
    "issue_size",
    "fresh_issue_amount",
    "offer_for_sale_amount",
    "open_date",
    "close_date",
    "allotment_date",
    "listing_date",
    "registrar",
    "registrar_url",
    "about",
    "lead_manager",
    "document",
    "financial",
  ]),
  value: z.unknown(),
  reason: z.string().min(10).max(2000),
  sourceUrl: z.string().url(),
  verification: z.enum(["verified", "review"]),
});
function safeEvidence(url: string) {
  const u = new URL(url);
  if (
    u.protocol !== "https:" ||
    u.username ||
    u.password ||
    u.hostname === "localhost" ||
    /^\d+\./.test(u.hostname)
  )
    throw new ServiceError("INVALID_EVIDENCE_URL", 400);
  return url;
}
export class ManualVerifiedDataProvider {
  constructor(private db: Db) {}
  async correct(raw: unknown, administrator: string) {
    const data = input.parse(raw);
    safeEvidence(data.sourceUrl);
    return this.db.transaction(async (tx) => {
      const base = (
        await tx.query<Record<string, unknown>>("SELECT * FROM ipos WHERE id=$1 FOR UPDATE", [
          data.ipoId,
        ])
      ).rows[0];
      if (!base) throw new ServiceError("IPO_NOT_FOUND", 404);
      const latest = (
        await tx.query<Record<string, unknown>>(
          "SELECT field,corrected_value FROM manual_corrections WHERE ipo_id=$1 AND verification_status='verified' ORDER BY created_at",
          [data.ipoId],
        )
      ).rows;
      for (const c of latest) base[String(c["field"])] = c["corrected_value"];
      let value = data.value;
      if (data.field.endsWith("_date")) value = dateOnly(z.string().parse(value));
      else if (
        [
          "price_min",
          "price_max",
          "lot_size",
          "issue_size",
          "fresh_issue_amount",
          "offer_for_sale_amount",
        ].includes(data.field)
      ) {
        value = numeric(value);
        if (
          value === null ||
          Number(value) < 0 ||
          (["price_min", "price_max", "lot_size"].includes(data.field) && Number(value) <= 0) ||
          (data.field === "lot_size" && !Number.isInteger(Number(value)))
        )
          throw new ServiceError("INVALID_CORRECTION", 400);
      } else if (data.field === "registrar_url") value = safeEvidence(z.string().parse(value));
      else if (data.field !== "document" && data.field !== "financial")
        value = z.string().min(1).max(5000).parse(value);
      const merged = { ...base, [data.field]: value };
      if (
        (merged["open_date"] &&
          merged["close_date"] &&
          new Date(String(merged["open_date"])).getTime() >
            new Date(String(merged["close_date"])).getTime()) ||
        (merged["close_date"] &&
          merged["listing_date"] &&
          new Date(String(merged["close_date"])).getTime() >
            new Date(String(merged["listing_date"])).getTime()) ||
        (merged["price_min"] &&
          merged["price_max"] &&
          Number(merged["price_min"]) > Number(merged["price_max"]))
      )
        throw new ServiceError("INCONSISTENT_CORRECTION", 400);
      if (data.field === "document") {
        const d = z
          .object({
            type: z.enum(["DRHP", "RHP", "PROSPECTUS", "ADDENDUM", "OTHER"]),
            title: z.string().min(1),
            url: z.string().url(),
            organization: z.string().min(1),
            filingDate: z.string().nullable(),
          })
          .parse(value);
        safeEvidence(d.url);
        base[data.field] =
          (
            await tx.query("SELECT * FROM ipo_documents WHERE ipo_id=$1 AND url=$2", [
              data.ipoId,
              d.url,
            ])
          ).rows[0] ?? null;
        await tx.query(
          "INSERT INTO ipo_documents(ipo_id,document_type,title,url,source_organization,filing_date,verification_status,verified_at,last_checked_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,now()) ON CONFLICT(ipo_id,url) DO UPDATE SET title=excluded.title,verification_status=excluded.verification_status,verified_at=excluded.verified_at,last_checked_at=now()",
          [
            data.ipoId,
            d.type,
            d.title,
            d.url,
            d.organization,
            dateOnly(d.filingDate),
            data.verification,
            data.verification === "verified" ? new Date() : null,
          ],
        );
      }
      if (data.field === "financial") {
        const f = z
          .object({
            period: z.string().min(1),
            year: z.number().int(),
            units: z.enum(["INR", "INR_CRORE"]),
            revenue: z.unknown(),
            profit: z.unknown(),
            ebitda: z.unknown(),
            eps: z.unknown(),
            netWorth: z.unknown(),
            borrowings: z.unknown(),
          })
          .parse(value);
        base[data.field] =
          (
            await tx.query(
              "SELECT * FROM company_financials WHERE ipo_id=$1 AND period=$2 AND source_url=$3",
              [data.ipoId, f.period, data.sourceUrl],
            )
          ).rows[0] ?? null;
        await tx.query(
          "INSERT INTO company_financials(ipo_id,period,reporting_year,units,revenue,profit,ebitda,eps,net_worth,borrowings,source_url,verification_status,verified_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) ON CONFLICT(ipo_id,period,source_url) DO UPDATE SET revenue=excluded.revenue,profit=excluded.profit,ebitda=excluded.ebitda,eps=excluded.eps,net_worth=excluded.net_worth,borrowings=excluded.borrowings,verification_status=excluded.verification_status,verified_at=excluded.verified_at",
          [
            data.ipoId,
            f.period,
            f.year,
            f.units,
            ...[f.revenue, f.profit, f.ebitda, f.eps, f.netWorth, f.borrowings].map(numeric),
            data.sourceUrl,
            data.verification,
            data.verification === "verified" ? new Date() : null,
          ],
        );
      }
      await tx.query(
        "INSERT INTO manual_corrections(ipo_id,field,original_value,corrected_value,reason,source_url,administrator_id,verification_status) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",
        [
          data.ipoId,
          data.field,
          JSON.stringify(base[data.field] ?? null),
          JSON.stringify(value),
          data.reason,
          data.sourceUrl,
          administrator,
          data.verification,
        ],
      );
      if (data.field !== "document" && data.field !== "financial") {
        // Field is from the closed enum above. Materialize the override so SQL filters agree.
        await tx.query(`UPDATE ipos SET ${data.field}=$2,updated_at=now() WHERE id=$1`, [
          data.ipoId,
          data.verification === "verified" ? value : null,
        ]);
      }
      if (data.verification === "verified")
        await tx.query("UPDATE data_conflicts SET resolved_at=now() WHERE ipo_id=$1 AND field=$2", [
          data.ipoId,
          data.field,
        ]);
      return { saved: true };
    });
  }
}
