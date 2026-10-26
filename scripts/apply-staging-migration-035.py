#!/usr/bin/env python3
"""One-shot, protected GitHub Actions runner for the reviewed staging 035 package."""
import hashlib
import os
import re
import subprocess
import sys
from pathlib import Path
from urllib.parse import parse_qsl, urlsplit

PROJECT = "jpemuoapbgzwapydqiio"
POOLER = "aws-0-us-west-1.pooler.supabase.com"
PACKAGE = Path("generated-artifacts/phase5-staging-migration/01_035_tenant_relationships_and_submission_events.sql")
PACKAGE_SHA256 = "6a9e0eb0d24ff0f65fb956c45844e83b9f8050d2875dcc4c63bfd3f0999e7069"
CA = Path("ops/staging-runner/supabase-root.crt")
CA_PIN = Path("ops/staging-runner/supabase-root.crt.sha256")
IMAGE = "postgres@sha256:e4cb93687b062cd25a0e8f672d85a7708235009d70d31f8a7698d9370092a9c4"
CONFIRM = f"APPLY 035 TO {PROJECT}"

PRECHECK = r"""
WITH required(ok) AS (
 SELECT
   to_regclass('supabase_migrations.schema_migrations') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM supabase_migrations.schema_migrations m
                   WHERE coalesce(to_jsonb(m)->>'name','') ~ '(^|[^0-9])035([^0-9]|$)'
                      OR coalesce(to_jsonb(m)->>'version','') ~ '(^|[^0-9])035([^0-9]|$)')
   AND to_regclass('public.transaction_record_party_relationships') IS NULL
   AND to_regclass('public.transaction_record_party_relationship_history') IS NULL
   AND to_regclass('public.participant_submission_events') IS NULL
    AND NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname IN
      ('transaction_record_party_relationships_room_suite_idx','transaction_record_party_relationships_source_idx',
       'transaction_record_party_relationship_history_room_idx','participant_submission_events_room_role_idx'))
    AND NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND policyname IN
      ('service_role_tenant_relationships','service_role_tenant_relationship_history','service_role_participant_submission_events'))
   AND to_regprocedure('public.kontra_record_participant_submission(text,uuid,integer,text)') IS NULL
   AND to_regprocedure('public.kontra_mark_tenant_evidence_source_changed()') IS NULL
   AND to_regprocedure('public.kontra_replace_tenant_relationship_candidates(text,uuid,text,jsonb)') IS NULL
   AND to_regprocedure('public.kontra_review_tenant_relationship(text,uuid,text,text,text)') IS NULL
   AND NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trg_tenant_evidence_source_superseded' AND NOT tgisinternal)
   AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='deal_rooms' AND column_name='property_id' AND data_type='text')
   AND EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE n.nspname='public' AND t.relname='deal_rooms' AND c.contype IN ('p','u') AND pg_get_constraintdef(c.oid) LIKE '%(property_id)%')
   AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='deal_analyses' AND column_name='id' AND data_type='uuid')
    AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='deal_analyses' AND column_name='is_active' AND data_type='boolean')
    AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='deal_analyses' AND column_name='storage_path')
   AND (SELECT count(*)=5 FROM information_schema.columns WHERE table_schema='public' AND table_name='deal_analyses' AND column_name IN ('property_id','section','source_hash','is_active','superseded_at'))
    AND to_regclass('public.transaction_record_fields') IS NOT NULL
    AND to_regclass('storage.objects') IS NOT NULL
   AND (SELECT count(*)=6 FROM information_schema.columns WHERE table_schema='public' AND table_name='deal_room_invites' AND column_name IN ('property_id','role_key','invited_email','status','revoked_at','expires_at'))
   AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='deal_room_invites' AND column_name='id' AND data_type='uuid')
    AND EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE n.nspname='public' AND t.relname='deal_room_invites' AND c.contype IN ('p','u') AND pg_get_constraintdef(c.oid) LIKE '%(id)%')
   AND (SELECT count(*)=7 FROM information_schema.columns WHERE table_schema='public' AND table_name='party_submissions' AND column_name IN ('property_id','role','name','email','doc_count','submitted_at','notes'))
   AND EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE n.nspname='public' AND t.relname='party_submissions' AND c.contype IN ('p','u') AND pg_get_constraintdef(c.oid) LIKE '%(property_id, role)%')
   AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname='service_role')
   AND to_regprocedure('gen_random_uuid()') IS NOT NULL
)
SELECT CASE WHEN ok THEN 'READY' ELSE 'BLOCKED' END FROM required;
"""

STATE_SQL = r"""
SELECT concat_ws('|',
 (SELECT md5(coalesce(string_agg(to_jsonb(r)::text, E'\n' ORDER BY to_jsonb(r)::text),'')) FROM public.deal_rooms r),
 (SELECT md5(coalesce(string_agg(to_jsonb(f)::text, E'\n' ORDER BY to_jsonb(f)::text),'')) FROM public.transaction_record_fields f),
 (SELECT md5(coalesce(string_agg(to_jsonb(s)::text, E'\n' ORDER BY to_jsonb(s)::text),'')) FROM public.party_submissions s),
 (SELECT md5(coalesce(string_agg(to_jsonb(d)::text, E'\n' ORDER BY to_jsonb(d)::text),'')) FROM public.deal_analyses d),
 (SELECT md5(coalesce(string_agg(to_jsonb(o)::text, E'\n' ORDER BY to_jsonb(o)::text),''))
    FROM storage.objects o WHERE EXISTS
      (SELECT 1 FROM public.deal_analyses d WHERE d.storage_path=o.name))
);
"""

POSTCHECK = r"""
SELECT CASE WHEN
 to_regclass('public.transaction_record_party_relationships') IS NOT NULL
 AND to_regclass('public.transaction_record_party_relationship_history') IS NOT NULL
 AND to_regclass('public.participant_submission_events') IS NOT NULL
 AND to_regprocedure('public.kontra_record_participant_submission(text,uuid,integer,text)') IS NOT NULL
 AND to_regprocedure('public.kontra_mark_tenant_evidence_source_changed()') IS NOT NULL
 AND to_regprocedure('public.kontra_replace_tenant_relationship_candidates(text,uuid,text,jsonb)') IS NOT NULL
 AND to_regprocedure('public.kontra_review_tenant_relationship(text,uuid,text,text,text)') IS NOT NULL
 AND EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trg_tenant_evidence_source_superseded'
             AND tgrelid='public.deal_analyses'::regclass AND NOT tgisinternal AND tgenabled <> 'D')
 AND (SELECT relrowsecurity FROM pg_class WHERE oid='public.transaction_record_party_relationships'::regclass)
 AND (SELECT relrowsecurity FROM pg_class WHERE oid='public.transaction_record_party_relationship_history'::regclass)
 AND (SELECT relrowsecurity FROM pg_class WHERE oid='public.participant_submission_events'::regclass)
 AND has_function_privilege('service_role','public.kontra_record_participant_submission(text,uuid,integer,text)','EXECUTE')
 AND has_function_privilege('service_role','public.kontra_replace_tenant_relationship_candidates(text,uuid,text,jsonb)','EXECUTE')
 AND has_function_privilege('service_role','public.kontra_review_tenant_relationship(text,uuid,text,text,text)','EXECUTE')
 AND NOT has_function_privilege('anon','public.kontra_record_participant_submission(text,uuid,integer,text)','EXECUTE')
 AND NOT has_function_privilege('authenticated','public.kontra_record_participant_submission(text,uuid,integer,text)','EXECUTE')
 AND NOT has_function_privilege('anon','public.kontra_replace_tenant_relationship_candidates(text,uuid,text,jsonb)','EXECUTE')
 AND NOT has_function_privilege('authenticated','public.kontra_replace_tenant_relationship_candidates(text,uuid,text,jsonb)','EXECUTE')
 AND NOT has_function_privilege('anon','public.kontra_review_tenant_relationship(text,uuid,text,text,text)','EXECUTE')
 AND NOT has_function_privilege('authenticated','public.kontra_review_tenant_relationship(text,uuid,text,text,text)','EXECUTE')
 AND EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='transaction_record_party_relationships_room_suite_idx')
 AND EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='transaction_record_party_relationships_source_idx')
 AND EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='transaction_record_party_relationship_history_room_idx')
 AND EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='participant_submission_events_room_role_idx')
 AND (SELECT count(*)=3 FROM pg_policies WHERE schemaname='public' AND cmd='ALL'
      AND roles=ARRAY['service_role'::name]
      AND (table_name,policyname) IN
       (('transaction_record_party_relationships','service_role_tenant_relationships'),
        ('transaction_record_party_relationship_history','service_role_tenant_relationship_history'),
        ('participant_submission_events','service_role_participant_submission_events')))
 AND has_table_privilege('service_role','public.transaction_record_party_relationships','SELECT')
 AND has_table_privilege('service_role','public.transaction_record_party_relationships','INSERT')
 AND has_table_privilege('service_role','public.transaction_record_party_relationships','UPDATE')
 AND has_table_privilege('service_role','public.transaction_record_party_relationship_history','SELECT')
 AND has_table_privilege('service_role','public.transaction_record_party_relationship_history','INSERT')
 AND has_table_privilege('service_role','public.participant_submission_events','SELECT')
 AND has_table_privilege('service_role','public.participant_submission_events','INSERT')
 AND NOT EXISTS (SELECT 1 FROM supabase_migrations.schema_migrations m
                 WHERE coalesce(to_jsonb(m)->>'name','') ~ '(^|[^0-9])035([^0-9]|$)'
                    OR coalesce(to_jsonb(m)->>'version','') ~ '(^|[^0-9])035([^0-9]|$)')
 THEN 'VERIFIED' ELSE 'BLOCKED' END;
"""


def valid_url(value):
    try:
        u = urlsplit(value)
        return (
            u.scheme in ("postgres", "postgresql")
            and u.hostname == POOLER and u.port == 5432 and u.path == "/postgres"
            and u.username == f"postgres.{PROJECT}" and bool(u.password)
            and not u.fragment and parse_qsl(u.query, keep_blank_values=True, strict_parsing=True) == [("sslmode", "verify-full")]
        )
    except (ValueError, TypeError):
        return False


def check_file(path, expected):
    return path.is_file() and hashlib.sha256(path.read_bytes()).hexdigest() == expected


def validate(env, root):
    if env.get("GITHUB_EVENT_NAME") != "workflow_dispatch":
        raise ValueError("manual dispatch required")
    if env.get("GITHUB_REF") != "refs/heads/staging-migrations":
        raise ValueError("wrong branch")
    if env.get("INPUT_MIGRATION") != "035" or env.get("INPUT_CONFIRMATION") != CONFIRM:
        raise ValueError("confirmation mismatch")
    if not valid_url(env.get("STAGING_DATABASE_URL", "")):
        raise ValueError("database target rejected")
    if not check_file(root / PACKAGE, PACKAGE_SHA256):
        raise ValueError("package checksum mismatch")
    cert, pin = root / CA, root / CA_PIN
    if not cert.is_file() or not pin.is_file():
        raise ValueError("CA files missing")
    match = re.fullmatch(r"([A-Fa-f0-9]{64})  supabase-root\.crt\n?", pin.read_text())
    if not match or not check_file(cert, match.group(1).lower()):
        raise ValueError("CA checksum mismatch")
    if b"CA:TRUE" not in subprocess.run(
        ["openssl", "x509", "-in", str(cert), "-noout", "-ext", "basicConstraints"],
        check=True, capture_output=True
    ).stdout:
        raise ValueError("CA certificate is not a CA")


def docker_psql(root, env, query=None, file=None, timeout=180):
    cert = root / CA
    args = ["docker", "run", "--rm", "-e", "STAGING_DATABASE_URL",
            "-e", "PGSSLMODE=verify-full", "-e", "PGSSLROOTCERT=/certs/supabase-root.crt",
            "-e", "PGOPTIONS=-c lock_timeout=5s -c statement_timeout=120s",
            "-v", f"{cert}:/certs/supabase-root.crt:ro"]
    if file:
        args += ["-v", f"{root / file}:/migration.sql:ro"]
    args += [IMAGE, "sh", "-ec"]
    if query is not None:
        args += ['exec psql "$STAGING_DATABASE_URL" -X -v ON_ERROR_STOP=1 -At -c "$1"', "runner", query]
    else:
        args += ['exec psql "$STAGING_DATABASE_URL" -X -v ON_ERROR_STOP=1 -f /migration.sql']
    clean = {"PATH": env.get("PATH", "/usr/bin:/bin"), "HOME": env.get("HOME", "/tmp"),
             "STAGING_DATABASE_URL": env["STAGING_DATABASE_URL"]}
    try:
        return subprocess.run(args, env=clean, text=True, capture_output=True, timeout=timeout)
    except (OSError, subprocess.TimeoutExpired):
        return subprocess.CompletedProcess(args, 124, "", "")


def execute_stages(root, env, psql=docker_psql):
    pre = psql(root, env, query=PRECHECK)
    if pre.returncode or pre.stdout.strip() != "READY":
        print("Schema preflight failed; migration was not attempted.")
        return 3
    before = psql(root, env, query=STATE_SQL)
    if before.returncode or not before.stdout.strip():
        print("Read-only baseline could not be captured; migration was not attempted.")
        return 3
    applied = psql(root, env, file=PACKAGE)
    if applied.returncode:
        print("Migration failed or commit status is uncertain; do not retry automatically.")
        return 4
    post = psql(root, env, query=POSTCHECK)
    if post.returncode or post.stdout.strip() != "VERIFIED":
        print("Postflight verification failed; stop and inspect state; do not retry.")
        return 5
    after = psql(root, env, query=STATE_SQL)
    if after.returncode or after.stdout.strip() != before.stdout.strip():
        print("Existing room/document/canonical/submission counts changed; stop for review.")
        return 5
    print("Migration 035 transaction completed and schema verification passed.")
    print("Migration history is not written by this SQL package; no history row was inserted.")
    return 0


def main():
    root = Path(os.environ.get("GITHUB_WORKSPACE", Path(__file__).resolve().parents[1]))
    env = os.environ.copy()
    try:
        validate(env, root)
    except Exception:
        print("Preflight rejected; no migration SQL was executed.")
        return 2
    return execute_stages(root, env)


if __name__ == "__main__":
    raise SystemExit(main())
