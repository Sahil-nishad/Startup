import { createHash } from "node:crypto";
import type { Db } from "./db";
import type { NormalizedIssue } from "../lib/market/models";
import { changedImplausibly } from "../lib/market/rules";
export const fingerprint = (value: unknown) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");
export async function rejected(db: Db, provider: string, raw: unknown, reason: string) {
  await db.query(
    "INSERT INTO source_observations(provider,fingerprint,payload,validation_status,reason) VALUES($1,$2,$3,'rejected',$4) ON CONFLICT(fingerprint) DO UPDATE SET reason=excluded.reason WHERE source_observations.validation_status='rejected'",
    [provider, fingerprint([provider, raw]), JSON.stringify(raw), reason],
  );
}
export async function conflict(
  db: Db,
  id: string,
  field: string,
  previous: unknown,
  incoming: unknown,
  provider: string,
) {
  await db.query(
    "INSERT INTO data_conflicts(ipo_id,field,previous_value,incoming_value,provider,fingerprint) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING",
    [
      id,
      field,
      JSON.stringify(previous),
      JSON.stringify(incoming),
      provider,
      fingerprint([id, field, previous, incoming, provider]),
    ],
  );
  await db.query("UPDATE ipos SET verification_status='review' WHERE id=$1", [id]);
}
export async function persistIssue(
  db: Db,
  issue: NormalizedIssue,
): Promise<{ id: string; changed: boolean }> {
  return db.transaction(async (tx) => {
    const m = issue.master;
    let existing = (
      await tx.query<Record<string, unknown>>(
        "SELECT i.* FROM ipos i JOIN issue_identifiers e ON e.ipo_id=i.id WHERE e.provider=$1 AND e.external_id=$2",
        [issue.provider, issue.externalId],
      )
    ).rows[0];
    // A provider can rotate its internal ID while keeping the public issue slug.
    // Reuse that issue before attempting an insert so a refresh cannot create a
    // duplicate row or lose the new observation to a unique-key rejection.
    if (!existing)
      existing = (
        await tx.query<Record<string, unknown>>("SELECT * FROM ipos WHERE slug=$1", [m.slug])
      ).rows[0];
    if (!existing) {
      const candidates = (
        await tx.query<Record<string, unknown>>(
          `SELECT * FROM ipos WHERE board=$1 AND (normalized_company_name=$2 OR ($3::text IS NOT NULL AND nse_symbol=$3)) AND ($4::date IS NULL OR open_date IS NULL OR open_date=$4)`,
          [m.board, m.normalized_company_name, m.nse_symbol, m.open_date],
        )
      ).rows;
      if (candidates.length > 1) throw new Error("AMBIGUOUS_ISSUE_IDENTITY");
      existing = candidates[0];
    }
    let id: string;
    if (!existing) {
      const columns = Object.keys(m);
      const identity = fingerprint([m.normalized_company_name, m.board, m.open_date]);
      const result = await tx.query<{ id: string }>(
        `INSERT INTO ipos(identity_key,${columns.join(",")}) VALUES($1,${columns.map((_, i) => "$" + (i + 2)).join(",")}) RETURNING id`,
        [identity, ...Object.values(m)],
      );
      id = result.rows[0]!.id;
    } else {
      id = String(existing["id"]);
      const protectedFields = new Set(
        (
          await tx.query<{ field: string }>(
            "SELECT DISTINCT field FROM manual_corrections WHERE ipo_id=$1",
            [id],
          )
        ).rows.map((r) => r.field),
      );
      // Provider master values are never silently replaced by another provider.
      // Later nulls do not erase populated columns. Manual corrections overlay reads.
      const adoptMaster =
        issue.provider === "xflot" &&
        String(existing["primary_source_url"]).startsWith("https://ipos.markets/");
      const samePrimary =
        adoptMaster ||
        String(existing["primary_source_url"]).startsWith(new URL(m.primary_source_url).origin);
      const changes: Record<string, unknown> = {};
      if (adoptMaster) changes["primary_source_url"] = m.primary_source_url;
      for (const [field, value] of Object.entries(m)) {
        if (protectedFields.has(field)) continue;
        if (
          ["slug", "primary_source_url", "normalized_company_name", "company_name"].includes(
            field,
          ) ||
          value === null
        )
          continue;
        const old = existing[field];
        if (old === null || old === undefined) {
          changes[field] = value;
          continue;
        }
        if (
          String(old) === String(value) ||
          (typeof old === "object" && old instanceof Date && old.toISOString() === value)
        )
          continue;
        const numericField = ["price_min", "price_max", "lot_size", "issue_size"].includes(field);
        const mismatch =
          !samePrimary && !["last_observed_at", "status", "exchange"].includes(field);
        if (mismatch || (numericField && changedImplausibly(String(old), value))) {
          await conflict(tx, id, field, old, value, issue.provider);
          continue;
        }
        if (samePrimary) changes[field] = value;
      }
      const keys = Object.keys(changes);
      if (keys.length)
        await tx.query(
          `UPDATE ipos SET ${keys.map((k, i) => `${k}=$${i + 2}`).join(",")},updated_at=now() WHERE id=$1`,
          [id, ...Object.values(changes)],
        );
    }
    await tx.query(
      "INSERT INTO issue_identifiers(provider,external_id,ipo_id) VALUES($1,$2,$3) ON CONFLICT DO NOTHING",
      [issue.provider, issue.externalId, id],
    );
    const snapshot = await tx.query(
      "INSERT INTO source_observations(ipo_id,provider,fingerprint,payload,observed_at,validation_status) VALUES($1,$2,$3,$4,$5,'reported') ON CONFLICT DO NOTHING RETURNING id",
      [
        id,
        issue.provider,
        fingerprint([issue.provider, issue.raw]),
        JSON.stringify(issue.raw),
        m.last_observed_at,
      ],
    );
    for (const g of issue.gmp) {
      const key = fingerprint([id, issue.provider, g]);
      await tx.query(
        `INSERT INTO gmp_observations(ipo_id,provider,observation_key,reported_gmp,reported_percentage,observed_at,reported_date,reported_at_raw,source_count,source_spread,is_disputed,source_url,validation_status,raw) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) ON CONFLICT DO NOTHING`,
        [
          id,
          issue.provider,
          key,
          g.value,
          g.percentage,
          g.observedAt,
          g.reportedDate,
          g.reportedAtRaw,
          g.sourceCount,
          g.sourceSpread,
          g.disputed,
          g.sourceUrl,
          g.validation,
          JSON.stringify(g.raw),
        ],
      );
      if (g.disputed || g.validation === "review")
        await conflict(tx, id, "gmp", null, g.raw, issue.provider);
      if (g.observedAt) {
        const other = (
          await tx.query<{ reported_gmp: string }>(
            `SELECT reported_gmp FROM gmp_observations WHERE ipo_id=$1 AND provider<>$2 AND observed_at=$3 AND reported_gmp<>$4`,
            [id, issue.provider, g.observedAt, g.value],
          )
        ).rows;
        if (other.length) {
          await conflict(tx, id, "gmp", other, g.raw, issue.provider);
          await tx.query(
            "UPDATE gmp_observations SET is_disputed=true WHERE ipo_id=$1 AND observed_at=$2",
            [id, g.observedAt],
          );
        }
      }
    }
    for (const s of issue.subscriptions) {
      await tx.query(
        `INSERT INTO subscription_observations(ipo_id,provider,observation_key,venue,category,shares_bid,shares_offered,subscription_multiple,lower_bound_multiple,basis,is_final,observed_at,reported_date,reported_at_raw,source_url,raw) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) ON CONFLICT DO NOTHING`,
        [
          id,
          issue.provider,
          fingerprint([id, issue.provider, s]),
          s.venue,
          s.category,
          s.sharesBid,
          s.sharesOffered,
          s.multiple,
          s.lowerBound,
          s.basis,
          s.final,
          s.observedAt,
          s.reportedDate,
          s.reportedAtRaw,
          s.sourceUrl,
          JSON.stringify(s.raw),
        ],
      );
      if (s.observedAt) {
        const other = (
          await tx.query(
            `SELECT subscription_multiple FROM subscription_observations WHERE ipo_id=$1 AND provider<>$2 AND category=$3 AND venue=$4 AND observed_at=$5 AND basis=$6 AND subscription_multiple IS DISTINCT FROM $7::numeric`,
            [id, issue.provider, s.category, s.venue, s.observedAt, s.basis, s.multiple],
          )
        ).rows;
        if (other.length)
          await conflict(tx, id, "subscription:" + s.category, other, s.raw, issue.provider);
      }
    }
    for (const [type, date] of Object.entries({
      open: m.open_date,
      close: m.close_date,
      allotment: m.allotment_date,
      listing: m.listing_date,
    }))
      if (date)
        await tx.query(
          `INSERT INTO ipo_events(ipo_id,event_type,event_date,source,verification_status) VALUES($1,$2,$3,$4,'reported') ON CONFLICT DO NOTHING`,
          [id, type, date, issue.provider],
        );
    if (issue.listing) {
      const l = issue.listing;
      await tx.query(
        `INSERT INTO listing_results(ipo_id,issue_price,listing_price,exchange,listing_date,observed_at,provider,source_url,verification_status,observation_key) VALUES($1,$2,$3,$4,$5,$6,$7,$8,'reported',$9) ON CONFLICT DO NOTHING`,
        [
          id,
          l.issuePrice,
          l.listingPrice,
          l.exchange,
          l.date,
          l.observedAt,
          issue.provider,
          m.primary_source_url,
          fingerprint([id, issue.provider, l]),
        ],
      );
    }
    return { id, changed: snapshot.rows.length > 0 };
  });
}
