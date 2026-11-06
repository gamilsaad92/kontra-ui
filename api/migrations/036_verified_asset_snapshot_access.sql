-- Keep immutable readiness snapshots available only to the trusted API role.
-- This forward migration corrects the public policy and default table grants
-- created by migration 024 without changing snapshot rows.
BEGIN;

REVOKE ALL PRIVILEGES
  ON TABLE public.verified_asset_snapshots
  FROM PUBLIC, anon, authenticated, service_role;

GRANT SELECT, INSERT
  ON TABLE public.verified_asset_snapshots
  TO service_role;

DROP POLICY IF EXISTS "service_role_vas"
  ON public.verified_asset_snapshots;

CREATE POLICY "service_role_vas"
  ON public.verified_asset_snapshots
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

DO $verify$
DECLARE
  role_name text;
  privilege_name text;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_class
    WHERE oid = 'public.verified_asset_snapshots'::regclass
      AND relrowsecurity
  ) THEN
    RAISE EXCEPTION 'verified_asset_snapshots RLS is not enabled';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'verified_asset_snapshots'
      AND policyname = 'service_role_vas'
      AND roles = ARRAY['service_role']::name[]
      AND cmd = 'ALL'
      AND qual = 'true'
      AND with_check = 'true'
  ) THEN
    RAISE EXCEPTION 'service_role_vas is missing or not scoped to service_role';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_class AS table_class
    CROSS JOIN LATERAL aclexplode(
      COALESCE(table_class.relacl, acldefault('r', table_class.relowner))
    ) AS privilege
    WHERE table_class.oid = 'public.verified_asset_snapshots'::regclass
      AND privilege.grantee = 0
  ) THEN
    RAISE EXCEPTION 'PUBLIC retains privileges on verified_asset_snapshots';
  END IF;

  FOREACH role_name IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    FOREACH privilege_name IN ARRAY ARRAY['SELECT', 'INSERT', 'UPDATE', 'DELETE'] LOOP
      IF has_table_privilege(
        role_name,
        'public.verified_asset_snapshots',
        privilege_name
      ) THEN
        RAISE EXCEPTION '% retains % on verified_asset_snapshots',
          role_name,
          privilege_name;
      END IF;
    END LOOP;
  END LOOP;

  IF NOT has_table_privilege(
    'service_role',
    'public.verified_asset_snapshots',
    'SELECT'
  ) OR NOT has_table_privilege(
    'service_role',
    'public.verified_asset_snapshots',
    'INSERT'
  ) THEN
    RAISE EXCEPTION 'service_role is missing required SELECT or INSERT';
  END IF;

  IF has_table_privilege(
    'service_role',
    'public.verified_asset_snapshots',
    'UPDATE'
  ) OR has_table_privilege(
    'service_role',
    'public.verified_asset_snapshots',
    'DELETE'
  ) THEN
    RAISE EXCEPTION 'service_role has unexpected UPDATE or DELETE';
  END IF;
END
$verify$;

COMMIT;
