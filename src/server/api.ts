import { randomUUID } from "node:crypto";
import { z } from "zod";
import { getDb } from "./db";
import { readMarket } from "./read";
import { authorize } from "./auth";
import { ManualVerifiedDataProvider } from "./admin";
import { sync, jobs } from "./sync";
import { fingerprint } from "./repository";
import { ServiceError, setting } from "./config";
import { dateOnly } from "../lib/market/rules";
const filters = z
  .object({
    q: z.string().max(100).optional(),
    status: z.enum(["upcoming", "open", "closed", "listed", "withdrawn"]).optional(),
    board: z.enum(["mainboard", "sme", "debt"]).optional(),
    exchange: z.enum(["NSE", "BSE"]).optional(),
    from: z
      .string()
      .refine((v) => {
        try {
          return !!dateOnly(v);
        } catch {
          return false;
        }
      })
      .optional(),
    to: z
      .string()
      .refine((v) => {
        try {
          return !!dateOnly(v);
        } catch {
          return false;
        }
      })
      .optional(),
    sort: z.enum(["name", "open", "close", "listing", "price", "size"]).optional(),
    dir: z.enum(["asc", "desc"]).optional(),
    page: z.coerce.number().int().min(1).max(10000).default(1),
    limit: z.coerce.number().int().min(1).max(2000).default(200),
  })
  .strict();
let windowStart = 0,
  requests = 0;
export async function handleApi(request: Request): Promise<Response> {
  const requestId = randomUUID();
  const json = (data: unknown, status = 200, cache = false) => {
    const etag =
      '"' +
      fingerprint(
        JSON.parse(
          JSON.stringify(data, (key, value) => (key === "generatedAt" ? undefined : value)),
        ),
      ) +
      '"';
    const headers = {
      "content-type": "application/json; charset=utf-8",
      "x-request-id": requestId,
      "x-content-type-options": "nosniff",
      "cache-control": cache ? "public, max-age=0, must-revalidate" : "no-store",
      ...(cache ? { etag } : {}),
    };
    if (cache && request.headers.get("if-none-match") === etag)
      return new Response(null, { status: 304, headers });
    return new Response(
      JSON.stringify(status >= 400 ? { error: { code: data, requestId } } : { data, requestId }),
      { status, headers },
    );
  };
  try {
    const url = new URL(request.url),
      path = url.pathname.replace(/\/$/, "");
    if (Date.now() - windowStart > 60000) {
      windowStart = Date.now();
      requests = 0;
    }
    if (++requests > setting("API_REQUESTS_PER_MINUTE", 600))
      throw new ServiceError("RATE_LIMITED", 429);
    if (path.startsWith("/api/admin/")) {
      const origin = request.headers.get("origin");
      if (origin && origin !== new URL(process.env["PUBLIC_APP_URL"] ?? request.url).origin)
        throw new ServiceError("ORIGIN_NOT_ALLOWED", 403);
      let identity: string;
      if (path === "/api/admin/sync") {
        try {
          identity = authorize(request, "sync");
        } catch {
          identity = authorize(request, "admin");
        }
      } else identity = authorize(request, "admin");
      if (request.method === "POST") {
        const body = await request.text();
        if (body.length > 32000) throw new ServiceError("PAYLOAD_TOO_LARGE", 413);
        let input: unknown;
        try {
          input = JSON.parse(body);
        } catch {
          throw new ServiceError("INVALID_JSON", 400);
        }
        if (path === "/api/admin/sync") {
          const { job } = z.object({ job: z.enum(jobs).default("auto") }).parse(input);
          return json(await sync(job));
        }
        if (path === "/api/admin/corrections")
          return json(await new ManualVerifiedDataProvider(await getDb()).correct(input, identity));
      }
      if (request.method === "GET") {
        const db = await getDb();
        if (path === "/api/admin/health")
          return json({
            rejections: (
              await db.query(
                "SELECT provider,reason,count(*) AS count FROM source_observations WHERE validation_status='rejected' GROUP BY provider,reason",
              )
            ).rows,
            sources: (await db.query("SELECT * FROM data_sources")).rows.map((r) => {
              const { last_manifest: _, ...safe } = r;
              return safe;
            }),
            runs: (await db.query("SELECT * FROM sync_runs ORDER BY started_at DESC LIMIT 50"))
              .rows,
            conflicts: (
              await db.query(
                "SELECT * FROM data_conflicts WHERE resolved_at IS NULL ORDER BY created_at DESC LIMIT 200",
              )
            ).rows,
          });
        if (path.startsWith("/api/admin/ipos/")) {
          const slug = decodeURIComponent(path.split("/").at(-1)!);
          const ipo = (await readMarket({ slug })).items[0];
          if (!ipo) throw new ServiceError("IPO_NOT_FOUND", 404);
          const histories: Record<string, unknown> = {};
          for (const table of [
            "source_observations",
            "gmp_observations",
            "subscription_observations",
            "manual_corrections",
          ])
            histories[table] = (
              await db.query(`SELECT * FROM ${table} WHERE ipo_id=$1 LIMIT 2000`, [ipo.id])
            ).rows;
          return json({ ipo, histories });
        }
      }
      throw new ServiceError("NOT_FOUND", 404);
    }
    if (request.method !== "GET") throw new ServiceError("METHOD_NOT_ALLOWED", 405);
    const query = filters.parse(Object.fromEntries(url.searchParams));
    const detail =
      /^\/api\/ipos\/([a-zA-Z0-9-]+)(?:\/(gmp(?:\/history)?|subscription|documents))?$/.exec(path);
    if (detail) {
      const item = (await readMarket({ slug: detail[1]! })).items[0];
      if (!item) throw new ServiceError("IPO_NOT_FOUND", 404);
      return json(
        detail[2] === "gmp/history"
          ? item.gmpHistory
          : detail[2] === "gmp"
            ? item.gmp
            : detail[2] === "subscription"
              ? item.subscription
              : detail[2] === "documents"
                ? item.documents
                : item,
        200,
        true,
      );
    }
    if (
      ![
        "/api/ipos",
        "/api/gmp",
        "/api/subscription",
        "/api/calendar",
        "/api/listing-performance",
        "/api/data-status",
      ].includes(path)
    )
      throw new ServiceError("NOT_FOUND", 404);
    const snapshot = await readMarket(query);
    if (path === "/api/data-status")
      return json(
        {
          available: true,
          sources: snapshot.sources,
          policy: {
            gmpHours: setting("GMP_STALE_HOURS", 24),
            subscriptionHours: setting("SUBSCRIPTION_STALE_HOURS", 1),
            masterHours: setting("MASTER_STALE_HOURS", 48),
          },
          coverage: { count: snapshot.total, limitedByProviders: true },
        },
        200,
        true,
      );
    return json(snapshot, 200, true);
  } catch (e) {
    return json(
      e instanceof ServiceError
        ? e.code
        : e instanceof z.ZodError
          ? "INVALID_REQUEST"
          : "DATA_UNAVAILABLE",
      e instanceof ServiceError ? e.status : e instanceof z.ZodError ? 400 : 503,
    );
  }
}
