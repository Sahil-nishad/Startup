import { getDb, type Db } from "./db";
import { setting } from "./config";
import { freshness } from "../lib/market/rules";
import type { Ipo, MarketSnapshot, SourceValue, SubValue, Status, Category } from "../lib/ipo-data";
type Row = Record<string, unknown>;
const str = (v: unknown): string | null =>
  v == null ? null : v instanceof Date ? v.toISOString() : String(v);
const num = (v: unknown) => (v == null ? null : Number(v));
const day = (v: unknown) => str(v)?.slice(0, 10) ?? null;
const time = (v: unknown) =>
  v == null ? 0 : v instanceof Date ? v.getTime() : new Date(String(v)).getTime();
function meta(r: Row, hours: number, historical: boolean): SourceValue {
  const observedAt = str(r["observed_at"]);
  return {
    provider: String(r["provider"]),
    sourceUrl: String(r["source_url"]),
    observedAt,
    reportedDate: day(r["reported_date"]),
    retrievedAt: str(r["retrieved_at"]) ?? "",
    quality:
      r["validation_status"] === "review" ? "review" : freshness(observedAt, hours, historical),
    disputed: r["is_disputed"] === true,
  };
}
export interface ReadFilter {
  q?: string | undefined;
  status?: string | undefined;
  board?: string | undefined;
  exchange?: string | undefined;
  slug?: string | undefined;
  from?: string | undefined;
  to?: string | undefined;
  sort?: string | undefined;
  dir?: string | undefined;
  page?: number | undefined;
  limit?: number | undefined;
}
export async function readMarket(filter: ReadFilter = {}, db?: Db): Promise<MarketSnapshot> {
  db ??= await getDb();
  const where: string[] = [];
  const args: unknown[] = [];
  const add = (sql: string, value: unknown) => {
    args.push(value);
    where.push(sql.replaceAll("?", `$${args.length}`));
  };
  if (filter.q) add("(company_name ILIKE '%'||?||'%' OR nse_symbol ILIKE '%'||?||'%')", filter.q);
  if (filter.status) add("status=?", filter.status.toLowerCase());
  if (filter.board) add("board=?", filter.board.toLowerCase());
  if (filter.exchange) add("exchange ILIKE '%'||?||'%'", filter.exchange);
  if (filter.slug) add("slug=?", filter.slug);
  if (filter.from) add("open_date>=?::date", filter.from);
  if (filter.to) add("open_date<=?::date", filter.to);
  const clause = where.length ? " WHERE " + where.join(" AND ") : "";
  const total = Number(
    (await db.query<{ n: string }>("SELECT count(*) n FROM ipos" + clause, args)).rows[0]?.n ?? 0,
  );
  const order =
    (
      {
        name: "company_name",
        open: "open_date",
        close: "close_date",
        listing: "listing_date",
        price: "price_max",
        size: "issue_size",
      } as Record<string, string>
    )[filter.sort ?? "open"] ?? "open_date";
  const limit = filter.limit ?? 2000,
    page = filter.page ?? 1;
  const rows = (
    await db.query<Row>(
      `SELECT * FROM ipos${clause} ORDER BY ${order} ${filter.dir === "asc" ? "ASC" : "DESC"} NULLS LAST,slug LIMIT $${args.length + 1} OFFSET $${args.length + 2}`,
      [...args, limit, (page - 1) * limit],
    )
  ).rows;
  const ids = rows.map((r) => r["id"]);
  const tables = [
    "gmp_observations",
    "subscription_observations",
    "ipo_documents",
    "company_financials",
    "listing_results",
    "manual_corrections",
    "data_conflicts",
  ] as const;
  const loaded = await Promise.all(
    tables.map((t) =>
      ids.length
        ? db!.query<Row>(`SELECT * FROM ${t} WHERE ipo_id=ANY($1::uuid[])`, [ids])
        : Promise.resolve({ rows: [] }),
    ),
  );
  const by = (table: (typeof tables)[number], id: unknown) =>
    loaded[tables.indexOf(table)]!.rows.filter((r) => r["ipo_id"] === id);
  const items = rows.map((base) => {
    const id = base["id"],
      row = { ...base };
    const fieldSources: Ipo["fieldSources"] = {};
    for (const c of by("manual_corrections", id).sort(
      (a, b) => time(a["created_at"]) - time(b["created_at"]),
    )) {
      const field = String(c["field"]);
      row[field] = c["verification_status"] === "verified" ? c["corrected_value"] : null;
      fieldSources[field] = {
        sourceUrl: String(c["source_url"]),
        verifiedAt: c["verification_status"] === "verified" ? str(c["created_at"]) : null,
        status: String(c["verification_status"]),
      };
    }
    const historical = row["status"] === "listed" || row["status"] === "withdrawn",
      conflicts = by("data_conflicts", id).filter((c) => !c["resolved_at"]);
    for (const c of conflicts)
      if (
        [
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
        ].includes(String(c["field"]))
      )
        row[String(c["field"])] = null;
    const gmps = by("gmp_observations", id)
      .sort(
        (a, b) =>
          time(b["retrieved_at"]) - time(a["retrieved_at"]) ||
          time(b["observed_at"] ?? b["reported_date"]) -
            time(a["observed_at"] ?? a["reported_date"]),
      )
      .map((r) => ({
        ...meta(r, setting("GMP_STALE_HOURS", 24), historical),
        date: (str(r["observed_at"]) ?? str(r["reported_date"]) ?? "").slice(0, 10),
        gmp: Number(r["reported_gmp"]),
        reportedPercentage: num(r["reported_percentage"]),
      }));
    const allSubs = by("subscription_observations", id).sort(
      (a, b) =>
        Number(b["provider"] === "ipos_markets") - Number(a["provider"] === "ipos_markets") ||
        time(b["observed_at"] ?? b["reported_date"]) -
          time(a["observed_at"] ?? a["reported_date"]) ||
        time(b["retrieved_at"]) - time(a["retrieved_at"]),
    );
    const toSubValue = (r: Row): SubValue => {
      const category = String(r["category"]);
      return {
        ...meta(r, setting("SUBSCRIPTION_STALE_HOURS", 1), historical || r["is_final"] === true),
        category,
        venue: String(r["venue"]),
        basis: r["basis"] as SubValue["basis"],
        multiple: str(r["subscription_multiple"]),
        lowerBound: str(r["lower_bound_multiple"]),
        sharesBid: str(r["shares_bid"]),
        sharesOffered: str(r["shares_offered"]),
        final: r["is_final"] === true,
        disputed: conflicts.some((c) => c["field"] === "subscription:" + category),
      };
    };
    const subscriptionHistory = allSubs.map(toSubValue);
    const latest = new Map<string, SubValue>();
    for (const value of subscriptionHistory) {
      if (!latest.has(value.category)) latest.set(value.category, value);
    }
    const exact = (key: string) => {
      const s = latest.get(key);
      return s?.basis === "exact" && !s.disputed ? num(s.multiple) : null;
    };
    const l = by("listing_results", id).sort(
      (a, b) => time(b["retrieved_at"]) - time(a["retrieved_at"]),
    )[0];
    const crore = (k: string) => (row[k] == null ? null : Number(row[k]) / 1e7);
    return {
      id: String(id),
      fieldSources,
      slug: String(row["slug"]),
      name: String(row["company_name"]),
      symbol: String(row["nse_symbol"] ?? row["bse_symbol"] ?? ""),
      sector: String(row["sector"] ?? "Unavailable"),
      category: ({ mainboard: "Mainboard", sme: "SME", debt: "Debt" } as Record<string, Category>)[
        String(row["board"])
      ]!,
      exchange: String(row["exchange"] ?? "Unavailable"),
      status: (String(row["status"]).charAt(0).toUpperCase() +
        String(row["status"]).slice(1)) as Status,
      priceLow: num(row["price_min"]),
      priceHigh: num(row["price_max"]),
      lot: num(row["lot_size"]),
      issueSizeCr: crore("issue_size"),
      freshCr: crore("fresh_issue_amount"),
      ofsCr: crore("offer_for_sale_amount"),
      open: day(row["open_date"]),
      close: day(row["close_date"]),
      allotment: day(row["allotment_date"]),
      listing: day(row["listing_date"]),
      registrar: String(row["registrar"] ?? "Unavailable"),
      registrarUrl: str(row["registrar_url"]),
      leadManager: String(row["lead_manager"] ?? "Unavailable"),
      about: String(row["about"] ?? "Company disclosure has not been verified yet."),
      strengths: [],
      risks: [],
      gmp: gmps[0] ?? null,
      gmpHistory: gmps.filter((g) => g.date).sort((a, b) => a.date.localeCompare(b.date)),
      subscription: latest.size
        ? {
            qib: exact("QIB"),
            nii: exact("NII"),
            retail: exact("RETAIL"),
            employee: exact("EMPLOYEE"),
            total: exact("TOTAL"),
            overall: latest.get("TOTAL") ?? null,
            observations: [...latest.values()],
            history: filter.slug ? subscriptionHistory : [...latest.values()],
          }
        : null,
      listingPrice: l ? num(l["listing_price"]) : null,
      issuePrice: l ? num(l["issue_price"]) : null,
      currentPrice: null,
      listingSource: l ? meta(l, 0, true) : null,
      documents: by("ipo_documents", id)
        .filter((d) => d["verification_status"] === "verified")
        .map((d) => ({
          title: String(d["title"]),
          url: String(d["url"]),
          type: String(d["document_type"]),
          sourceOrganization: String(d["source_organization"]),
          filingDate: day(d["filing_date"]),
          verifiedAt: str(d["verified_at"]),
          lastCheckedAt: str(d["last_checked_at"]),
        })),
      financials: by("company_financials", id)
        .filter((f) => f["verification_status"] === "verified")
        .map((f) => {
          const amount = (k: string) =>
            f[k] == null ? null : Number(f[k]) / (f["units"] === "INR" ? 1e7 : 1);
          return {
            year: String(f["period"]),
            revenue: amount("revenue"),
            ebitda: amount("ebitda"),
            profit: amount("profit"),
            netWorth: amount("net_worth"),
            borrowings: amount("borrowings"),
            sourceUrl: String(f["source_url"]),
            verifiedAt: str(f["verified_at"]),
          };
        }),
      sourceUrl: String(row["primary_source_url"]),
      observedAt: str(row["last_observed_at"]),
      quality: freshness(
        str(row["last_observed_at"]),
        setting("MASTER_STALE_HOURS", 48),
        historical,
      ),
      review:
        conflicts.length > 0 || Object.values(fieldSources).some((v) => v.status === "review"),
    } satisfies Ipo;
  });
  const sources = (
    await db.query<Row>(
      "SELECT provider,status,last_success_at,last_reported_at,disclaimer FROM data_sources",
    )
  ).rows.map((r) => ({
    provider: String(r["provider"]),
    status: String(r["status"]),
    lastSuccessAt: str(r["last_success_at"]),
    lastReportedAt: str(r["last_reported_at"]),
    disclaimer: str(r["disclaimer"]),
  }));
  return {
    items,
    total,
    available: true,
    error: null,
    sources,
    generatedAt: new Date().toISOString(),
  };
}
export async function safeSnapshot(): Promise<MarketSnapshot> {
  try {
    return await readMarket();
  } catch {
    return {
      items: [],
      total: 0,
      available: false,
      error: "Market data temporarily unavailable. Please try again.",
      sources: [],
      generatedAt: new Date().toISOString(),
    };
  }
}
