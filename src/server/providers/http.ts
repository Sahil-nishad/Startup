import type { Db } from "../db";
import { ServiceError, setting } from "../config";
const hosts = new Set(["www.xflot.com", "ipos.markets", "www.ipoguru.in"]);
export async function providerJson(
  db: Db,
  provider: string,
  url: string,
  headers: Record<string, string> = {},
  fetcher: typeof fetch = fetch,
): Promise<unknown> {
  const parsed = new URL(url);
  if (
    parsed.protocol !== "https:" ||
    !hosts.has(parsed.hostname) ||
    parsed.username ||
    parsed.password
  )
    throw new ServiceError("UNSAFE_PROVIDER_URL", 400);
  await db.query("INSERT INTO data_sources(provider) VALUES($1) ON CONFLICT DO NOTHING", [
    provider,
  ]);
  for (let attempt = 0; attempt < 3; attempt++) {
    const gap = provider === "xflot" ? 61000 : provider === "ipoguru" ? 61000 : 1000;
    const reserved = await db.query(
      `UPDATE data_sources SET last_attempt_at=now(),last_request_at=now(),next_allowed_at=now()+($2 * interval '1 millisecond') WHERE provider=$1 AND (next_allowed_at IS NULL OR next_allowed_at<=now()) RETURNING provider`,
      [provider, gap],
    );
    if (!reserved.rows.length) throw new ServiceError("PROVIDER_COOLDOWN", 429);
    const cached = (
      await db.query<{ etag: string | null; modified: string | null; payload: unknown }>(
        "SELECT * FROM http_cache WHERE url=$1",
        [url],
      )
    ).rows[0];
    const started = Date.now();
    try {
      const response = await fetcher(url, {
        headers: {
          Accept: "application/json",
          ...headers,
          ...(cached?.etag ? { "If-None-Match": cached.etag } : {}),
          ...(cached?.modified ? { "If-Modified-Since": cached.modified } : {}),
        },
        redirect: "error",
        signal: AbortSignal.timeout(setting("PROVIDER_TIMEOUT_MS", 15000)),
      });
      if (response.status === 429) {
        const retry = response.headers.get("retry-after");
        const seconds =
          retry && /^\d+$/.test(retry)
            ? Number(retry)
            : retry
              ? Math.max(60, (Date.parse(retry) - Date.now()) / 1000)
              : 300;
        await db.query(
          `UPDATE data_sources SET next_allowed_at=now()+($2 * interval '1 second') WHERE provider=$1`,
          [provider, Number.isFinite(seconds) ? Math.min(86400, seconds) : 300],
        );
        throw new ServiceError("UPSTREAM_RATE_LIMIT", 429);
      }
      if (response.status !== 304 && !response.ok)
        throw new ServiceError("UPSTREAM_HTTP_" + response.status);
      let payload: unknown;
      if (response.status === 304 && cached) payload = cached.payload;
      else {
        const text = await response.text();
        if (text.length > 8_000_000) throw new ServiceError("UPSTREAM_PAYLOAD_TOO_LARGE");
        try {
          payload = JSON.parse(text);
        } catch {
          throw new ServiceError("UPSTREAM_INVALID_JSON");
        }
        await db.query(
          "INSERT INTO http_cache(url,provider,etag,modified,payload) VALUES($1,$2,$3,$4,$5) ON CONFLICT(url) DO UPDATE SET etag=excluded.etag,modified=excluded.modified,payload=excluded.payload,retrieved_at=now()",
          [
            url,
            provider,
            response.headers.get("etag"),
            response.headers.get("last-modified"),
            JSON.stringify(payload),
          ],
        );
      }
      await db.query(`UPDATE data_sources SET request_latency_ms=$2 WHERE provider=$1`, [
        provider,
        Date.now() - started,
      ]);
      return payload;
    } catch (error) {
      const code = error instanceof ServiceError ? error.code : "UPSTREAM_CONNECTION_FAILED";
      await db.query(
        `UPDATE data_sources SET status='error',error_code=$2,failures=failures+1,next_allowed_at=CASE WHEN failures>=2 THEN now()+interval '15 minutes' ELSE next_allowed_at END WHERE provider=$1`,
        [provider, code],
      );
      if (
        provider === "xflot" ||
        provider === "ipoguru" ||
        code === "UPSTREAM_RATE_LIMIT" ||
        attempt === 2
      )
        throw new ServiceError(code);
      await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 1100 + Math.random() * 400));
    }
  }
  throw new ServiceError("UPSTREAM_UNAVAILABLE");
}
