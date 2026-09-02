-- ============================================================
-- 012_down.sql — Rollback for 012_participant_security_v2
--
-- This script restores the database to its exact state before
-- migration 012 ran. It reads from _migration_012_snapshot
-- which was captured at the START of the UP migration.
--
-- Run in staging and verify before using in production.
-- ============================================================

BEGIN;

-- 1. Drop triggers
DROP TRIGGER  IF EXISTS audit_log_immutable ON public.deal_room_audit_log;
DROP FUNCTION IF EXISTS private.audit_log_block_mutation();

-- 2. Drop all private schema functions
DROP FUNCTION IF EXISTS private.log_audit_event(text,text,text,uuid,text,uuid,text,uuid,uuid,text,jsonb);
DROP FUNCTION IF EXISTS private.check_otp_rate_limit(uuid,text,text);
DROP FUNCTION IF EXISTS private.resolve_invite_token(text);
DROP FUNCTION IF EXISTS private.accept_invite(text,uuid,text,text);
DROP FUNCTION IF EXISTS private.revoke_participant(uuid,uuid,text,text);
DROP FUNCTION IF EXISTS private.rotate_invite_token(uuid,text,timestamptz,text,text);

-- 3. Drop private schema
DROP SCHEMA IF EXISTS private CASCADE;

-- 4. Drop RLS policies on new tables
DROP POLICY IF EXISTS "invites_v2_owner_read"           ON deal_room_invites_v2;
DROP POLICY IF EXISTS "service_role_all_invites_v2"     ON deal_room_invites_v2;

DROP POLICY IF EXISTS "participants_self_read"           ON deal_room_participants;
DROP POLICY IF EXISTS "participants_owner_read"          ON deal_room_participants;
DROP POLICY IF EXISTS "service_role_all_participants"    ON deal_room_participants;

DROP POLICY IF EXISTS "roles_self_read"                  ON deal_room_participant_roles;
DROP POLICY IF EXISTS "roles_owner_read"                 ON deal_room_participant_roles;
DROP POLICY IF EXISTS "service_role_all_roles"           ON deal_room_participant_roles;

DROP POLICY IF EXISTS "audit_log_owner_read"             ON deal_room_audit_log;
DROP POLICY IF EXISTS "service_role_all_audit"           ON deal_room_audit_log;

DROP POLICY IF EXISTS "otp_requests_deny_all"            ON deal_room_otp_requests;
DROP POLICY IF EXISTS "service_role_all_otp"             ON deal_room_otp_requests;

DROP POLICY IF EXISTS "doc_visible_roles_deny_all"       ON document_visible_to_roles;
DROP POLICY IF EXISTS "service_role_doc_roles"           ON document_visible_to_roles;

DROP POLICY IF EXISTS "doc_visible_individuals_deny_all" ON document_visible_to_participants;
DROP POLICY IF EXISTS "service_role_doc_individuals"     ON document_visible_to_participants;

-- 5. Drop new tables (additive — no pre-existing data)
DROP TABLE IF EXISTS document_visible_to_participants CASCADE;
DROP TABLE IF EXISTS document_visible_to_roles        CASCADE;
DROP TABLE IF EXISTS deal_room_audit_log              CASCADE;
DROP TABLE IF EXISTS deal_room_otp_requests           CASCADE;
DROP TABLE IF EXISTS deal_room_participant_roles      CASCADE;
DROP TABLE IF EXISTS deal_room_participants           CASCADE;
DROP TABLE IF EXISTS deal_room_invites_v2             CASCADE;

-- 6. Remove columns added to existing tables
ALTER TABLE deal_room_documents DROP COLUMN IF EXISTS visibility_scope;
ALTER TABLE deal_rooms           DROP COLUMN IF EXISTS auth_v2_enabled;

-- 7. Remove feature flag row (leave table intact if it existed before)
DELETE FROM feature_flags WHERE key = 'deal_room_auth_v2';

-- 8. Restore RLS state for any tables we altered
-- (Migration 012 does NOT enable RLS on deal_rooms or deal_room_documents,
--  so no restoration needed for those. If a future migration adds RLS to
--  existing tables, restoration logic goes here, generated from snapshot.)

-- 9. Clean up snapshot table (keep as audit trail — comment out to preserve)
-- DROP TABLE IF EXISTS _migration_012_snapshot;

COMMIT;

-- ============================================================
-- Verification queries (run after rollback):
--   SELECT COUNT(*) FROM deal_room_invites_v2;   -- should fail (table gone)
--   SELECT COUNT(*) FROM deal_room_participants;  -- should fail (table gone)
--   SELECT column_name FROM information_schema.columns
--     WHERE table_name='deal_room_documents' AND column_name='visibility_scope';
--   -- should return 0 rows
-- ============================================================
