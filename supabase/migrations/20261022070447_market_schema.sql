-- Supabase production schema for the IPO market backend.
-- The application connects through DATABASE_URL using a Supabase pooled connection.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

BEGIN;
CREATE TABLE IF NOT EXISTS schema_migrations(version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS ipos (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), slug text NOT NULL UNIQUE,
 identity_key text NOT NULL UNIQUE, company_name text NOT NULL, normalized_company_name text NOT NULL,
 board text NOT NULL CHECK(board IN ('mainboard','sme','debt')),
 status text NOT NULL CHECK(status IN ('upcoming','open','closed','listed','withdrawn')),
 nse_symbol text, bse_symbol text, exchange text, sector text, registrar text,
 open_date date, close_date date, allotment_date date, listing_date date,
 price_min numeric(24,6) CHECK(price_min>0), price_max numeric(24,6) CHECK(price_max>0),
 lot_size bigint CHECK(lot_size>0), issue_size numeric(28,6) CHECK(issue_size>=0),
 fresh_issue_amount numeric(28,6) CHECK(fresh_issue_amount>=0), offer_for_sale_amount numeric(28,6) CHECK(offer_for_sale_amount>=0),
 minimum_investment numeric(28,6) CHECK(minimum_investment>=0), primary_source_url text NOT NULL,
 verification_status text NOT NULL DEFAULT 'reported', last_observed_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK(price_min IS NULL OR price_max IS NULL OR price_min<=price_max),
 CHECK(open_date IS NULL OR close_date IS NULL OR close_date>=open_date),
 CHECK(close_date IS NULL OR listing_date IS NULL OR listing_date>=close_date)
);
CREATE TABLE IF NOT EXISTS issue_identifiers(provider text NOT NULL, external_id text NOT NULL, ipo_id uuid NOT NULL REFERENCES ipos(id), PRIMARY KEY(provider,external_id));
CREATE TABLE IF NOT EXISTS source_observations(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), ipo_id uuid REFERENCES ipos(id), provider text NOT NULL,
 fingerprint text NOT NULL UNIQUE, payload jsonb NOT NULL, observed_at timestamptz, retrieved_at timestamptz NOT NULL DEFAULT now(),
 validation_status text NOT NULL, reason text
);
CREATE TABLE IF NOT EXISTS gmp_observations(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), ipo_id uuid NOT NULL REFERENCES ipos(id), provider text NOT NULL,
 observation_key text NOT NULL UNIQUE, reported_gmp numeric(24,6) NOT NULL, reported_percentage numeric(24,6),
 observed_at timestamptz, reported_date date, reported_at_raw text, retrieved_at timestamptz NOT NULL DEFAULT now(),
 source_count integer CHECK(source_count>=0), source_spread numeric(24,6), is_disputed boolean NOT NULL DEFAULT false,
 source_url text NOT NULL, validation_status text NOT NULL, raw jsonb NOT NULL
);
CREATE TABLE IF NOT EXISTS subscription_observations(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), ipo_id uuid NOT NULL REFERENCES ipos(id), provider text NOT NULL,
 observation_key text NOT NULL UNIQUE, venue text NOT NULL, category text NOT NULL,
 shares_bid numeric(28,0) CHECK(shares_bid>=0), shares_offered numeric(28,0) CHECK(shares_offered>=0),
 subscription_multiple numeric(28,8) CHECK(subscription_multiple>=0), lower_bound_multiple numeric(28,8) CHECK(lower_bound_multiple>=0),
 basis text NOT NULL CHECK(basis IN ('exact','lower_bound','bids_only')), is_final boolean NOT NULL,
 observed_at timestamptz, reported_date date, reported_at_raw text, retrieved_at timestamptz NOT NULL DEFAULT now(), source_url text NOT NULL, raw jsonb NOT NULL,
 CHECK((basis='exact' AND subscription_multiple IS NOT NULL AND lower_bound_multiple IS NULL) OR (basis='lower_bound' AND lower_bound_multiple IS NOT NULL AND subscription_multiple IS NULL) OR (basis='bids_only' AND subscription_multiple IS NULL AND lower_bound_multiple IS NULL))
);
CREATE TABLE IF NOT EXISTS ipo_documents(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), ipo_id uuid NOT NULL REFERENCES ipos(id), document_type text NOT NULL,
 title text NOT NULL, url text NOT NULL CHECK(url LIKE 'https://%'), source_organization text NOT NULL,
 filing_date date, verification_status text NOT NULL, verified_at timestamptz, last_checked_at timestamptz,
 UNIQUE(ipo_id,url)
);
CREATE TABLE IF NOT EXISTS ipo_events(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), ipo_id uuid NOT NULL REFERENCES ipos(id), event_type text NOT NULL,
 event_date date NOT NULL, source text NOT NULL, verification_status text NOT NULL, UNIQUE(ipo_id,event_type,event_date)
);
CREATE TABLE IF NOT EXISTS listing_results(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), ipo_id uuid NOT NULL REFERENCES ipos(id), issue_price numeric(24,6) NOT NULL CHECK(issue_price>0),
 listing_price numeric(24,6) NOT NULL CHECK(listing_price>0), exchange text, listing_date date NOT NULL,
 observed_at timestamptz, retrieved_at timestamptz NOT NULL DEFAULT now(), provider text NOT NULL, source_url text NOT NULL,
 verification_status text NOT NULL, observation_key text NOT NULL UNIQUE
);
CREATE TABLE IF NOT EXISTS company_financials(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), ipo_id uuid NOT NULL REFERENCES ipos(id), period text NOT NULL, reporting_year integer,
 revenue numeric(28,6), profit numeric(28,6), ebitda numeric(28,6), eps numeric(28,6), net_worth numeric(28,6), borrowings numeric(28,6),
 units text NOT NULL CHECK(units IN ('INR','INR_CRORE')), source_url text NOT NULL CHECK(source_url LIKE 'https://%'), verification_status text NOT NULL,
 verified_at timestamptz, UNIQUE(ipo_id,period,source_url)
);
CREATE TABLE IF NOT EXISTS data_sources(
 provider text PRIMARY KEY, status text NOT NULL DEFAULT 'pending', last_attempt_at timestamptz, last_success_at timestamptz,
 last_reported_at timestamptz, last_request_at timestamptz, request_latency_ms integer, error_code text,
 failures integer NOT NULL DEFAULT 0, next_allowed_at timestamptz, disclaimer text, last_master_at timestamptz,
 last_manifest jsonb
);
CREATE TABLE IF NOT EXISTS sync_runs(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), job text NOT NULL, started_at timestamptz NOT NULL DEFAULT now(), finished_at timestamptz,
 status text NOT NULL DEFAULT 'running', fetched integer NOT NULL DEFAULT 0, accepted integer NOT NULL DEFAULT 0,
 rejected integer NOT NULL DEFAULT 0, changed integer NOT NULL DEFAULT 0, error_code text, details jsonb NOT NULL DEFAULT '{}'
);
CREATE TABLE IF NOT EXISTS sync_locks(name text PRIMARY KEY, owner uuid NOT NULL, expires_at timestamptz NOT NULL);
CREATE TABLE IF NOT EXISTS http_cache(url text PRIMARY KEY, provider text NOT NULL, etag text, modified text, payload jsonb NOT NULL, retrieved_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS detail_refresh(ipo_id uuid NOT NULL REFERENCES ipos(id),provider text NOT NULL,last_attempt_at timestamptz,last_success_at timestamptz,PRIMARY KEY(ipo_id,provider));
CREATE TABLE IF NOT EXISTS data_conflicts(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),ipo_id uuid REFERENCES ipos(id), field text NOT NULL, previous_value jsonb, incoming_value jsonb,
 provider text NOT NULL, fingerprint text UNIQUE NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), resolved_at timestamptz
);
CREATE TABLE IF NOT EXISTS manual_corrections(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),ipo_id uuid NOT NULL REFERENCES ipos(id),field text NOT NULL,original_value jsonb,
 corrected_value jsonb NOT NULL,reason text NOT NULL,source_url text NOT NULL CHECK(source_url LIKE 'https://%'),
 administrator_id text NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),verification_status text NOT NULL CHECK(verification_status IN ('verified','review'))
);
CREATE INDEX IF NOT EXISTS ipos_dates_idx ON ipos(open_date,close_date,listing_date);
CREATE INDEX IF NOT EXISTS ipos_name_idx ON ipos(normalized_company_name);
CREATE INDEX IF NOT EXISTS gmp_history_idx ON gmp_observations(ipo_id,observed_at DESC,reported_date DESC);
CREATE INDEX IF NOT EXISTS subs_history_idx ON subscription_observations(ipo_id,observed_at DESC,category);
CREATE INDEX IF NOT EXISTS events_date_idx ON ipo_events(event_date,ipo_id);
CREATE INDEX IF NOT EXISTS documents_ipo_idx ON ipo_documents(ipo_id);
CREATE INDEX IF NOT EXISTS listing_ipo_idx ON listing_results(ipo_id,listing_date);
CREATE INDEX IF NOT EXISTS financials_ipo_idx ON company_financials(ipo_id);
CREATE INDEX IF NOT EXISTS corrections_ipo_idx ON manual_corrections(ipo_id,created_at DESC);
CREATE INDEX IF NOT EXISTS source_observation_idx ON source_observations(ipo_id,retrieved_at DESC);
CREATE INDEX IF NOT EXISTS conflicts_ipo_idx ON data_conflicts(ipo_id,resolved_at);
CREATE INDEX IF NOT EXISTS sync_started_idx ON sync_runs(started_at DESC);
-- All access goes through the authenticated server. No browser/PostgREST policies.
ALTER TABLE ipos ENABLE ROW LEVEL SECURITY;
ALTER TABLE issue_identifiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE source_observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE gmp_observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ipo_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE ipo_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE listing_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_financials ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_locks ENABLE ROW LEVEL SECURITY;
ALTER TABLE http_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE detail_refresh ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_conflicts ENABLE ROW LEVEL SECURITY;
ALTER TABLE manual_corrections ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
 IF EXISTS(SELECT FROM pg_roles WHERE rolname='anon') THEN
 REVOKE ALL ON ipos,issue_identifiers,source_observations,gmp_observations,subscription_observations,ipo_documents,ipo_events,listing_results,company_financials,data_sources,sync_runs,sync_locks,http_cache,detail_refresh,data_conflicts,manual_corrections FROM anon;
 END IF;
 IF EXISTS(SELECT FROM pg_roles WHERE rolname='authenticated') THEN
 REVOKE ALL ON ipos,issue_identifiers,source_observations,gmp_observations,subscription_observations,ipo_documents,ipo_events,listing_results,company_financials,data_sources,sync_runs,sync_locks,http_cache,detail_refresh,data_conflicts,manual_corrections FROM authenticated;
 END IF;
END $$;
INSERT INTO schema_migrations(version) VALUES('001') ON CONFLICT DO NOTHING;
COMMIT;

BEGIN;
ALTER TABLE ipos ADD COLUMN IF NOT EXISTS registrar_url text;
ALTER TABLE ipos ADD COLUMN IF NOT EXISTS about text;
ALTER TABLE ipos ADD COLUMN IF NOT EXISTS lead_manager text;
CREATE OR REPLACE FUNCTION protect_correction_audit() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Correction audit is append-only; append a new correction'; END;
$$;
DROP TRIGGER IF EXISTS correction_audit_immutable ON manual_corrections;
CREATE TRIGGER correction_audit_immutable BEFORE UPDATE OR DELETE ON manual_corrections
FOR EACH ROW EXECUTE FUNCTION protect_correction_audit();
CREATE INDEX IF NOT EXISTS ipos_filter_idx ON ipos(status,board,open_date DESC);
CREATE INDEX IF NOT EXISTS identifiers_ipo_idx ON issue_identifiers(ipo_id);
INSERT INTO schema_migrations(version) VALUES('002') ON CONFLICT DO NOTHING;
COMMIT;



-- schema_migrations is an internal server table and must never be exposed through the Data API.
ALTER TABLE schema_migrations ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON schema_migrations FROM anon;
  END IF;
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON schema_migrations FROM authenticated;
  END IF;
END $$;

-- Keep foreign-key lookups and cleanup operations indexed as the dataset grows.
CREATE INDEX IF NOT EXISTS ipo_events_ipo_idx ON ipo_events(ipo_id);
CREATE INDEX IF NOT EXISTS detail_refresh_ipo_idx ON detail_refresh(ipo_id);
