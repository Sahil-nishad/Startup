import { randomUUID } from "node:crypto";
import type { Db } from "./db";
import { getDb } from "./db";
import { setting, ServiceError } from "./config";
import { XflotProvider } from "./providers/xflot";
import { IposMarketsSubscriptionProvider, manifestSchema } from "./providers/ipos-markets";
import { persistIssue, rejected } from "./repository";
import type { NormalizedIssue } from "../lib/market/models";
export const jobs = [
  "auto",
  "master",
  "gmp",
  "history",
  "subscription",
  "documents",
  "listing",
  "health",
] as const;
export type Job = (typeof jobs)[number];
export async function sync(job: Job = "auto", db?: Db) {
  db ??= await getDb();
  const owner = randomUUID();
  const lock = await db.query(
    `INSERT INTO sync_locks(name,owner,expires_at) VALUES('market-sync',$1,now()+interval '5 minutes') ON CONFLICT(name) DO UPDATE SET owner=excluded.owner,expires_at=excluded.expires_at WHERE sync_locks.expires_at<now() RETURNING owner`,
    [owner],
  );
  if (!lock.rows.length) throw new ServiceError("SYNC_ALREADY_RUNNING", 409);
  const run = (
    await db.query<{ id: string }>("INSERT INTO sync_runs(job) VALUES($1) RETURNING id", [job])
  ).rows[0]!.id;
  const stats = { fetched: 0, accepted: 0, rejected: 0, changed: 0 };
  const errors: string[] = [];
  const notes: string[] = [];
  const save = async (items: NormalizedIssue[]) => {
    stats.fetched += items.length;
    for (const item of items) {
      try {
        const result = await persistIssue(db!, item);
        stats.accepted++;
        if (result.changed) stats.changed++;
      } catch (e) {
        stats.rejected++;
        const code = e instanceof Error && "code" in e ? String(e.code) : "IDENTITY_REVIEW";
        await rejected(db!, item.provider, item.raw, "PERSISTENCE_" + code);
      }
    }
  };
  const success = async (provider: string, disclaimer: string, reported: string | null) =>
    db!.query(
      `UPDATE data_sources SET status='ok',last_success_at=now(),last_reported_at=COALESCE($3,last_reported_at),failures=0,error_code=NULL,disclaimer=$2 WHERE provider=$1`,
      [provider, disclaimer, reported],
    );
  try {
    const x = new XflotProvider(db);
    if (x.enabled && ["auto", "master", "gmp", "history", "listing"].includes(job)) {
      try {
        const state = (
          await db.query<{ last_master_at: string | null }>(
            "SELECT last_master_at FROM data_sources WHERE provider='xflot'",
          )
        ).rows[0];
        const due =
          !state?.last_master_at ||
          Date.now() - new Date(state.last_master_at).getTime() >
            setting("MASTER_SYNC_MINUTES", 30) * 60000;
        const master = job === "master" || job === "listing" || (job === "auto" && due);
        let payload: unknown;
        let selected: { id: string; slug: string } | undefined;
        if (master) payload = await x.fetchMaster();
        else {
          selected = (
            await db.query<{ id: string; slug: string }>(
              `SELECT i.id,i.slug FROM ipos i LEFT JOIN detail_refresh d ON d.ipo_id=i.id AND d.provider='xflot' WHERE i.primary_source_url LIKE 'https://www.xflot.com/%' AND (d.last_attempt_at IS NULL OR d.last_attempt_at<now()-($1 * interval '1 minute')) ORDER BY CASE WHEN i.status IN ('open','upcoming','closed') THEN 0 ELSE 1 END,d.last_attempt_at NULLS FIRST LIMIT 1`,
              [
                job === "history"
                  ? setting("HISTORY_SYNC_MINUTES", 1440)
                  : setting("GMP_SYNC_MINUTES", 30),
              ],
            )
          ).rows[0];
          if (selected) {
            await db.query(
              `INSERT INTO detail_refresh(ipo_id,provider,last_attempt_at) VALUES($1,'xflot',now()) ON CONFLICT(ipo_id,provider) DO UPDATE SET last_attempt_at=now()`,
              [selected.id],
            );
            payload = await x.fetchDetail(selected.slug);
          }
        }
        if (payload) {
          const items = x.normalize(payload, !master);
          await save(items);
          for (const bad of x.rejected) {
            stats.fetched++;
            stats.rejected++;
            await rejected(db, "xflot", bad.raw, bad.reason);
          }
          if (items.length === 0) throw new ServiceError("XFLOT_NO_VALID_RECORDS");
          await success(
            "xflot",
            items[0]!.disclaimer,
            items
              .map((i) => i.master.last_observed_at)
              .filter(Boolean)
              .sort()
              .at(-1) ?? null,
          );
          if (master)
            await db.query("UPDATE data_sources SET last_master_at=now() WHERE provider='xflot'");
          if (selected)
            await db.query(
              "UPDATE detail_refresh SET last_success_at=now() WHERE ipo_id=$1 AND provider='xflot'",
              [selected.id],
            );
          if (master && items.length === 200)
            notes.push("XFLOT_LIST_LIMIT_REACHED: archive coverage may be incomplete");
        }
      } catch (e) {
        const code = e instanceof ServiceError ? e.code : "XFLOT_SCHEMA_ERROR";
        errors.push(code);
        await db.query("UPDATE data_sources SET status='error',error_code=$2 WHERE provider=$1", [
          "xflot",
          code,
        ]);
      }
    }
    const sub = new IposMarketsSubscriptionProvider(db);
    if (sub.enabled && ["auto", "subscription"].includes(job)) {
      try {
        const state = (
          await db.query<{ last_master_at: string | null; last_manifest: unknown }>(
            "SELECT last_master_at,last_manifest FROM data_sources WHERE provider='ipos_markets'",
          )
        ).rows[0];
        const due =
          !state?.last_master_at ||
          Date.now() - new Date(state.last_master_at).getTime() >
            setting("SUBSCRIPTION_SYNC_MINUTES", 30) * 60000;
        const payload = due ? await sub.fetchMaster() : state?.last_manifest;
        const manifest = manifestSchema.parse(payload);
        if (due)
          await db.query(
            "UPDATE data_sources SET last_master_at=now(),last_manifest=$1 WHERE provider='ipos_markets'",
            [JSON.stringify(payload)],
          );
        const refresh = (
          await db.query<{ external_id: string; last_success_at: string | null }>(
            "SELECT e.external_id,d.last_success_at FROM issue_identifiers e LEFT JOIN detail_refresh d ON d.ipo_id=e.ipo_id AND d.provider=e.provider WHERE e.provider='ipos_markets'",
          )
        ).rows;
        const times = new Map(
          refresh.map((r) => [
            r.external_id,
            r.last_success_at ? new Date(r.last_success_at).getTime() : 0,
          ]),
        );
        // Bounded backfill, active issues first; no archive fan-out on a page view.
        const candidates = [...manifest.issues]
          .sort((a, b) => {
            const priority = (s: string) => (s === "open" ? 0 : s === "upcoming" ? 1 : 2);
            return (
              priority(a.status) - priority(b.status) ||
              (times.get(a.symbol ?? a.slug) ?? 0) - (times.get(b.symbol ?? b.slug) ?? 0)
            );
          })
          .filter(
            (i) =>
              Date.now() - (times.get(i.symbol ?? i.slug) ?? 0) >
              setting("SUBSCRIPTION_SYNC_MINUTES", 30) * 60000,
          )
          .slice(0, Math.min(20, setting("SUBSCRIPTION_BATCH_SIZE", 20)));
        for (const issue of candidates) {
          await db.query(
            "UPDATE sync_locks SET expires_at=now()+interval '5 minutes' WHERE name='market-sync' AND owner=$1",
            [owner],
          );
          await new Promise((r) => setTimeout(r, 1100));
          try {
            const items = sub.normalize(await sub.fetchDetail(issue.symbol ?? issue.slug));
            await save(items);
            const id = (
              await db.query<{ ipo_id: string }>(
                "SELECT ipo_id FROM issue_identifiers WHERE provider=$1 AND external_id=$2",
                ["ipos_markets", issue.symbol ?? issue.slug],
              )
            ).rows[0]?.ipo_id;
            if (id)
              await db.query(
                "INSERT INTO detail_refresh(ipo_id,provider,last_attempt_at,last_success_at) VALUES($1,'ipos_markets',now(),now()) ON CONFLICT(ipo_id,provider) DO UPDATE SET last_attempt_at=now(),last_success_at=now()",
                [id],
              );
            await success("ipos_markets", items[0]!.disclaimer, items[0]!.master.last_observed_at);
          } catch (e) {
            errors.push(e instanceof ServiceError ? e.code : "SUBSCRIPTION_RECORD_REJECTED");
            stats.rejected++;
          }
        }
      } catch (e) {
        const code = e instanceof ServiceError ? e.code : "IPOS_MARKETS_SCHEMA_ERROR";
        errors.push(code);
        await db.query("UPDATE data_sources SET status='error',error_code=$2 WHERE provider=$1", [
          "ipos_markets",
          code,
        ]);
      }
    }
    if (job === "documents")
      notes.push(
        "Documents and financials require authenticated evidence review; no official-site scraper runs.",
      );
    if (job === "health")
      notes.push(
        "Database reachable; inspect provider last_success_at and observation freshness separately.",
      );
    const status =
      errors.length || stats.rejected ? (stats.accepted ? "partial" : "failed") : "success";
    await db.query(
      "UPDATE sync_runs SET finished_at=now(),status=$2,fetched=$3,accepted=$4,rejected=$5,changed=$6,error_code=$7,details=$8 WHERE id=$1",
      [
        run,
        status,
        stats.fetched,
        stats.accepted,
        stats.rejected,
        stats.changed,
        errors[0] ?? null,
        JSON.stringify({ errors, notes }),
      ],
    );
    return { id: run, status, ...stats, errors, notes };
  } catch (e) {
    await db.query(
      "UPDATE sync_runs SET finished_at=now(),status='failed',error_code='SYNC_FAILED' WHERE id=$1",
      [run],
    );
    throw e;
  } finally {
    await db.query("DELETE FROM sync_locks WHERE name='market-sync' AND owner=$1", [owner]);
  }
}
