-- BLOCKED: no database ACL metadata was inspected for this proposal.
-- Do not run until an operator reviews the read-only pg_default_acl output in
-- README.md, approves role-specific effects on Supabase-managed operations,
-- confirms role authority, and separately authorizes this bootstrap.
-- Both psql variables below are attestations, not substitutes for that review.
-- Run with ON_ERROR_STOP enabled.
\set ON_ERROR_STOP on
\if :{?KONTRA_BOOTSTRAP_AUTHORIZED}
\else
\echo 'BLOCKED: explicit KONTRA_BOOTSTRAP_AUTHORIZED=on is required'
DO $blocked$ BEGIN RAISE EXCEPTION 'BLOCKED: staging bootstrap authorization is absent'; END $blocked$;
\endif
\if :KONTRA_BOOTSTRAP_AUTHORIZED
\else
\echo 'BLOCKED: explicit KONTRA_BOOTSTRAP_AUTHORIZED=on is required'
DO $blocked$ BEGIN RAISE EXCEPTION 'BLOCKED: staging bootstrap authorization is false'; END $blocked$;
\endif
\if :{?KONTRA_ACL_REVIEWED}
\else
\echo 'BLOCKED: explicit KONTRA_ACL_REVIEWED=on is required after ACL and role-impact review'
DO $blocked$ BEGIN RAISE EXCEPTION 'BLOCKED: ACL and role-impact review is absent'; END $blocked$;
\endif
\if :KONTRA_ACL_REVIEWED
\else
\echo 'BLOCKED: explicit KONTRA_ACL_REVIEWED=on is required after ACL and role-impact review'
DO $blocked$ BEGIN RAISE EXCEPTION 'BLOCKED: ACL and role-impact review is false'; END $blocked$;
\endif

BEGIN;

-- Fail before DDL if role metadata or authority cannot be confirmed. This
-- requires an operator authorized to alter defaults for BOTH object owners.
DO $preflight$
DECLARE
  role_name text;
  role_exists boolean;
  caller_is_superuser boolean;
BEGIN
  IF to_regclass('pg_catalog.pg_default_acl') IS NULL THEN
    RAISE EXCEPTION 'BLOCKED: pg_default_acl metadata is unavailable';
  END IF;

  SELECT rolsuper INTO caller_is_superuser
    FROM pg_catalog.pg_roles WHERE rolname = current_user;

  FOREACH role_name IN ARRAY ARRAY['postgres', 'supabase_admin']
  LOOP
    SELECT EXISTS (
      SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = role_name
    ) INTO role_exists;
    IF NOT role_exists THEN
      RAISE EXCEPTION 'BLOCKED: required object owner % does not exist', role_name;
    END IF;
    IF NOT COALESCE(caller_is_superuser, false)
       AND current_user <> role_name
       AND NOT pg_has_role(current_user, role_name, 'MEMBER') THEN
      RAISE EXCEPTION 'BLOCKED: current role cannot alter defaults for %', role_name;
    END IF;
  END LOOP;

  IF to_regnamespace('kontra_internal') IS NOT NULL
     OR to_regclass('kontra_internal.migration_ledger') IS NOT NULL THEN
    RAISE EXCEPTION
      'BLOCKED: kontra_internal already exists; inspect and reconcile manually; do not drop objects';
  END IF;
END;
$preflight$;

-- Global revokes are required because per-schema REVOKE cannot cancel global
-- default grants. PUBLIC grants on functions and types can be required by
-- Supabase-managed operations; do not enable both gates without an approved
-- role-specific review of those effects.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres
  REVOKE ALL ON TABLES FROM PUBLIC, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON TABLES FROM PUBLIC, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres
  REVOKE ALL ON SEQUENCES FROM PUBLIC, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON SEQUENCES FROM PUBLIC, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres
  REVOKE USAGE ON TYPES FROM PUBLIC, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE USAGE ON TYPES FROM PUBLIC, anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin
  REVOKE ALL ON TABLES FROM PUBLIC, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public
  REVOKE ALL ON TABLES FROM PUBLIC, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin
  REVOKE ALL ON SEQUENCES FROM PUBLIC, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public
  REVOKE ALL ON SEQUENCES FROM PUBLIC, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin
  REVOKE USAGE ON TYPES FROM PUBLIC, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public
  REVOKE USAGE ON TYPES FROM PUBLIC, anon, authenticated, service_role;

CREATE SCHEMA kontra_internal AUTHORIZATION postgres;
CREATE TABLE kontra_internal.migration_ledger (
  migration_id text PRIMARY KEY,
  checksum char(64) NOT NULL CHECK (checksum ~ '^[a-f0-9]{64}$'),
  status text NOT NULL CHECK (status IN ('started', 'applied')),
  source_commit char(40) NOT NULL CHECK (source_commit ~ '^[a-f0-9]{40}$'),
  runner_version text,
  started_at timestamptz NOT NULL DEFAULT now(),
  applied_at timestamptz,
  CHECK ((status = 'started' AND applied_at IS NULL) OR
         (status = 'applied' AND applied_at IS NOT NULL))
);
REVOKE ALL ON SCHEMA kontra_internal FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE kontra_internal.migration_ledger
  FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE kontra_internal.migration_ledger TO postgres;

COMMIT;
