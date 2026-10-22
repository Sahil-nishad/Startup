-- Defense in depth for server-only tables exposed by the public schema.
-- The application uses its Supabase PostgreSQL connection, never the Data API.
CREATE OR REPLACE FUNCTION public.protect_correction_audit()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  RAISE EXCEPTION 'Correction audit is append-only; append a new correction';
END;
$$;

DO $$
DECLARE
  table_name text;
BEGIN
  FOR table_name IN
    SELECT unnest(ARRAY[
      'schema_migrations', 'ipos', 'issue_identifiers', 'source_observations',
      'gmp_observations', 'subscription_observations', 'ipo_documents', 'ipo_events',
      'listing_results', 'company_financials', 'data_sources', 'sync_runs',
      'sync_locks', 'http_cache', 'detail_refresh', 'data_conflicts', 'manual_corrections'
    ]::text[])
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS deny_data_api_%I ON public.%I', table_name, table_name);
    EXECUTE format(
      'CREATE POLICY deny_data_api_%I ON public.%I FOR ALL TO anon, authenticated USING (false) WITH CHECK (false)',
      table_name,
      table_name
    );
  END LOOP;
END
$$;
