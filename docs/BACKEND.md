# IPO backend operating guide

## Architecture and existing pages

The active router is `src/routes`, with server-only adapters under `src/server/providers`. Provider JSON is validated and normalized before transactional writes. `src/lib/ipo-data.ts` contains the frontend contract and null-safe formatting, not IPO records. `src/lib/market/rules.ts` provides decimal arithmetic. The original demonstration dataset is isolated as a text fixture under `src/test/fixtures` and is never imported by the app.

| Page                   | Required fields                                                                 | Internal read path                                               |
| ---------------------- | ------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Home and IPO directory | Name, board, venue, status, prices, lot, size, dates, reported GMP/subscription | `/api/ipos`; initial SSR database snapshot                       |
| IPO detail             | Master fields, histories, disclosures, verified financials                      | `/api/ipos/:slug`; initial SSR server function                   |
| GMP list/detail        | Unofficial price observations, percentage, timestamp, disputes                  | `/api/gmp`, `/api/ipos/:slug/gmp`, `/api/ipos/:slug/gmp/history` |
| Subscription           | Category bids, offered shares, multiples, basis, final flag, venue              | `/api/subscription`, `/api/ipos/:slug/subscription`              |
| Calendar               | Opening, closing, allotment, listing dates                                      | `/api/calendar`                                                  |
| Allotment              | Dates, registrar, manually verified registrar URL                               | `/api/ipos`                                                      |
| Listings               | Actual issue/listing prices and historical gain                                 | `/api/listing-performance`                                       |
| Documents              | Verified HTTPS links and verification dates                                     | `/api/ipos/:slug/documents`                                      |
| Comparison/calculator  | Selected database records, upper band, lot and valid GMP                        | Existing directory/detail components                             |
| Research               | Static explanatory articles, no fabricated market records                       | Local article module                                             |

List APIs share the `MarketSnapshot` envelope to keep the components reusable. `GET /api/dashboard` returns that same snapshot for dashboard KPIs and rows; `GET /api/health` reports database readiness and explicitly marks provider coverage as incomplete; `GET /api/data-status` exposes source health and coverage limitations. An empty database is not proof of zero market activity: the UI shows an em dash and labels coverage unknown until records exist. Detail pages initially load through TanStack server functions that invoke the same database reader. No visitor initiates an upstream sync.

## Field-to-source mapping and limits

| Data                                                                              | Source                                              | Interpretation / limitations                                                                                                                                                                      |
| --------------------------------------------------------------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Names, source IDs, board, status, dates, price band, lot, issue size, registrar   | [Xflot](https://www.xflot.com/api-docs)             | Third-party reports; missing values remain null. Source dates are not guarantees. Crore values are converted to INR for storage.                                                                  |
| GMP and GMP history                                                               | Xflot list/detail                                   | Unofficial, unregulated. List-level GMP has no dedicated observation timestamp: it stays unknown. Dated detail observations retain source time. Conflicting percentages are flagged.              |
| Subscription manifest and category/overall demand                                 | [IPOs.Markets](https://ipos.markets/api-docs)       | `exact`, `lower_bound`, and `bids_only` remain distinct. Never sum venue multiples. Categories can have a different basis from the overall figure.                                                |
| Subscription fallback                                                             | Xflot detail                                        | Aggregated venue, only where actually reported; not promoted to an exchange-verified observation. IPOs.Markets takes precedence when available.                                                   |
| Listing results                                                                   | Xflot explicit issue price and actual listing price | Only accepted with listed status, positive prices and a listing date. Never substitute the upper band for actual issue price.                                                                     |
| Documents, financial periods, registrar links, discounts, fresh issue/OFS amounts | Authenticated manual evidence review                | Verify against [SEBI filings](https://www.sebi.gov.in/filings/public-issues.html), issuer/official exchange documents or registrar website. No automated PDF extraction or registrar form access. |
| Current traded price and supported personalized allotment results                 | Unavailable                                         | Requires an authorized integration. No PAN/application identifiers are collected.                                                                                                                 |
| IPOGuru / official exchange feed                                                  | Disabled extension points                           | No licensed credentials/schema are configured. Setting an enablement flag alone does not implement a paid adapter.                                                                                |

Xflot data is attributed in the interface with its exact response disclaimer. Current disclaimer: “Aggregated public information. GMP is unofficial and not published by any exchange or regulator. XDQ Labs Private Limited is not a SEBI-registered investment adviser or research analyst. Nothing here is investment advice.” IPOs.Markets attribution is also displayed.

Free-source records can be incomplete, duplicated or contradictory. The initial live response contained duplicate source slugs with differing dates and inconsistent values. Rejected rows remain in `source_observations`, and disagreements remain in `data_conflicts`. A schema-valid third-party row is **reported**, not officially verified. No claim of complete Indian IPO coverage or official real-time data is made. The Xflot master request is capped at 200 records; subscription archive backfill is bounded and gradual.

## Configuration

Copy `.env.example` to `.env`. Keep it out of Git. Only `VITE_*` settings can be browser-exposed; do not prefix any database/admin/provider secret with `VITE_`.

For local use, keep `DATABASE_MODE=pglite`, `PGLITE_PATH=.local/market-db` and `PUBLIC_APP_URL=http://localhost:8081`. PGlite is embedded PostgreSQL for one local process. In production set `DATABASE_URL` to a managed PostgreSQL/Supabase pooled connection, `DATABASE_SSL=true`, and `NODE_ENV=production`. Production fails closed without PostgreSQL and cannot use PGlite.

### Supabase production setup

This application uses Supabase Postgres through the server-only `pg` adapter. It does not expose a database key in the browser and does not use the Supabase Data API for market reads or writes. Create a Supabase project, then copy the Session Pooler connection string from Database settings into the host's `DATABASE_URL` secret. Use the pooler URL on port `5432`, keep `DATABASE_SSL=true`, and leave `DATABASE_POOL_MAX=3` unless the host and database plan justify a larger pool.

The repository includes the CLI project under `supabase/` and two migrations:

```sh
npx supabase@latest migration list
npx supabase@latest db push
```

Link the CLI once with the project reference and a scoped Supabase access token. The migrations create the IPO schema, indexes, RLS, server-only Data API denial policies and correction audit protection. Apply them before the first sync.

The database has RLS enabled on every public table. `anon` and `authenticated` have no table privileges and explicit deny policies are present as defense in depth; only the server's private PostgreSQL connection can read or write market data. Never put `DATABASE_URL`, a service role key, or an access token in a `VITE_*` variable.

Generate two separate random 32-byte hex tokens with:

```sh
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Use one for `SYNC_SECRET`. Use the other as the operator's `ADMIN_TOKEN`; store its SHA256 digest in `ADMIN_TOKEN_SHA256`, and set a meaningful `ADMIN_ID`. Generate the digest from the operator environment without printing the raw token:

```sh
node --env-file=.env -e "console.log(require('crypto').createHash('sha256').update(process.env.ADMIN_TOKEN).digest('hex'))"
```

On a hosted server store only the admin digest, not the raw `ADMIN_TOKEN`. Operator commands use a separate local environment containing the raw token. The sync credential can only run synchronization; it cannot make corrections. Admin tokens are checked server-side with constant-time digest comparison. Rotate by replacing the digest/secret on the server and operator/scheduler settings. Use HTTPS for any non-local operator requests.

## Database and migrations

`src/db/migrations/001_market.sql` creates IPOs, source identifiers, raw observations, GMP/subscription histories, events, documents, listing results, financials, source health, sync runs, leases, HTTP cache, conflicts and correction audit. `002_audit.sql` protects corrections against UPDATE/DELETE and adds indexes and manually maintained fields.

The canonical Supabase migrations are under `supabase/migrations/`. Keep those files in sync with future schema changes and apply them with the Supabase CLI or the Supabase migration tool before deploying the application.

Run `npm run db:migrate` with the production database URL before deploying. The migration command needs repository source files and dependencies, not just `.output`. Migrations are idempotent. For PGlite, stop the web server before running this command; otherwise let the web process perform initialization itself.

All tables have row-level security enabled and no browser access policies. Public Supabase anon/authenticated roles have no table privileges. Use a dedicated server connection with appropriate ownership/RLS bypass; never expose that connection in a browser. Use a separate migration role where your host supports it. Pool size defaults to three connections per process; budget across all serverless instances.

Corrections are append-only audit entries. Verified overrides are materialized for consistent SQL filtering, overlaid in public reads, and protected against subsequent sync writes. A later `review` correction makes the field unavailable until reviewed again. Every entry retains original/new values, identity, evidence and reason. Provider values remain in raw observations. Disputed numeric/date fields are withheld from calculations pending resolution.

## Synchronization

Run the website, then `npm run admin -- sync auto`. Run `npm run sync:worker` in a separate terminal to keep syncing while developing. The worker calls the authenticated endpoint; it does not open the embedded database. It uses one request at a time and waits 30 minutes after each completed run. Stop it with Ctrl+C.

Jobs: `auto`, `master`, `gmp`, `history`, `subscription`, `listing`, `documents`, `health`. Documents are maintained by manual evidence review; that job reports this instead of silently pretending to fetch filings. `listing` checks explicit listing results from the master feed. `history` uses bounded detail refreshes.

- Xflot master: default 30 minutes. The master response contains the market list and current reported GMP. Exactly one Xflot call is made per scheduled run. A database gate reserves at least 61 seconds between any Xflot requests, including errors and manual jobs.
- Other auto runs refresh one eligible Xflot detail, prioritizing active issues. Default detail eligibility is 30 minutes, historical jobs 24 hours. This is a rotation, **not** a promise that every issue updates every 30 minutes.
- Subscription manifest: 30 minutes; up to 20 eligible details per run. Active issues are refreshed first and the archive is updated progressively. Per-source request gap is at least one second.
- Timeouts: 15 seconds. IPOs.Markets retries transient failures up to three attempts with exponential backoff/jitter. Xflot retries are deferred to a later run to honor its rate limit. `Retry-After` is honored. Repeated failures open a 15-minute circuit.
- A renewable database lease prevents overlapping jobs; HTTP ETag/Last-Modified requests are conditional where supported. Successful persistence is idempotent and never deletes an issue missing from a feed.
- Failed/partial runs, record counts, source errors, latency and rejection reasons are available to administrators. A provider outage retains database data. This version exposes internal health; it does not send external alert messages.

The optional GitHub Actions workflow calls the endpoint at minute 0 and 30 of each hour. Enable repository variable `MARKET_SYNC_ENABLED=true`, set `PUBLIC_APP_URL`, and add secret `SYNC_SECRET`. Scheduling may be delayed by GitHub and consumes the repository's action allowance; verify your plan. Do not run multiple independent schedulers unnecessarily. Hosting execution limits must accommodate a bounded sync; lower batch size/timeouts if needed.

Disable a failing source with `XFLOT_ENABLED=false` or `IPOS_MARKETS_ENABLED=false` and restart/redeploy. Saved records remain readable and their observation timestamps do not change.

## API and freshness

Successful JSON: `{ "data": ..., "requestId": "..." }`. Errors: `{ "error": { "code": "...", "requestId": "..." } }`. Public requests never include raw provider payloads, audit data, database configuration or credentials.

List query parameters: `q`, `status` (lowercase), `board` (`mainboard`, `sme`, `debt`), `exchange`, `from`, `to` (ISO opening date range), `sort` (`name`, `open`, `close`, `listing`, `price`, `size`), `dir`, `page`, `limit` (1–2000). Invalid inputs return 400. Unknown detail slugs return 404. Public responses use ETags with mandatory revalidation, and new observations/corrections change the representation. React Query refreshes every 60 seconds and retains last good data on a failed refresh.

The public rate gate is process-wide, 600 requests/minute by default; it is a basic abuse bound, not a distributed per-user quota. Configure gateway/WAF limits for a scaled deployment. No permissive cross-origin API policy is enabled. Admin requests require bearer authentication; browser origins must match the configured application origin.

Default source age thresholds: master 48 hours, GMP 24 hours, active subscription 1 hour. Old listed/withdrawn observations are historical. Missing observation time stays unknown; retrieval time never becomes observation time. Future timestamps and suspicious values require review. Financials/documents use their explicit verification dates and reporting periods, not a “live” badge. Manual rechecking is required when filings change.

Calculations use decimal.js; display formatting rounds only at the UI boundary. GMP estimates use the upper band consistently. Actual listing gains use actual issue price. Calculator amounts assume a selected number of reported lots, with no discount, category eligibility, fees, taxes, or guaranteed allotment. Verify actual application rules in the offer document.

## Administration tools

```sh
npm run admin -- health
npm run admin -- search Tonbo
npm run admin -- inspect <slug>
npm run admin -- sync history
npm run admin -- correct correction.json
```

`health` shows source health, recent syncs, rejection summaries and unresolved disagreements. `inspect` exposes the protected raw histories and audit for an issue. The `search` command uses the public validated search API. No browser password or hidden route is used as authentication.

Example correction shape (replace all placeholders with actual verified evidence; this is not a seed):

```json
{
  "ipoId": "<database UUID>",
  "field": "registrar_url",
  "value": "https://<official-registrar>/<official-path>",
  "reason": "Checked against the issuer offer document",
  "sourceUrl": "https://<official-issuer>/<offer-document.pdf>",
  "verification": "verified"
}
```

Allowed scalar fields: price_min, price_max, lot_size, issue_size, fresh_issue_amount, offer_for_sale_amount, open_date, close_date, allotment_date, listing_date, registrar, registrar_url, about, lead_manager. Monetary storage is INR. `verification` can be `verified` or `review`.

For `field=document`, value is `{type,title,url,organization,filingDate}`; supported types: DRHP, RHP, PROSPECTUS, ADDENDUM, OTHER. For `field=financial`, value is `{period,year,units,revenue,profit,ebitda,eps,netWorth,borrowings}`. Units are INR or INR_CRORE; use null for missing metrics. EPS is per-share and is stored separately; never scale it as revenue. No claimed verification is performed automatically merely by supplying a URL: the authorized administrator must actually inspect the evidence.

## Deployment and recovery

The source remains Lovable-connected; never rewrite published Git history. The backend build targets Nitro's **Node server** because PostgreSQL pooling and local development storage require Node facilities. A static-only host is insufficient. Confirm that your Lovable deployment can execute this server and hold the required secrets before enabling jobs; its default Cloudflare target has not been verified for this backend. A Node-compatible deployment can run `node .output/server/index.mjs` after `npm ci`, migrations, and `npm run build`.

Render can use the checked-in `render.yaml` Blueprint. It sets `npm ci && npm run build` as the build command and `npm run start` as the Node server command. Set the `sync: false` values in the Render dashboard, especially `DATABASE_URL`, `PUBLIC_APP_URL`, `SYNC_SECRET`, `ADMIN_ID` and `ADMIN_TOKEN_SHA256`. The existing GitHub Actions workflow can call the authenticated sync endpoint every 30 minutes after `MARKET_SYNC_ENABLED=true` is configured in the repository.

Use Node 22.14+ and managed PostgreSQL with TLS. Set production URL/secrets in the host dashboard, configure the scheduler, run one authenticated sync, and perform the smoke procedure below. Neither a production database nor a public deployment is provisioned by local `.env` generation. No successful deployment is claimed until that environment has passed the smoke procedure.

Backups: enable the managed database plan's supported daily backups/PITR if available; free tiers may not include it. Otherwise schedule encrypted `pg_dump --format=custom` exports using a restricted operator environment and store outside the application host. Back up all histories/audit, not only `ipos`. Test `pg_restore` into a separate database, rerun migrations and compare row counts before switching `DATABASE_URL`. Retain at least seven daily and four weekly snapshots subject to your data-retention policy. Do not print credentials in shell commands or logs. Local-only recovery: stop both dev server and worker, copy the entire `.local/market-db` directory to private backup storage, restore only with the server stopped.

For a licensed official feed, first obtain documented redistribution permission and credentials from the provider/exchange. Implement its actual schema in a new adapter using the existing Provider interface, add mocked contract tests and field precedence rules, and enable it explicitly. For IPOGuru, contact the provider through its [developer documentation](https://www.ipoguru.in/ipo-gmp-details-developer-api) to confirm plan/production rights. An API key alone is insufficient to activate the reserved adapter.

## Verification and manual smoke procedure

Automated tests cover financial rules, numeric parsing, IST conversion, missing timestamps, subscription bases, normalized provider data, idempotent writes, historical persistence, conflicts, migrations, constraints, audit protection, auth rejection, API validation/pagination/search, cache invalidation, retries, rate limiting and sync leases. They never call live providers.

1. Start the server with a configured database. Confirm `/api/ipos` responds even when the database is empty, with no invented rows.
2. Run `npm run admin -- sync auto`; inspect health. Preserve rejected records and investigate partial results. Do not treat every accepted record as officially verified.
3. Open home, directory, GMP, subscription, calendar, listings and allotment. Search a returned name, change filters and pages, open a real detail URL, and refresh directly. Check empty documents/financials/calculator states.
4. Confirm GMP says unofficial and shows the source observation time or explicitly unknown. Confirm bids-only and lower-bound records do not display exact multiples.
5. Wait at least 61 seconds before another Xflot job. Repeat master sync: unchanged payloads must not grow observation counts. Run a detail/history job to populate actual dated history gradually.
6. Disable a provider and restart; saved data must remain. Re-enable it when ready. Verify stale labels against observation time, not download time.
7. Without a token, `/api/admin/health` and POST `/api/admin/sync` must return 401. Verify correction evidence/audit with an authorized test issue in a staging database.
8. Repeat after production deployment, including direct detail refresh and scheduler execution. The local checks do not establish hosted runtime, credentials, backups, or scheduler reliability.
