// @vitest-environment node
// Explicit synthetic fixtures; never imported by the application.
import { beforeAll, afterAll, describe, expect, it, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { embeddedDb, migrate, getDb, type Db } from "../server/db";
import { XflotProvider } from "../server/providers/xflot";
import { IposMarketsSubscriptionProvider } from "../server/providers/ipos-markets";
import { providerJson } from "../server/providers/http";
import { persistIssue } from "../server/repository";
import { readMarket } from "../server/read";
import { ManualVerifiedDataProvider } from "../server/admin";
import { handleApi } from "../server/api";
import { sync } from "../server/sync";
vi.mock("../server/db", async (original) => ({
  ...(await original<typeof import("../server/db")>()),
  getDb: vi.fn(),
}));
let pg: PGlite, db: Db;
const row = {
  slug: "test-company",
  name: "Test Company Limited",
  board: "MAINBOARD",
  status: "OPEN",
  priceMin: "95",
  priceMax: "100",
  lotSize: 10,
  issueSizeCr: "10",
  openDate: "2026-10-19",
  closeDate: "2026-10-22",
  listingDate: "2026-10-28",
  symbol: "TEST",
  exchange: "NSE",
  lastGmp: "25",
  lastGmpPct: "25",
  updatedAt: "2026-10-19T10:00:00Z",
};
function normalized(overrides: Record<string, unknown> = {}) {
  return new XflotProvider(db).normalize({
    ok: true,
    disclaimer: "Test attribution",
    ipos: [{ ...row, ...overrides }],
  })[0]!;
}
beforeAll(async () => {
  pg = new PGlite();
  db = embeddedDb(pg);
  await migrate(db);
  vi.mocked(getDb).mockResolvedValue(db);
}, 30000);
afterAll(async () => {
  await pg.close();
});
describe("provider schemas", () => {
  it("preserves missing GMP time instead of retrieval time", () =>
    expect(normalized().gmp[0]?.observedAt).toBeNull());
  it("rejects malformed records without aborting all good rows", () => {
    const p = new XflotProvider(db);
    expect(
      p.normalize({ ok: true, disclaimer: "test", ipos: [row, { ...row, lotSize: -3 }] }),
    ).toHaveLength(1);
    expect(p.rejected).toHaveLength(1);
  });
  it("flags contradictory GMP percentage", () =>
    expect(normalized({ lastGmpPct: 300 }).gmp[0]?.validation).toBe("review"));
  it.each(["lower_bound", "bids_only", "exact"] as const)("keeps %s basis", (basis) => {
    const x = new IposMarketsSubscriptionProvider(db).normalize({
      slug: "test",
      symbol: "TEST",
      name: "Test Company",
      board: "mainboard",
      status: "open",
      as_of: "2026-10-19",
      venue: "nse",
      final: false,
      basis,
      total_times: basis === "exact" ? 2 : null,
      lower_bound_times: basis === "lower_bound" ? 2 : null,
      total_bid: 200,
      total_offered: null,
      categories: { RII: { bid: 200, offered: null, times: null } },
    })[0]!;
    expect(x.subscriptions[0]?.basis).toBe(basis);
    expect(x.subscriptions[0]?.observedAt).toBeNull();
    expect(x.subscriptions[1]?.basis).toBe("bids_only");
  });
});
describe("PostgreSQL persistence", () => {
  it("does not report an empty database as zero market IPOs", async () => {
    const snapshot = await readMarket({}, db);
    expect(snapshot.available).toBe(true);
    expect(snapshot.items).toEqual([]);
    expect(snapshot.total).toBeNull();
  });
  it("migration is repeatable", async () => {
    await migrate(db);
    expect((await db.query("SELECT * FROM schema_migrations")).rows).toHaveLength(2);
  });
  it("does not duplicate IPO or observations on repeat", async () => {
    await persistIssue(db, normalized());
    await persistIssue(db, normalized());
    expect((await db.query("SELECT * FROM ipos")).rows).toHaveLength(1);
    expect((await db.query("SELECT * FROM gmp_observations")).rows).toHaveLength(1);
  });
  it("retains old GMP after an update", async () => {
    await persistIssue(db, normalized({ lastGmp: 30, lastGmpPct: 30 }));
    expect((await db.query("SELECT * FROM gmp_observations")).rows).toHaveLength(2);
  });
  it("records implausible changes and preserves previous value", async () => {
    await persistIssue(db, normalized({ priceMax: 1000 }));
    expect((await db.query("SELECT * FROM data_conflicts")).rows.length).toBeGreaterThan(0);
    expect(Number((await db.query("SELECT price_max FROM ipos")).rows[0]?.["price_max"])).toBe(100);
  });
  it("enforces database date and price constraints", async () => {
    await expect(db.query("UPDATE ipos SET close_date='2020-01-01'")).rejects.toThrow();
    await expect(db.query("UPDATE ipos SET price_max=-1")).rejects.toThrow();
  });
  it("manual correction survives later sync with evidence audit", async () => {
    const id = String((await db.query("SELECT id FROM ipos")).rows[0]?.["id"]);
    await new ManualVerifiedDataProvider(db).correct(
      {
        ipoId: id,
        field: "price_max",
        value: "110",
        reason: "Verified against issuer document",
        sourceUrl: "https://www.sebi.gov.in/test",
        verification: "verified",
      },
      "test-admin",
    );
    await persistIssue(db, normalized());
    expect((await readMarket({}, db)).items[0]?.priceHigh).toBe(110);
    expect((await db.query("SELECT * FROM manual_corrections")).rows).toHaveLength(1);
  });
  it("supports SQL search/filter/pagination", async () => {
    await persistIssue(
      db,
      normalized({ slug: "second-test", name: "Second Test Limited", symbol: "SECOND" }),
    );
    expect((await readMarket({ q: "Second", limit: 1 }, db)).total).toBe(1);
    expect((await readMarket({ board: "sme" }, db)).items).toHaveLength(0);
    expect((await readMarket({ limit: 1, page: 2 }, db)).items).toHaveLength(1);
  });
  it("keeps genuinely absent fields null", async () => {
    expect((await readMarket({}, db)).items[0]?.currentPrice).toBeNull();
  });
  it("keeps date-only values identical across database drivers", async () => {
    expect((await readMarket({ slug: "test-company" }, db)).items[0]?.close).toBe("2026-10-22");
  });
  it("protects the correction audit from edits", async () => {
    await expect(db.query("UPDATE manual_corrections SET reason='tampered'")).rejects.toThrow(
      "append-only",
    );
  });
});
describe("internal HTTP API", () => {
  it("rejects unauthenticated administration", async () =>
    expect((await handleApi(new Request("http://localhost/api/admin/health"))).status).toBe(401));
  it("rejects missing sync secret", async () =>
    expect(
      (
        await handleApi(
          new Request("http://localhost/api/admin/sync", { method: "POST", body: "{}" }),
        )
      ).status,
    ).toBe(401));
  it("rejects invalid query and invalid dates", async () => {
    expect((await handleApi(new Request("http://localhost/api/ipos?limit=-1"))).status).toBe(400);
    expect((await handleApi(new Request("http://localhost/api/ipos?from=2026-02-30"))).status).toBe(
      400,
    );
  });
  it("supports ETags and invalidates after an update", async () => {
    const url = "http://localhost/api/ipos";
    const first = await handleApi(new Request(url));
    const etag = first.headers.get("etag")!;
    expect((await handleApi(new Request(url, { headers: { "If-None-Match": etag } }))).status).toBe(
      304,
    );
    await persistIssue(db, normalized({ lastGmp: 35, lastGmpPct: 35 }));
    expect((await handleApi(new Request(url, { headers: { "If-None-Match": etag } }))).status).toBe(
      200,
    );
  });
  it("exposes dashboard and health while treating empty coverage as unknown", async () => {
    const dashboard = await handleApi(new Request("http://localhost/api/dashboard?limit=1"));
    expect(dashboard.status).toBe(200);
    expect((await dashboard.json()).data).toHaveProperty("items");
    const health = await handleApi(new Request("http://localhost/api/health"));
    expect(health.status).toBe(200);
    expect((await health.json()).data.coverage).toMatchObject({
      complete: false,
      limitedByProviders: true,
    });
    const status = await handleApi(new Request("http://localhost/api/data-status"));
    const coverage = (await status.json()).data.coverage;
    expect(coverage).toMatchObject({ complete: false, limitedByProviders: true });
  });
  it("returns safe not found", async () =>
    expect((await handleApi(new Request("http://localhost/api/ipos/no-such-issue"))).status).toBe(
      404,
    ));
});
describe("provider resilience", () => {
  it("retries a transient failure with bounded backoff", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response("{}", { status: 503 }))
      .mockResolvedValueOnce(new Response('{"ok":true}', { status: 200 }));
    expect(
      await providerJson(db, "retry_test", "https://ipos.markets/retry-test", {}, fetcher),
    ).toEqual({ ok: true });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it("restricts outbound hosts", async () => {
    await expect(providerJson(db, "test", "http://localhost/secrets")).rejects.toThrow(
      "UNSAFE_PROVIDER_URL",
    );
  });
  it("preserves data and enforces Xflot cooldown after failure", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response("{}", { status: 503 }));
    await expect(
      providerJson(db, "xflot", "https://www.xflot.com/test", {}, fetcher),
    ).rejects.toThrow("UPSTREAM_HTTP_503");
    await expect(
      providerJson(db, "xflot", "https://www.xflot.com/test", {}, fetcher),
    ).rejects.toThrow("PROVIDER_COOLDOWN");
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect((await readMarket({}, db)).total).toBe(2);
  });
  it("honors upstream 429 without immediate retry", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response("{}", { status: 429, headers: { "retry-after": "120" } }));
    await expect(
      providerJson(db, "ipos_markets", "https://ipos.markets/test", {}, fetcher),
    ).rejects.toThrow("UPSTREAM_RATE_LIMIT");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("prevents overlapping syncs", async () => {
    await db.query(
      "INSERT INTO sync_locks VALUES('market-sync',gen_random_uuid(),now()+interval '5 minutes')",
    );
    await expect(sync("health", db)).rejects.toThrow("SYNC_ALREADY_RUNNING");
    await db.query("DELETE FROM sync_locks");
  });
});
