-- Staging Phase 6B: remove inherited broad ACLs from the asset-preparation tables.
-- Run only after migrations 025-027. This does not alter default privileges or
-- unrelated tables; each table is checked before any ACL changes are committed.
BEGIN;

DO $preflight$
DECLARE
  target_table text;
  required_column text;
  required_index text;
BEGIN
  FOREACH target_table IN ARRAY ARRAY[
    'verified_asset_snapshots',
    'digital_asset_preparation_packages',
    'digital_asset_preparation_package_revisions',
    'digital_asset_preparation_pdf_artifacts'
  ] LOOP
    IF to_regclass(format('public.%I', target_table)) IS NULL THEN
      RAISE EXCEPTION 'Required asset table public.% is missing', target_table;
    END IF;
    IF NOT (SELECT relrowsecurity FROM pg_class
            WHERE oid = to_regclass(format('public.%I', target_table))) THEN
      RAISE EXCEPTION 'RLS is not enabled on public.%', target_table;
    END IF;
  END LOOP;

  FOR target_table, required_column IN
    SELECT * FROM (VALUES
      ('verified_asset_snapshots', 'property_id'),
      ('verified_asset_snapshots', 'version'),
      ('verified_asset_snapshots', 'snapshot_hash'),
      ('verified_asset_snapshots', 'snapshot'),
      ('digital_asset_preparation_packages', 'source_snapshot_id'),
      ('digital_asset_preparation_packages', 'package_hash'),
      ('digital_asset_preparation_packages', 'package'),
      ('digital_asset_preparation_package_revisions', 'package_id'),
      ('digital_asset_preparation_package_revisions', 'revision'),
      ('digital_asset_preparation_package_revisions', 'changed_fields'),
      ('digital_asset_preparation_pdf_artifacts', 'source_revision_id'),
      ('digital_asset_preparation_pdf_artifacts', 'artifact_hash'),
      ('digital_asset_preparation_pdf_artifacts', 'storage_path')
    ) AS required(table_name, column_name)
  LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM pg_attribute
      WHERE attrelid = to_regclass(format('public.%I', target_table))
        AND attname = required_column
        AND attnum > 0
        AND NOT attisdropped
    ) THEN
      RAISE EXCEPTION 'Expected column public.%.% is missing', target_table, required_column;
    END IF;
  END LOOP;

  FOREACH required_index IN ARRAY ARRAY[
    'idx_vas_property_version',
    'idx_digital_asset_preparation_packages_property',
    'idx_digital_asset_preparation_package_revisions_latest',
    'idx_digital_asset_preparation_pdf_artifacts_history'
  ] LOOP
    IF to_regclass(format('public.%I', required_index)) IS NULL THEN
      RAISE EXCEPTION 'Expected asset-preparation index public.% is missing', required_index;
    END IF;
  END LOOP;
END
$preflight$;

REVOKE ALL PRIVILEGES
  ON TABLE public.verified_asset_snapshots
  FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT
  ON TABLE public.verified_asset_snapshots
  TO service_role;

REVOKE ALL PRIVILEGES
  ON TABLE public.digital_asset_preparation_pdf_artifacts
  FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, DELETE
  ON TABLE public.digital_asset_preparation_pdf_artifacts
  TO service_role;

REVOKE ALL PRIVILEGES
  ON TABLE public.digital_asset_preparation_packages,
             public.digital_asset_preparation_package_revisions
  FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, DELETE
  ON TABLE public.digital_asset_preparation_packages,
             public.digital_asset_preparation_package_revisions
  TO service_role;

DO $verify$
DECLARE
  target_table text;
  policy_name text;
  role_name text;
  privilege_name text;
BEGIN
  FOR target_table, policy_name IN
    SELECT * FROM (VALUES
      ('verified_asset_snapshots', 'service_role_vas'),
      ('digital_asset_preparation_packages', 'service_role_digital_asset_preparation_packages'),
      ('digital_asset_preparation_package_revisions', 'service_role_digital_asset_preparation_package_revisions'),
      ('digital_asset_preparation_pdf_artifacts', 'service_role_digital_asset_preparation_pdf_artifacts')
    ) AS expected(table_name, expected_policy)
  LOOP
    IF EXISTS (
      SELECT 1
      FROM pg_class AS c
      CROSS JOIN LATERAL aclexplode(COALESCE(c.relacl, acldefault('r', c.relowner))) AS acl
      WHERE c.oid = to_regclass(format('public.%I', target_table))
        AND acl.grantee = 0
    ) THEN
      RAISE EXCEPTION 'PUBLIC retains a table grant on public.%', target_table;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = target_table
        AND policyname = policy_name
        AND roles = ARRAY['service_role']::name[]
        AND cmd = 'ALL'
    ) THEN
      RAISE EXCEPTION 'Required service_role RLS policy % is missing or mis-scoped on public.%',
        policy_name, target_table;
    END IF;

    FOREACH role_name IN ARRAY ARRAY['anon', 'authenticated'] LOOP
      FOREACH privilege_name IN ARRAY ARRAY[
        'SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER'
      ] LOOP
        IF has_table_privilege(
          role_name,
          format('public.%I', target_table),
          privilege_name
        ) THEN
          RAISE EXCEPTION '% retains % on public.%', role_name, privilege_name, target_table;
        END IF;
      END LOOP;
    END LOOP;
  END LOOP;

  IF NOT has_table_privilege('service_role', 'public.verified_asset_snapshots', 'SELECT')
     OR NOT has_table_privilege('service_role', 'public.verified_asset_snapshots', 'INSERT')
     OR has_table_privilege('service_role', 'public.verified_asset_snapshots', 'UPDATE')
     OR has_table_privilege('service_role', 'public.verified_asset_snapshots', 'DELETE')
     OR has_table_privilege('service_role', 'public.verified_asset_snapshots', 'TRUNCATE')
     OR has_table_privilege('service_role', 'public.verified_asset_snapshots', 'REFERENCES')
     OR has_table_privilege('service_role', 'public.verified_asset_snapshots', 'TRIGGER') THEN
    RAISE EXCEPTION 'verified_asset_snapshots service_role grants differ from the immutable access matrix';
  END IF;

  FOREACH target_table IN ARRAY ARRAY[
    'digital_asset_preparation_packages',
    'digital_asset_preparation_package_revisions',
    'digital_asset_preparation_pdf_artifacts'
  ] LOOP
    IF NOT has_table_privilege('service_role', format('public.%I', target_table), 'SELECT')
       OR NOT has_table_privilege('service_role', format('public.%I', target_table), 'INSERT')
       OR NOT has_table_privilege('service_role', format('public.%I', target_table), 'DELETE')
       OR has_table_privilege('service_role', format('public.%I', target_table), 'UPDATE')
       OR has_table_privilege('service_role', format('public.%I', target_table), 'TRUNCATE')
       OR has_table_privilege('service_role', format('public.%I', target_table), 'REFERENCES')
       OR has_table_privilege('service_role', format('public.%I', target_table), 'TRIGGER') THEN
      RAISE EXCEPTION 'Unexpected service_role grants on public.%', target_table;
    END IF;
  END LOOP;

  IF NOT has_schema_privilege('service_role', 'public', 'USAGE') THEN
    RAISE EXCEPTION 'service_role lacks USAGE on public schema';
  END IF;
  IF has_schema_privilege('anon', 'public', 'CREATE')
     OR has_schema_privilege('authenticated', 'public', 'CREATE')
     OR has_schema_privilege('service_role', 'public', 'CREATE')
     OR EXISTS (
       SELECT 1
       FROM pg_namespace AS schema
       CROSS JOIN LATERAL aclexplode(
         COALESCE(schema.nspacl, acldefault('n', schema.nspowner))
       ) AS acl
       WHERE schema.nspname = 'public'
         AND acl.grantee = 0
         AND acl.privilege_type = 'CREATE'
     ) THEN
    RAISE EXCEPTION 'Untrusted role can CREATE objects in public schema; review schema ACLs first';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_class AS sequence_class
    JOIN pg_depend AS dependency ON dependency.objid = sequence_class.oid
    WHERE sequence_class.relkind = 'S'
      AND dependency.refobjid IN (
        'public.verified_asset_snapshots'::regclass,
        'public.digital_asset_preparation_packages'::regclass,
        'public.digital_asset_preparation_package_revisions'::regclass,
        'public.digital_asset_preparation_pdf_artifacts'::regclass
      )
  ) THEN
    RAISE EXCEPTION 'Unexpected owned sequence exists for UUID-keyed asset tables; review sequence ACLs';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_proc
    WHERE pronamespace = 'public'::regnamespace
      AND proname LIKE 'digital_asset_preparation_%'
  ) THEN
    RAISE EXCEPTION 'Unexpected asset-preparation function exists; review its EXECUTE grants before proceeding';
  END IF;
END
$verify$;

COMMIT;