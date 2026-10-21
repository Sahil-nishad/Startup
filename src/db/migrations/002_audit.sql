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
