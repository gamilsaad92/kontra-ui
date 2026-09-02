-- ============================================================
-- 012_participant_security_v2.sql
-- Kontra Deal Room Participant Security v2
--
-- Architecture approved. Build exactly this.
-- DO NOT RUN AGAINST PRODUCTION until:
--   1. Staging tests pass (see test matrix in architecture doc)
--   2. Down migration verified in staging
--   3. Owner pre-flight checks pass (see STEP 1 below)
--
-- Naming conventions in new tables:
--   room_id  → references deal_rooms(property_id)
--   auth_uid → references auth.users(id)
-- ============================================================

BEGIN;

-- ============================================================
-- STEP 0: Pre-flight assertions
-- These must all pass before the migration proceeds.
-- Uncomment and run manually in staging first.
-- ============================================================
-- DO $$
-- BEGIN
--   IF (SELECT COUNT(*) FROM deal_rooms WHERE customer_email IS NULL) > 0 THEN
--     RAISE EXCEPTION 'Pre-flight failed: deal_rooms rows with NULL customer_email exist';
--   END IF;
-- END $$;

-- ============================================================
-- STEP 1: Rollback snapshot (captured before any changes)
-- ============================================================
CREATE TABLE IF NOT EXISTS _migration_012_snapshot (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  captured_at     timestamptz DEFAULT now(),
  object_type     text NOT NULL,   -- table_rls | policy | table_grant | storage_policy | function_grant
  schema_name     text,
  object_name     text,
  role_name       text,
  is_permissive   text,
  cmd             text,
  qual            text,
  with_check_expr text,
  rls_enabled     boolean,
  force_rls       boolean,
  privilege_type  text,
  is_grantable    text
);

-- Capture RLS state for all public tables
INSERT INTO _migration_012_snapshot
  (object_type, schema_name, object_name, rls_enabled, force_rls)
SELECT 'table_rls', n.nspname, c.relname, c.relrowsecurity, c.relforcerowsecurity
FROM   pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE  n.nspname = 'public' AND c.relkind = 'r'
ON CONFLICT DO NOTHING;

-- Capture existing RLS policies (exact executable definitions)
INSERT INTO _migration_012_snapshot
  (object_type, schema_name, object_name, role_name, is_permissive, cmd, qual, with_check_expr)
SELECT 'policy',
  n.nspname,
  c.relname,
  array_to_string(p.polroles::regrole[], ','),
  CASE p.polpermissive WHEN true THEN 'PERMISSIVE' ELSE 'RESTRICTIVE' END,
  CASE p.polcmd
    WHEN 'r' THEN 'SELECT'  WHEN 'a' THEN 'INSERT'
    WHEN 'w' THEN 'UPDATE'  WHEN 'd' THEN 'DELETE'
    ELSE 'ALL'
  END,
  pg_get_expr(p.polqual,      p.polrelid),
  pg_get_expr(p.polwithcheck, p.polrelid)
FROM   pg_policy p
JOIN   pg_class c ON c.oid = p.polrelid
JOIN   pg_namespace n ON n.oid = c.relnamespace
WHERE  n.nspname IN ('public','storage')
ON CONFLICT DO NOTHING;

-- Capture table grants
INSERT INTO _migration_012_snapshot
  (object_type, schema_name, object_name, role_name, privilege_type, is_grantable)
SELECT 'table_grant', table_schema, table_name, grantee, privilege_type, is_grantable
FROM   information_schema.role_table_grants
WHERE  table_schema IN ('public','storage')
ON CONFLICT DO NOTHING;

-- ============================================================
-- STEP 2: Private schema — business logic lives here
-- Not exposed via PostgREST. Called only via direct pg connection
-- from the API server (service role credentials).
-- ============================================================
CREATE SCHEMA IF NOT EXISTS private;

REVOKE ALL ON SCHEMA private FROM PUBLIC;
REVOKE ALL ON SCHEMA private FROM anon;
REVOKE ALL ON SCHEMA private FROM authenticated;
GRANT USAGE ON SCHEMA private TO service_role;

-- ============================================================
-- STEP 3: Feature flags
-- ============================================================
CREATE TABLE IF NOT EXISTS feature_flags (
  key        text PRIMARY KEY,
  enabled    boolean NOT NULL DEFAULT false,
  note       text,
  updated_at timestamptz DEFAULT now()
);

INSERT INTO feature_flags (key, enabled, note) VALUES
  ('deal_room_auth_v2', false,
   'Participant security v2. Enable per room via deal_rooms.auth_v2_enabled after staging tests pass.')
ON CONFLICT (key) DO NOTHING;

-- Per-room opt-in (default false — all existing rooms stay on legacy/blocked access)
ALTER TABLE deal_rooms ADD COLUMN IF NOT EXISTS auth_v2_enabled boolean NOT NULL DEFAULT false;

-- ============================================================
-- STEP 4: Core v2 tables (room_id naming convention)
-- ============================================================

-- Invitations (one per participant invitation)
CREATE TABLE IF NOT EXISTS deal_room_invites_v2 (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id         text        NOT NULL REFERENCES deal_rooms(property_id) ON DELETE CASCADE,
  role_key        text        NOT NULL,
  invited_email   text        NOT NULL,
  token_hash      text        NOT NULL UNIQUE,   -- sha256 hex; raw token only in invite URL
  status          text        NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','accepted','revoked','expired','superseded')),
  expires_at      timestamptz NOT NULL DEFAULT now() + interval '7 days',
  created_by_email text       NOT NULL,           -- owner's customer_email at creation time
  created_at      timestamptz NOT NULL DEFAULT now(),
  revoked_at      timestamptz,
  superseded_at   timestamptz,
  CONSTRAINT invited_email_normalized
    CHECK (invited_email = lower(trim(invited_email)))
);

-- Participant identity: one row per (person × room)
-- Multiple roles stored in deal_room_participant_roles
CREATE TABLE IF NOT EXISTS deal_room_participants (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id     text        NOT NULL REFERENCES deal_rooms(property_id) ON DELETE CASCADE,
  auth_uid    uuid        NOT NULL,              -- auth.users(id) — validated by API, not FK (cross-schema)
  status      text        NOT NULL DEFAULT 'active'
                CHECK (status IN ('active','revoked')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  revoked_at  timestamptz,
  UNIQUE (room_id, auth_uid)
);

-- Participant roles: many per participant, each tied to its own invite
CREATE TABLE IF NOT EXISTS deal_room_participant_roles (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id uuid        NOT NULL REFERENCES deal_room_participants(id) ON DELETE CASCADE,
  role_key       text        NOT NULL,
  invite_id      uuid        NOT NULL REFERENCES deal_room_invites_v2(id),
  status         text        NOT NULL DEFAULT 'active'
                   CHECK (status IN ('active','revoked')),
  granted_at     timestamptz NOT NULL DEFAULT now(),
  revoked_at     timestamptz,
  UNIQUE (participant_id, role_key)
);

-- OTP rate limiting (server-side, no browser involvement)
CREATE TABLE IF NOT EXISTS deal_room_otp_requests (
  id           bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  invite_id    uuid        NOT NULL,
  email        text        NOT NULL,
  ip_address   text,
  requested_at timestamptz NOT NULL DEFAULT now()
);

-- Document visibility extensions
ALTER TABLE deal_room_documents
  ADD COLUMN IF NOT EXISTS visibility_scope text
    NOT NULL DEFAULT 'owner_only'
    CHECK (visibility_scope IN ('owner_only','all_participants','selected_roles','selected_individuals'));

-- Backfill existing documents to owner_only (safe — no participant can see them yet)
UPDATE deal_room_documents
SET    visibility_scope = 'owner_only'
WHERE  visibility_scope IS NULL;

CREATE TABLE IF NOT EXISTS document_visible_to_roles (
  document_id uuid NOT NULL REFERENCES deal_room_documents(id) ON DELETE CASCADE,
  role_key    text NOT NULL,
  PRIMARY KEY (document_id, role_key)
);

CREATE TABLE IF NOT EXISTS document_visible_to_participants (
  document_id uuid NOT NULL REFERENCES deal_room_documents(id) ON DELETE CASCADE,
  auth_uid    uuid NOT NULL,
  PRIMARY KEY (document_id, auth_uid)
);

-- ============================================================
-- STEP 5: Security audit log — split into three categories
-- Immutable: no UPDATE or DELETE ever permitted (enforced below)
-- ============================================================
CREATE TABLE IF NOT EXISTS deal_room_audit_log (
  id             bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  room_id        text,
  event_category text        NOT NULL
                   CHECK (event_category IN ('security','authorization','document_activity')),
  event_type     text        NOT NULL,
  -- security:           invite_created | invite_revoked | invite_expired | invite_superseded
  --                     participant_activated | participant_revoked | role_granted | role_revoked
  -- authorization:      otp_sent | otp_attempt_failed | otp_rate_limited | otp_verified
  --                     token_resolved | token_invalid | access_denied
  -- document_activity:  signed_url_issued | document_uploaded | document_shared | document_scope_changed
  actor_uid      uuid,
  actor_email    text,
  target_uid     uuid,
  target_email   text,
  invite_id      uuid,
  document_id    uuid,
  ip_address     text,
  metadata       jsonb,
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- STEP 6: Audit log immutability
-- ============================================================
REVOKE INSERT, UPDATE, DELETE ON deal_room_audit_log FROM PUBLIC, anon, authenticated;
GRANT  INSERT                  ON deal_room_audit_log TO   service_role;

CREATE OR REPLACE FUNCTION private.audit_log_block_mutation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION 'deal_room_audit_log is immutable — UPDATE and DELETE are not permitted';
END;
$$;

CREATE TRIGGER audit_log_immutable
  BEFORE UPDATE OR DELETE ON public.deal_room_audit_log
  FOR EACH ROW EXECUTE FUNCTION private.audit_log_block_mutation();

-- ============================================================
-- STEP 7: Indexes (every RLS EXISTS condition and lookup)
-- ============================================================

-- Token lookup (UNIQUE already creates one; explicit for clarity)
CREATE UNIQUE INDEX IF NOT EXISTS idx_invites_v2_token_hash
  ON deal_room_invites_v2 (token_hash);

-- Invite listing by room + status (owner management view)
CREATE INDEX IF NOT EXISTS idx_invites_v2_room_status
  ON deal_room_invites_v2 (room_id, status);

-- Invite lookup by email (for reissue checks)
CREATE INDEX IF NOT EXISTS idx_invites_v2_email_room
  ON deal_room_invites_v2 (invited_email, room_id, status);

-- Participant lookup used in every RLS policy
CREATE UNIQUE INDEX IF NOT EXISTS idx_participants_room_uid
  ON deal_room_participants (room_id, auth_uid);

CREATE INDEX IF NOT EXISTS idx_participants_auth_uid_status
  ON deal_room_participants (auth_uid, status);

-- Participant roles — RLS and management
CREATE INDEX IF NOT EXISTS idx_participant_roles_participant
  ON deal_room_participant_roles (participant_id, status);

CREATE INDEX IF NOT EXISTS idx_participant_roles_invite
  ON deal_room_participant_roles (invite_id);

-- OTP rate limiting queries
CREATE INDEX IF NOT EXISTS idx_otp_req_invite_time
  ON deal_room_otp_requests (invite_id, requested_at DESC);

CREATE INDEX IF NOT EXISTS idx_otp_req_email_time
  ON deal_room_otp_requests (email, requested_at DESC);

CREATE INDEX IF NOT EXISTS idx_otp_req_ip_time
  ON deal_room_otp_requests (ip_address, requested_at DESC);

-- Document visibility
CREATE INDEX IF NOT EXISTS idx_doc_visible_roles
  ON document_visible_to_roles (document_id, role_key);

CREATE INDEX IF NOT EXISTS idx_doc_visible_individuals
  ON document_visible_to_participants (document_id, auth_uid);

-- Audit log queries
CREATE INDEX IF NOT EXISTS idx_audit_room_created
  ON deal_room_audit_log (room_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_category_type
  ON deal_room_audit_log (event_category, event_type, created_at DESC);

-- ============================================================
-- STEP 8: Private schema functions
-- All business logic. Called via direct pg connection (service role).
-- SECURITY INVOKER throughout — no privilege escalation.
-- Fully qualified table names (schema.table) everywhere.
-- ============================================================

-- ── 8a. log_audit_event ─────────────────────────────────────
CREATE OR REPLACE FUNCTION private.log_audit_event(
  p_room_id        text,
  p_category       text,
  p_event_type     text,
  p_actor_uid      uuid    DEFAULT NULL,
  p_actor_email    text    DEFAULT NULL,
  p_target_uid     uuid    DEFAULT NULL,
  p_target_email   text    DEFAULT NULL,
  p_invite_id      uuid    DEFAULT NULL,
  p_document_id    uuid    DEFAULT NULL,
  p_ip_address     text    DEFAULT NULL,
  p_metadata       jsonb   DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.deal_room_audit_log
    (room_id, event_category, event_type,
     actor_uid, actor_email, target_uid, target_email,
     invite_id, document_id, ip_address, metadata)
  VALUES
    (p_room_id, p_category, p_event_type,
     p_actor_uid, p_actor_email, p_target_uid, p_target_email,
     p_invite_id, p_document_id, p_ip_address, p_metadata);
END;
$$;

-- ── 8b. check_otp_rate_limit ────────────────────────────────
CREATE OR REPLACE FUNCTION private.check_otp_rate_limit(
  p_invite_id  uuid,
  p_email      text,
  p_ip_address text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_invite_count  int;
  v_email_count   int;
  v_ip_count      int;
  v_last_request  timestamptz;
BEGIN
  -- Per invite: max 5 requests per hour
  SELECT COUNT(*) INTO v_invite_count
  FROM public.deal_room_otp_requests
  WHERE invite_id    = p_invite_id
    AND requested_at > now() - interval '1 hour';

  IF v_invite_count >= 5 THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'invite_limit');
  END IF;

  -- Resend cooldown: 60 seconds per invite
  SELECT MAX(requested_at) INTO v_last_request
  FROM public.deal_room_otp_requests
  WHERE invite_id = p_invite_id;

  IF v_last_request IS NOT NULL AND v_last_request > now() - interval '60 seconds' THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'cooldown');
  END IF;

  -- Per email: max 5 requests per 15 minutes
  SELECT COUNT(*) INTO v_email_count
  FROM public.deal_room_otp_requests
  WHERE email        = p_email
    AND requested_at > now() - interval '15 minutes';

  IF v_email_count >= 5 THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'email_limit');
  END IF;

  -- Per IP: max 10 requests per 15 minutes
  IF p_ip_address IS NOT NULL THEN
    SELECT COUNT(*) INTO v_ip_count
    FROM public.deal_room_otp_requests
    WHERE ip_address   = p_ip_address
      AND requested_at > now() - interval '15 minutes';

    IF v_ip_count >= 10 THEN
      RETURN jsonb_build_object('allowed', false, 'reason', 'ip_limit');
    END IF;
  END IF;

  -- Record this request
  INSERT INTO public.deal_room_otp_requests (invite_id, email, ip_address)
  VALUES (p_invite_id, p_email, p_ip_address);

  RETURN jsonb_build_object('allowed', true);
END;
$$;

-- ── 8c. resolve_invite_token ────────────────────────────────
-- Returns only safe display info — never the invite row itself
CREATE OR REPLACE FUNCTION private.resolve_invite_token(
  p_token_hash text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_invite  record;
  v_room    record;
BEGIN
  SELECT i.id, i.room_id, i.role_key, i.invited_email, i.status, i.expires_at
  INTO   v_invite
  FROM   public.deal_room_invites_v2 i
  WHERE  i.token_hash = p_token_hash;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'not_found');
  END IF;

  IF v_invite.status <> 'pending' THEN
    RETURN jsonb_build_object('valid', false, 'reason', v_invite.status);
  END IF;

  IF v_invite.expires_at < now() THEN
    UPDATE public.deal_room_invites_v2
    SET    status = 'expired' WHERE id = v_invite.id;
    RETURN jsonb_build_object('valid', false, 'reason', 'expired');
  END IF;

  SELECT property_name INTO v_room
  FROM   public.deal_rooms
  WHERE  property_id = v_invite.room_id;

  -- Mask email: show first 2 chars + domain
  RETURN jsonb_build_object(
    'valid',        true,
    'invite_id',    v_invite.id,
    'room_id',      v_invite.room_id,
    'role_key',     v_invite.role_key,
    'room_name',    COALESCE(v_room.property_name, 'this deal room'),
    'masked_email', (
      LEFT(v_invite.invited_email, 2) || '***@' ||
      split_part(v_invite.invited_email, '@', 2)
    ),
    'invited_email', v_invite.invited_email   -- needed by request-otp endpoint only
  );
END;
$$;

-- ── 8d. accept_invite (atomic — the core transaction) ───────
CREATE OR REPLACE FUNCTION private.accept_invite(
  p_token_hash text,
  p_auth_uid   uuid,
  p_email      text,
  p_ip_address text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_invite         record;
  v_participant_id uuid;
  v_role_exists    int;
BEGIN
  -- Advisory lock: prevents concurrent acceptance of same token
  IF NOT pg_try_advisory_xact_lock(hashtext(p_token_hash)) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'concurrent_acceptance');
  END IF;

  -- Fetch and lock invite row
  SELECT id, room_id, role_key, invited_email, status, expires_at
  INTO   v_invite
  FROM   public.deal_room_invites_v2
  WHERE  token_hash = p_token_hash
    AND  status     = 'pending'
  FOR UPDATE;

  IF NOT FOUND THEN
    PERFORM private.log_audit_event(
      NULL, 'authorization', 'access_denied',
      p_auth_uid, p_email, NULL, NULL, NULL, NULL, p_ip_address,
      '{"reason":"invite_not_pending"}'::jsonb
    );
    RETURN jsonb_build_object('ok', false, 'error', 'invite_not_pending');
  END IF;

  -- Expiry check
  IF v_invite.expires_at < now() THEN
    UPDATE public.deal_room_invites_v2 SET status = 'expired' WHERE id = v_invite.id;
    PERFORM private.log_audit_event(
      v_invite.room_id, 'authorization', 'access_denied',
      p_auth_uid, p_email, NULL, NULL, v_invite.id, NULL, p_ip_address,
      '{"reason":"expired"}'::jsonb
    );
    RETURN jsonb_build_object('ok', false, 'error', 'invite_expired');
  END IF;

  -- Email match (normalized)
  IF lower(trim(p_email)) <> v_invite.invited_email THEN
    PERFORM private.log_audit_event(
      v_invite.room_id, 'authorization', 'access_denied',
      p_auth_uid, p_email, NULL, NULL, v_invite.id, NULL, p_ip_address,
      '{"reason":"email_mismatch"}'::jsonb
    );
    RETURN jsonb_build_object('ok', false, 'error', 'email_mismatch');
  END IF;

  -- Mark invite accepted
  UPDATE public.deal_room_invites_v2
  SET    status = 'accepted'
  WHERE  id     = v_invite.id;

  -- Upsert participant identity (one row per person per room)
  INSERT INTO public.deal_room_participants (room_id, auth_uid, status)
  VALUES (v_invite.room_id, p_auth_uid, 'active')
  ON CONFLICT (room_id, auth_uid) DO NOTHING
  RETURNING id INTO v_participant_id;

  IF v_participant_id IS NULL THEN
    SELECT id INTO v_participant_id
    FROM   public.deal_room_participants
    WHERE  room_id   = v_invite.room_id
      AND  auth_uid  = p_auth_uid;
  END IF;

  -- Add role (idempotent — person may accept multiple invites for different roles)
  INSERT INTO public.deal_room_participant_roles
    (participant_id, role_key, invite_id, status)
  VALUES (v_participant_id, v_invite.role_key, v_invite.id, 'active')
  ON CONFLICT (participant_id, role_key) DO NOTHING;

  -- Audit: participant activated
  PERFORM private.log_audit_event(
    v_invite.room_id, 'security', 'participant_activated',
    p_auth_uid, p_email, NULL, NULL, v_invite.id, NULL, p_ip_address,
    jsonb_build_object('role_key', v_invite.role_key)
  );

  RETURN jsonb_build_object(
    'ok',             true,
    'participant_id', v_participant_id,
    'room_id',        v_invite.room_id,
    'role_key',       v_invite.role_key
  );
END;
$$;

-- ── 8e. revoke_participant ───────────────────────────────────
CREATE OR REPLACE FUNCTION private.revoke_participant(
  p_invite_id      uuid,    -- revoke specific role (by invite); NULL = revoke all
  p_participant_id uuid,    -- required when p_invite_id is NULL
  p_revoker_email  text,
  p_ip_address     text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_room_id text;
  v_target  uuid;
BEGIN
  IF p_invite_id IS NOT NULL THEN
    -- Revoke specific role
    UPDATE public.deal_room_participant_roles
    SET    status     = 'revoked',
           revoked_at = now()
    WHERE  invite_id  = p_invite_id
      AND  status     = 'active'
    RETURNING (
      SELECT room_id FROM public.deal_room_participants
      WHERE  id = participant_id
    ) INTO v_room_id;

    UPDATE public.deal_room_invites_v2
    SET    status = 'revoked', revoked_at = now()
    WHERE  id     = p_invite_id;

    -- If participant has no active roles left, revoke identity too
    UPDATE public.deal_room_participants dp
    SET    status     = 'revoked',
           revoked_at = now()
    WHERE  dp.id = (
      SELECT participant_id FROM public.deal_room_participant_roles
      WHERE  invite_id = p_invite_id LIMIT 1
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.deal_room_participant_roles
      WHERE  participant_id = dp.id AND status = 'active'
    );

    PERFORM private.log_audit_event(
      v_room_id, 'security', 'role_revoked',
      NULL, p_revoker_email, NULL, NULL, p_invite_id, NULL, p_ip_address, NULL
    );

  ELSE
    -- Revoke all roles and identity for participant
    SELECT room_id INTO v_room_id
    FROM   public.deal_room_participants
    WHERE  id = p_participant_id;

    UPDATE public.deal_room_participant_roles
    SET    status     = 'revoked',
           revoked_at = now()
    WHERE  participant_id = p_participant_id
      AND  status         = 'active';

    UPDATE public.deal_room_participants
    SET    status     = 'revoked',
           revoked_at = now()
    WHERE  id = p_participant_id;

    SELECT auth_uid INTO v_target
    FROM   public.deal_room_participants WHERE id = p_participant_id;

    PERFORM private.log_audit_event(
      v_room_id, 'security', 'participant_revoked',
      NULL, p_revoker_email, v_target, NULL, NULL, NULL, p_ip_address, NULL
    );
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- ── 8f. rotate_invite_token ─────────────────────────────────
-- Supersedes the existing pending invite, creates a new one.
-- Called when owner reissues an invite.
CREATE OR REPLACE FUNCTION private.rotate_invite_token(
  p_old_invite_id  uuid,
  p_new_token_hash text,
  p_expires_at     timestamptz,
  p_creator_email  text,
  p_ip_address     text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_old record;
  v_new_id uuid;
BEGIN
  -- Supersede the old invite
  UPDATE public.deal_room_invites_v2
  SET    status        = 'superseded',
         superseded_at = now()
  WHERE  id     = p_old_invite_id
    AND  status  = 'pending'
  RETURNING id, room_id, role_key, invited_email INTO v_old;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'invite_not_pending';
  END IF;

  -- Create new invite with rotated token
  INSERT INTO public.deal_room_invites_v2
    (room_id, role_key, invited_email, token_hash, status, expires_at, created_by_email)
  VALUES
    (v_old.room_id, v_old.role_key, v_old.invited_email,
     p_new_token_hash, 'pending', p_expires_at, p_creator_email)
  RETURNING id INTO v_new_id;

  PERFORM private.log_audit_event(
    v_old.room_id, 'security', 'invite_superseded',
    NULL, p_creator_email, NULL, NULL, p_old_invite_id, NULL, p_ip_address,
    jsonb_build_object('new_invite_id', v_new_id)
  );

  RETURN v_new_id;
END;
$$;

-- ── 8g. Restrict all private functions to service_role ───────
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA private FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON ALL FUNCTIONS IN SCHEMA private TO   service_role;

-- ============================================================
-- STEP 9: RLS on new tables
-- NOTE: RLS on deal_rooms and deal_room_documents is intentionally
-- deferred to migration 013, after:
--   - owner_uid backfill is planned and reviewed
--   - All existing owner queries are confirmed to carry valid JWTs
--   - Full staging walkthrough of owner operations passes
-- ============================================================

ALTER TABLE deal_room_invites_v2         ENABLE ROW LEVEL SECURITY;
ALTER TABLE deal_room_participants        ENABLE ROW LEVEL SECURITY;
ALTER TABLE deal_room_participant_roles   ENABLE ROW LEVEL SECURITY;
ALTER TABLE deal_room_audit_log           ENABLE ROW LEVEL SECURITY;
ALTER TABLE deal_room_otp_requests        ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_visible_to_roles     ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_visible_to_participants ENABLE ROW LEVEL SECURITY;

-- deal_room_invites_v2: owners see their room's invites; no participant access
CREATE POLICY "invites_v2_owner_read" ON deal_room_invites_v2
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.deal_rooms dr
      WHERE  dr.property_id     = deal_room_invites_v2.room_id
        AND  lower(trim(dr.customer_email)) = lower(trim(auth.jwt()->>'email'))
    )
  );

-- deal_room_participants: participant sees own row; owner sees all for their room
CREATE POLICY "participants_self_read" ON deal_room_participants
  FOR SELECT
  USING (auth_uid = auth.uid());

CREATE POLICY "participants_owner_read" ON deal_room_participants
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.deal_rooms dr
      WHERE  dr.property_id     = deal_room_participants.room_id
        AND  lower(trim(dr.customer_email)) = lower(trim(auth.jwt()->>'email'))
    )
  );

-- deal_room_participant_roles: participant sees own roles; owner sees all
CREATE POLICY "roles_self_read" ON deal_room_participant_roles
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.deal_room_participants p
      WHERE  p.id       = deal_room_participant_roles.participant_id
        AND  p.auth_uid = auth.uid()
    )
  );

CREATE POLICY "roles_owner_read" ON deal_room_participant_roles
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.deal_room_participants p
      JOIN   public.deal_rooms dr ON dr.property_id = p.room_id
      WHERE  p.id = deal_room_participant_roles.participant_id
        AND  lower(trim(dr.customer_email)) = lower(trim(auth.jwt()->>'email'))
    )
  );

-- deal_room_audit_log: owner reads their room's log; no participant access
CREATE POLICY "audit_log_owner_read" ON deal_room_audit_log
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.deal_rooms dr
      WHERE  dr.property_id     = deal_room_audit_log.room_id
        AND  lower(trim(dr.customer_email)) = lower(trim(auth.jwt()->>'email'))
    )
  );

-- OTP requests and visibility tables: no direct user access (service_role only)
CREATE POLICY "otp_requests_deny_all"         ON deal_room_otp_requests
  USING (false);
CREATE POLICY "doc_visible_roles_deny_all"    ON document_visible_to_roles
  USING (false);
CREATE POLICY "doc_visible_individuals_deny_all" ON document_visible_to_participants
  USING (false);

-- Service role bypass (all new tables)
CREATE POLICY "service_role_all_invites_v2"      ON deal_room_invites_v2
  FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "service_role_all_participants"     ON deal_room_participants
  FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "service_role_all_roles"            ON deal_room_participant_roles
  FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "service_role_all_audit"            ON deal_room_audit_log
  FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "service_role_all_otp"              ON deal_room_otp_requests
  FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "service_role_doc_roles"            ON document_visible_to_roles
  FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "service_role_doc_individuals"      ON document_visible_to_participants
  FOR ALL USING (auth.role() = 'service_role');

COMMIT;

-- ============================================================
-- POST-MIGRATION NOTES
-- 1. Add SUPABASE_DB_URL to Render environment (Supabase project
--    Settings → Database → Connection string → Transaction mode)
-- 2. Test every private.* function individually in staging
-- 3. Run the full test matrix before enabling auth_v2_enabled on any room
-- 4. Migration 013 will add RLS to deal_rooms and deal_room_documents
--    after owner_uid backfill is confirmed safe
-- ============================================================
