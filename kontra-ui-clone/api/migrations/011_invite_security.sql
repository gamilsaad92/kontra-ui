-- ============================================================
-- 011_invite_security.sql
-- Per-invitation access control with server-side session enforcement.
-- Replaces the old role-wide PIN system (deal_room_pins / verify_deal_room_pin).
-- Safe to re-run (idempotent).
-- ============================================================

-- ── 1. deal_room_invites ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS deal_room_invites (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id         TEXT        NOT NULL,
  role_key            TEXT        NOT NULL,
  invited_email       TEXT,                        -- nullable for PIN-only invites
  invite_token_hash   TEXT        NOT NULL UNIQUE, -- sha256(hex) of the raw URL token
  verification_method TEXT        NOT NULL DEFAULT 'pin'
                        CHECK (verification_method IN ('email_otp', 'pin')),
  pin_hash            TEXT,                        -- sha256(hex) of the raw PIN; only for pin method
  status              TEXT        NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'accepted', 'revoked', 'expired')),
  attempt_count       INT         NOT NULL DEFAULT 0,
  locked_until        TIMESTAMPTZ,
  expires_at          TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '30 days'),
  accepted_at         TIMESTAMPTZ,
  revoked_at          TIMESTAMPTZ,
  created_by          TEXT,                        -- owner email
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invites_property ON deal_room_invites (property_id);
CREATE INDEX IF NOT EXISTS idx_invites_token    ON deal_room_invites (invite_token_hash);
CREATE INDEX IF NOT EXISTS idx_invites_email    ON deal_room_invites (invited_email);

-- ── 2. deal_room_access_sessions ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS deal_room_access_sessions (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  invite_id          UUID        NOT NULL REFERENCES deal_room_invites (id) ON DELETE CASCADE,
  session_token_hash TEXT        NOT NULL UNIQUE, -- sha256(hex) of the raw session token
  expires_at         TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '8 hours'),
  revoked_at         TIMESTAMPTZ,
  last_used_at       TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_sessions_invite  ON deal_room_access_sessions (invite_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token   ON deal_room_access_sessions (session_token_hash);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON deal_room_access_sessions (expires_at);

-- ── 3. RLS on new tables ─────────────────────────────────────────────────────
ALTER TABLE deal_room_invites         ENABLE ROW LEVEL SECURITY;
ALTER TABLE deal_room_access_sessions ENABLE ROW LEVEL SECURITY;

-- Service role (backend) has full access to both tables.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='deal_room_invites' AND policyname='service_role_invites') THEN
    CREATE POLICY "service_role_invites" ON deal_room_invites
      FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='deal_room_access_sessions' AND policyname='service_role_sessions') THEN
    CREATE POLICY "service_role_sessions" ON deal_room_access_sessions
      FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
  END IF;
END $$;

-- ── 4. Helper: extract session token from PostgREST request headers ──────────
CREATE OR REPLACE FUNCTION get_kontra_session_header()
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_raw TEXT;
BEGIN
  v_raw := current_setting('request.headers', true);
  IF v_raw IS NULL OR v_raw = '' THEN RETURN NULL; END IF;
  RETURN nullif(trim(v_raw::json->>'x-kontra-session'), '');
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$;

-- ── 5. Helper: validate a session token for a given property ─────────────────
--    Used inside RLS policies — runs SECURITY DEFINER so it can read sessions.
CREATE OR REPLACE FUNCTION validate_session_for_property(p_property_id TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token TEXT;
BEGIN
  v_token := get_kontra_session_header();
  IF v_token IS NULL THEN RETURN FALSE; END IF;
  RETURN EXISTS (
    SELECT 1
    FROM   deal_room_access_sessions das
    JOIN   deal_room_invites         dri ON dri.id = das.invite_id
    WHERE  dri.property_id         = p_property_id
      AND  das.session_token_hash  = encode(sha256(v_token::bytea), 'hex')
      AND  das.expires_at          > now()
      AND  das.revoked_at         IS NULL
      AND  dri.status NOT IN ('revoked', 'expired')
  );
EXCEPTION WHEN OTHERS THEN
  RETURN FALSE;
END;
$$;

-- ── 6. get_invite_status — safe metadata; no hashes exposed ─────────────────
CREATE OR REPLACE FUNCTION get_invite_status(p_invite_token TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hash   TEXT;
  v_invite deal_room_invites%ROWTYPE;
BEGIN
  IF p_invite_token IS NULL OR length(trim(p_invite_token)) < 8 THEN
    RETURN json_build_object('invite_exists', false, 'error', 'invalid_token');
  END IF;

  v_hash := encode(sha256(trim(p_invite_token)::bytea), 'hex');
  SELECT * INTO v_invite FROM deal_room_invites WHERE invite_token_hash = v_hash;
  IF NOT FOUND THEN
    RETURN json_build_object('invite_exists', false);
  END IF;

  -- Mark expired automatically
  IF v_invite.expires_at < now() AND v_invite.status = 'pending' THEN
    UPDATE deal_room_invites SET status = 'expired' WHERE id = v_invite.id;
    v_invite.status := 'expired';
  END IF;

  RETURN json_build_object(
    'invite_exists',         true,
    'status',                v_invite.status,
    'role_key',              v_invite.role_key,
    'property_id',           v_invite.property_id,
    'verification_method',   v_invite.verification_method,
    -- Mask email: show first 2 chars + domain only
    'invited_email_masked',  CASE
      WHEN v_invite.invited_email IS NOT NULL
      THEN left(v_invite.invited_email, 2) || '***@' || split_part(v_invite.invited_email, '@', 2)
      ELSE NULL END,
    'locked_until',          v_invite.locked_until,
    'attempt_count',         v_invite.attempt_count
  );
END;
$$;

-- ── 7. verify_invite_credential — PIN verification with server-side lockout ──
CREATE OR REPLACE FUNCTION verify_invite_credential(
  p_invite_token TEXT,   -- raw URL token
  p_credential   TEXT    -- raw PIN (will be hashed server-side)
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hash         TEXT;
  v_invite       deal_room_invites%ROWTYPE;
  v_cred_hash    TEXT;
  v_sess_token   TEXT;
  v_sess_hash    TEXT;
BEGIN
  IF p_invite_token IS NULL OR p_credential IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'missing_params');
  END IF;

  v_hash := encode(sha256(trim(p_invite_token)::bytea), 'hex');
  SELECT * INTO v_invite FROM deal_room_invites WHERE invite_token_hash = v_hash;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'not_found');
  END IF;
  IF v_invite.status = 'revoked' THEN
    RETURN json_build_object('success', false, 'error', 'revoked');
  END IF;
  IF v_invite.expires_at < now() THEN
    UPDATE deal_room_invites SET status = 'expired' WHERE id = v_invite.id;
    RETURN json_build_object('success', false, 'error', 'expired');
  END IF;
  IF v_invite.locked_until IS NOT NULL AND v_invite.locked_until > now() THEN
    RETURN json_build_object('success', false, 'error', 'locked', 'locked_until', v_invite.locked_until);
  END IF;

  -- Verify credential (PIN hash comparison — server-side only)
  v_cred_hash := encode(sha256(trim(p_credential)::bytea), 'hex');
  IF v_invite.pin_hash IS NULL OR v_invite.pin_hash != v_cred_hash THEN
    UPDATE deal_room_invites
    SET
      attempt_count = attempt_count + 1,
      locked_until  = CASE WHEN attempt_count + 1 >= 5 THEN now() + INTERVAL '15 minutes' ELSE NULL END
    WHERE id = v_invite.id;
    RETURN json_build_object(
      'success',           false,
      'error',             'wrong_credential',
      'attempts_remaining', GREATEST(0, 4 - v_invite.attempt_count)
    );
  END IF;

  -- Correct — generate session token
  v_sess_token := encode(gen_random_bytes(32), 'hex');
  v_sess_hash  := encode(sha256(v_sess_token::bytea), 'hex');

  INSERT INTO deal_room_access_sessions (invite_id, session_token_hash, expires_at)
  VALUES (v_invite.id, v_sess_hash, now() + INTERVAL '8 hours');

  UPDATE deal_room_invites
  SET status       = 'accepted',
      accepted_at  = COALESCE(accepted_at, now()),
      attempt_count = 0,
      locked_until  = NULL
  WHERE id = v_invite.id;

  RETURN json_build_object(
    'success',      true,
    'session_token', v_sess_token,   -- raw; store in memory/sessionStorage
    'role_key',     v_invite.role_key,
    'property_id',  v_invite.property_id,
    'expires_at',   (now() + INTERVAL '8 hours')
  );
END;
$$;

-- ── 8. create_invite_session_for_email — after Supabase Auth OTP is verified ─
--    Only valid for email_otp invites with a non-null invited_email.
--    Caller must be authenticated (auth.email() returns invited email).
CREATE OR REPLACE FUNCTION create_invite_session_for_email(p_invite_token TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_email TEXT;
  v_hash       TEXT;
  v_invite     deal_room_invites%ROWTYPE;
  v_sess_token TEXT;
  v_sess_hash  TEXT;
BEGIN
  v_user_email := auth.email();
  IF v_user_email IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  v_hash := encode(sha256(trim(p_invite_token)::bytea), 'hex');
  SELECT * INTO v_invite FROM deal_room_invites WHERE invite_token_hash = v_hash;
  IF NOT FOUND   THEN RETURN json_build_object('success', false, 'error', 'not_found');   END IF;
  IF v_invite.status = 'revoked' THEN RETURN json_build_object('success', false, 'error', 'revoked'); END IF;
  IF v_invite.expires_at < now() THEN RETURN json_build_object('success', false, 'error', 'expired'); END IF;

  -- Only email_otp invites may use this path; PIN invites must use verify_invite_credential.
  IF v_invite.verification_method != 'email_otp' THEN
    RETURN json_build_object('success', false, 'error', 'wrong_verification_method');
  END IF;

  -- invited_email is mandatory for email_otp invites.
  IF v_invite.invited_email IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'invite_misconfigured');
  END IF;

  -- The authenticated user must be the exact invited email.
  IF lower(v_invite.invited_email) != lower(v_user_email) THEN
    RETURN json_build_object('success', false, 'error', 'email_mismatch');
  END IF;

  v_sess_token := encode(gen_random_bytes(32), 'hex');
  v_sess_hash  := encode(sha256(v_sess_token::bytea), 'hex');

  INSERT INTO deal_room_access_sessions (invite_id, session_token_hash, expires_at)
  VALUES (v_invite.id, v_sess_hash, now() + INTERVAL '8 hours');

  UPDATE deal_room_invites
  SET status = 'accepted', accepted_at = COALESCE(accepted_at, now())
  WHERE id = v_invite.id;

  RETURN json_build_object(
    'success',       true,
    'session_token', v_sess_token,
    'role_key',      v_invite.role_key,
    'property_id',   v_invite.property_id,
    'expires_at',    (now() + INTERVAL '8 hours')
  );
END;
$$;

-- ── 9. create_deal_room_invite — owner creates an invite record ──────────────
CREATE OR REPLACE FUNCTION create_deal_room_invite(
  p_invite_token        TEXT,
  p_property_id         TEXT,
  p_role_key            TEXT,
  p_invited_email       TEXT,
  p_verification_method TEXT,  -- 'email_otp' or 'pin'
  p_pin                 TEXT   -- raw PIN; only for pin method
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_email TEXT;
  v_room        deal_rooms%ROWTYPE;
  v_token_hash  TEXT;
  v_pin_hash    TEXT;
BEGIN
  v_owner_email := auth.email();
  IF v_owner_email IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'not_authenticated');
  END IF;
  IF p_verification_method NOT IN ('email_otp', 'pin') THEN
    RETURN json_build_object('success', false, 'error', 'invalid_method');
  END IF;

  SELECT * INTO v_room FROM deal_rooms WHERE property_id = p_property_id;
  IF NOT FOUND OR lower(v_room.customer_email) != lower(v_owner_email) THEN
    RETURN json_build_object('success', false, 'error', 'not_owner');
  END IF;

  v_token_hash := encode(sha256(trim(p_invite_token)::bytea), 'hex');
  IF p_verification_method = 'pin' AND p_pin IS NOT NULL THEN
    v_pin_hash := encode(sha256(trim(p_pin)::bytea), 'hex');
  END IF;

  INSERT INTO deal_room_invites
    (property_id, role_key, invited_email, invite_token_hash,
     verification_method, pin_hash, created_by)
  VALUES
    (p_property_id, p_role_key, p_invited_email, v_token_hash,
     p_verification_method, v_pin_hash, v_owner_email);

  RETURN json_build_object('success', true);
EXCEPTION
  WHEN unique_violation THEN
    RETURN json_build_object('success', false, 'error', 'token_conflict');
END;
$$;

-- ── 10. revoke_deal_room_invite — owner revokes a single invite ───────────────
CREATE OR REPLACE FUNCTION revoke_deal_room_invite(p_invite_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_email TEXT;
  v_invite      deal_room_invites%ROWTYPE;
  v_room        deal_rooms%ROWTYPE;
BEGIN
  v_owner_email := auth.email();
  IF v_owner_email IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  SELECT * INTO v_invite FROM deal_room_invites WHERE id = p_invite_id;
  IF NOT FOUND THEN RETURN json_build_object('success', false, 'error', 'not_found'); END IF;

  SELECT * INTO v_room FROM deal_rooms WHERE property_id = v_invite.property_id;
  IF NOT FOUND OR lower(v_room.customer_email) != lower(v_owner_email) THEN
    RETURN json_build_object('success', false, 'error', 'not_owner');
  END IF;

  UPDATE deal_room_invites        SET status = 'revoked', revoked_at = now() WHERE id = p_invite_id;
  UPDATE deal_room_access_sessions SET revoked_at = now()
    WHERE invite_id = p_invite_id AND revoked_at IS NULL;

  RETURN json_build_object('success', true);
END;
$$;

-- ── 11. get_room_invites — owner reads all invite records for a room ──────────
CREATE OR REPLACE FUNCTION get_room_invites(p_property_id TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_email TEXT;
  v_room        deal_rooms%ROWTYPE;
BEGIN
  v_owner_email := auth.email();
  IF v_owner_email IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  SELECT * INTO v_room FROM deal_rooms WHERE property_id = p_property_id;
  IF NOT FOUND OR lower(v_room.customer_email) != lower(v_owner_email) THEN
    RETURN json_build_object('success', false, 'error', 'not_owner');
  END IF;

  RETURN (
    SELECT COALESCE(json_agg(row ORDER BY row.created_at DESC), '[]'::json)
    FROM (
      SELECT
        dri.id,
        dri.role_key,
        dri.invited_email,
        dri.verification_method,
        dri.status,
        dri.attempt_count,
        dri.locked_until,
        dri.created_at,
        dri.accepted_at,
        dri.revoked_at,
        dri.expires_at,
        (SELECT max(das.last_used_at)
         FROM deal_room_access_sessions das
         WHERE das.invite_id = dri.id) AS last_seen_at
      FROM deal_room_invites dri
      WHERE dri.property_id = p_property_id
    ) row
  );
END;
$$;

-- ── 12. touch_session — update last_used_at when participant makes a query ────
CREATE OR REPLACE FUNCTION touch_session(p_session_token TEXT)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE deal_room_access_sessions
  SET last_used_at = now()
  WHERE session_token_hash = encode(sha256(trim(p_session_token)::bytea), 'hex')
    AND expires_at > now()
    AND revoked_at IS NULL;
$$;

-- ── 13. RLS — restrict deal_rooms to owners and valid session holders ─────────
-- Drop the old catch-all policy that allowed anyone to read deal_rooms.
DROP POLICY IF EXISTS "Service role full access" ON deal_rooms;

-- Service role (Render API) always has full access — bypasses RLS automatically,
-- but an explicit policy guards against future role changes.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='deal_rooms' AND policyname='service_role_deal_rooms') THEN
    CREATE POLICY "service_role_deal_rooms" ON deal_rooms
      FOR ALL
      USING (auth.role() = 'service_role')
      WITH CHECK (auth.role() = 'service_role');
  END IF;
END $$;

-- Authenticated owner: Supabase Auth session whose email matches the room.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='deal_rooms' AND policyname='owner_read_deal_rooms') THEN
    CREATE POLICY "owner_read_deal_rooms" ON deal_rooms
      FOR SELECT
      USING (auth.email() IS NOT NULL AND lower(auth.email()) = lower(customer_email));
  END IF;
END $$;

-- Participant with a valid invite session token (passed as x-kontra-session header).
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='deal_rooms' AND policyname='participant_session_deal_rooms') THEN
    CREATE POLICY "participant_session_deal_rooms" ON deal_rooms
      FOR SELECT
      USING (validate_session_for_property(property_id));
  END IF;
END $$;

-- ── 14. RLS — deal_analyses (document AI results) ────────────────────────────
DROP POLICY IF EXISTS "Service role full access" ON deal_analyses;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='deal_analyses' AND policyname='service_role_deal_analyses') THEN
    CREATE POLICY "service_role_deal_analyses" ON deal_analyses
      FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='deal_analyses' AND policyname='owner_read_deal_analyses') THEN
    CREATE POLICY "owner_read_deal_analyses" ON deal_analyses
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM deal_rooms dr
          WHERE dr.property_id = deal_analyses.property_id
            AND lower(auth.email()) = lower(dr.customer_email)
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='deal_analyses' AND policyname='participant_session_deal_analyses') THEN
    CREATE POLICY "participant_session_deal_analyses" ON deal_analyses
      FOR SELECT USING (validate_session_for_property(property_id));
  END IF;
END $$;

-- ── 15. RLS — party_submissions ───────────────────────────────────────────────
DROP POLICY IF EXISTS "Service role full access" ON party_submissions;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='party_submissions' AND policyname='service_role_party_submissions') THEN
    CREATE POLICY "service_role_party_submissions" ON party_submissions
      FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='party_submissions' AND policyname='owner_read_party_submissions') THEN
    CREATE POLICY "owner_read_party_submissions" ON party_submissions
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM deal_rooms dr
          WHERE dr.property_id = party_submissions.property_id
            AND lower(auth.email()) = lower(dr.customer_email)
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='party_submissions' AND policyname='participant_session_party_submissions') THEN
    CREATE POLICY "participant_session_party_submissions" ON party_submissions
      FOR SELECT USING (validate_session_for_property(property_id));
  END IF;
END $$;

-- ── 16. Drop the old verify_deal_room_pin RPC ─────────────────────────────────
DROP FUNCTION IF EXISTS verify_deal_room_pin(TEXT, TEXT, TEXT);

-- ── 17. Storage bucket policy (advisory — apply manually in Supabase Dashboard)
-- Bucket: deal-room-documents
-- Policy: allow SELECT (download) when validate_session_for_property() returns true
--         OR auth.email() matches the room owner.
-- The SQL for this must be applied via the Supabase Dashboard Storage UI since
-- storage.objects RLS is managed separately from the public schema.
-- See: kontra-ui-clone/api/migrations/011_storage_policy.md
