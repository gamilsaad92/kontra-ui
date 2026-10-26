-- Repeatable, source-linked tenant/suite evidence and auditable participant
-- submissions. This migration is intentionally additive and is not executed
-- by the application.
BEGIN;

CREATE TABLE IF NOT EXISTS public.transaction_record_party_relationships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id text NOT NULL REFERENCES public.deal_rooms(property_id) ON DELETE CASCADE,
  role_key text NOT NULL DEFAULT 'tenant' CHECK (role_key = 'tenant'),
  party_name text NOT NULL CHECK (btrim(party_name) <> ''),
  suite text NOT NULL CHECK (btrim(suite) <> ''),
  suite_key text NOT NULL CHECK (btrim(suite_key) <> ''),
  attributes jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(attributes) = 'object'),
  candidate_key text NOT NULL,
  status text NOT NULL DEFAULT 'awaiting'
    CHECK (status IN ('awaiting', 'conflict', 'verified', 'rejected', 'source_changed')),
  source_doc_id uuid REFERENCES public.deal_analyses(id) ON DELETE SET NULL,
  source_doc_version text,
  source_file_hash text NOT NULL,
  source_page integer,
  source_excerpt text NOT NULL,
  verified_by text,
  verified_role text,
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (property_id, source_doc_id, candidate_key)
);
CREATE INDEX IF NOT EXISTS transaction_record_party_relationships_room_suite_idx
  ON public.transaction_record_party_relationships(property_id, suite_key, status);
CREATE INDEX IF NOT EXISTS transaction_record_party_relationships_source_idx
  ON public.transaction_record_party_relationships(property_id, source_doc_id);

CREATE TABLE IF NOT EXISTS public.transaction_record_party_relationship_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  relationship_id uuid REFERENCES public.transaction_record_party_relationships(id) ON DELETE SET NULL,
  property_id text NOT NULL,
  action text NOT NULL CHECK (action IN ('extracted', 'verified', 'rejected', 'source_changed', 'conflict_detected')),
  actor_id text,
  actor_type text NOT NULL CHECK (actor_type IN ('system', 'owner', 'participant')),
  actor_role text,
  before_state jsonb,
  after_state jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS transaction_record_party_relationship_history_room_idx
  ON public.transaction_record_party_relationship_history(property_id, created_at);

CREATE TABLE IF NOT EXISTS public.participant_submission_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id text NOT NULL,
  role text NOT NULL,
  invite_id uuid REFERENCES public.deal_room_invites(id) ON DELETE SET NULL,
  actor_id text NOT NULL,
  actor_email text,
  actor_type text NOT NULL DEFAULT 'participant' CHECK (actor_type = 'participant'),
  doc_count integer NOT NULL DEFAULT 0 CHECK (doc_count >= 0),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS participant_submission_events_room_role_idx
  ON public.participant_submission_events(property_id, role, created_at);

CREATE OR REPLACE FUNCTION public.kontra_mark_tenant_evidence_source_changed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
BEGIN
  IF OLD.is_active IS TRUE AND NEW.is_active IS FALSE THEN
    INSERT INTO public.transaction_record_party_relationship_history
      (relationship_id, property_id, action, actor_type, before_state, after_state)
    SELECT id, property_id, 'source_changed', 'system', to_jsonb(candidate),
           jsonb_set(to_jsonb(candidate), '{status}', '"source_changed"'::jsonb)
      FROM public.transaction_record_party_relationships candidate
     WHERE source_doc_id = NEW.id AND status NOT IN ('rejected', 'source_changed');
    UPDATE public.transaction_record_party_relationships
       SET status = 'source_changed', updated_at = clock_timestamp()
     WHERE source_doc_id = NEW.id AND status NOT IN ('rejected', 'source_changed');
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_tenant_evidence_source_superseded ON public.deal_analyses;
CREATE TRIGGER trg_tenant_evidence_source_superseded
  AFTER UPDATE OF is_active ON public.deal_analyses
  FOR EACH ROW EXECUTE FUNCTION public.kontra_mark_tenant_evidence_source_changed();

ALTER TABLE public.transaction_record_party_relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transaction_record_party_relationship_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.participant_submission_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS service_role_tenant_relationships ON public.transaction_record_party_relationships;
CREATE POLICY service_role_tenant_relationships ON public.transaction_record_party_relationships
  FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS service_role_tenant_relationship_history ON public.transaction_record_party_relationship_history;
CREATE POLICY service_role_tenant_relationship_history ON public.transaction_record_party_relationship_history
  FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS service_role_participant_submission_events ON public.participant_submission_events;
CREATE POLICY service_role_participant_submission_events ON public.participant_submission_events
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.kontra_record_participant_submission(
  p_property_id text,
  p_invite_id uuid,
  p_doc_count integer,
  p_notes text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_invite public.deal_room_invites%ROWTYPE;
  v_now timestamptz := clock_timestamp();
  v_submission public.party_submissions%ROWTYPE;
BEGIN
  IF p_property_id IS NULL OR p_invite_id IS NULL OR COALESCE(p_doc_count, -1) < 0 THEN
    RAISE EXCEPTION 'Invalid participant submission' USING ERRCODE = '22023';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('kontra:submission:' || p_property_id, 0));
  SELECT * INTO v_invite
    FROM public.deal_room_invites
   WHERE id = p_invite_id AND property_id = p_property_id
   FOR UPDATE;
  IF NOT FOUND OR v_invite.status <> 'accepted'
     OR v_invite.revoked_at IS NOT NULL
     OR (v_invite.expires_at IS NOT NULL AND v_invite.expires_at <= v_now)
     OR v_invite.role_key = '__room_owner__' THEN
    RAISE EXCEPTION 'Accepted participant invitation required' USING ERRCODE = '42501';
  END IF;
  INSERT INTO public.party_submissions(property_id, role, name, email, doc_count, submitted_at, notes)
  VALUES (p_property_id, v_invite.role_key, v_invite.role_key, v_invite.invited_email,
          p_doc_count, v_now, NULLIF(left(COALESCE(p_notes, ''), 2000), ''))
  ON CONFLICT (property_id, role) DO UPDATE SET
    name = EXCLUDED.name,
    email = EXCLUDED.email,
    doc_count = EXCLUDED.doc_count,
    submitted_at = EXCLUDED.submitted_at,
    notes = EXCLUDED.notes
  RETURNING * INTO v_submission;
  INSERT INTO public.participant_submission_events
    (property_id, role, invite_id, actor_id, actor_email, actor_type, doc_count, notes, created_at)
  VALUES (p_property_id, v_invite.role_key, p_invite_id::text, p_invite_id::text,
          v_invite.invited_email, 'participant', p_doc_count,
          NULLIF(left(COALESCE(p_notes, ''), 2000), ''), v_now);
  RETURN jsonb_build_object(
    'property_id', v_submission.property_id, 'role', v_submission.role,
    'doc_count', v_submission.doc_count, 'submitted_at', v_submission.submitted_at,
    'actor_invite_id', p_invite_id
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.kontra_record_participant_submission(text, uuid, integer, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.kontra_record_participant_submission(text, uuid, integer, text) TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.transaction_record_party_relationships TO service_role;
GRANT SELECT, INSERT ON public.transaction_record_party_relationship_history TO service_role;
GRANT SELECT, INSERT ON public.participant_submission_events TO service_role;

CREATE OR REPLACE FUNCTION public.kontra_replace_tenant_relationship_candidates(
  p_property_id text,
  p_source_doc_id uuid,
  p_source_file_hash text,
  p_candidates jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_candidate jsonb;
  v_row public.transaction_record_party_relationships%ROWTYPE;
  v_now timestamptz := clock_timestamp();
  v_inserted integer := 0;
BEGIN
  IF jsonb_typeof(p_candidates) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Tenant candidates must be an array' USING ERRCODE = '22023';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('kontra:canonical-state:' || p_property_id, 0));
  IF NOT EXISTS (
    SELECT 1 FROM public.deal_analyses
     WHERE id = p_source_doc_id AND property_id = p_property_id
       AND section = 'rent_roll' AND is_active
       AND superseded_at IS NULL AND source_hash = p_source_file_hash
  ) THEN
    RETURN jsonb_build_object('status', 'stale_source', 'count', 0);
  END IF;
  INSERT INTO public.transaction_record_party_relationship_history
    (relationship_id, property_id, action, actor_type, before_state, after_state)
  SELECT id, property_id, 'source_changed', 'system', to_jsonb(candidate),
         jsonb_set(to_jsonb(candidate), '{status}', '"source_changed"'::jsonb)
    FROM public.transaction_record_party_relationships candidate
   WHERE property_id = p_property_id AND source_doc_id <> p_source_doc_id
     AND status NOT IN ('rejected', 'source_changed');
  UPDATE public.transaction_record_party_relationships
     SET status = 'source_changed', updated_at = v_now
   WHERE property_id = p_property_id AND source_doc_id <> p_source_doc_id
     AND status NOT IN ('rejected', 'source_changed');
  FOR v_candidate IN SELECT value FROM jsonb_array_elements(p_candidates)
  LOOP
    IF NULLIF(btrim(v_candidate->>'party_name'), '') IS NULL
       OR NULLIF(btrim(v_candidate->>'suite'), '') IS NULL
       OR NULLIF(v_candidate->>'candidate_key', '') IS NULL
       OR NULLIF(v_candidate->>'source_excerpt', '') IS NULL
       OR (v_candidate->>'source_file_hash') IS DISTINCT FROM p_source_file_hash THEN
      RAISE EXCEPTION 'Tenant candidate is missing source-grounded fields' USING ERRCODE = '22023';
    END IF;
    INSERT INTO public.transaction_record_party_relationships
      (property_id, party_name, suite, suite_key, attributes, candidate_key,
       source_doc_id, source_doc_version, source_file_hash, source_page, source_excerpt)
    VALUES
      (p_property_id, v_candidate->>'party_name', v_candidate->>'suite',
       v_candidate->>'suite_key', COALESCE(v_candidate->'attributes', '{}'::jsonb),
       v_candidate->>'candidate_key', p_source_doc_id,
       NULLIF(v_candidate->>'source_doc_version', ''), p_source_file_hash,
       NULLIF(v_candidate->>'source_page', '')::integer, v_candidate->>'source_excerpt')
    ON CONFLICT (property_id, source_doc_id, candidate_key) DO NOTHING;
    GET DIAGNOSTICS v_inserted = ROW_COUNT;
    IF v_inserted > 0 THEN
      SELECT * INTO v_row FROM public.transaction_record_party_relationships
       WHERE property_id = p_property_id AND source_doc_id = p_source_doc_id
         AND candidate_key = v_candidate->>'candidate_key';
      INSERT INTO public.transaction_record_party_relationship_history
        (relationship_id, property_id, action, actor_type, after_state)
      VALUES (v_row.id, p_property_id, 'extracted', 'system', to_jsonb(v_row));
    END IF;
  END LOOP;
  WITH transitioned AS (
    UPDATE public.transaction_record_party_relationships candidate
       SET status = 'conflict', updated_at = v_now
     WHERE candidate.property_id = p_property_id
       AND candidate.source_doc_id = p_source_doc_id
       AND candidate.status = 'awaiting'
       AND EXISTS (
         SELECT 1 FROM public.transaction_record_party_relationships other
          WHERE other.property_id = candidate.property_id
            AND other.source_doc_id = candidate.source_doc_id
            AND other.suite_key = candidate.suite_key
            AND lower(other.party_name) <> lower(candidate.party_name)
       )
    RETURNING candidate.*
  )
  INSERT INTO public.transaction_record_party_relationship_history
    (relationship_id, property_id, action, actor_type, after_state)
  SELECT id, property_id, 'conflict_detected', 'system', to_jsonb(transitioned)
    FROM transitioned;
  RETURN jsonb_build_object('status', 'committed', 'count',
    (SELECT count(*) FROM public.transaction_record_party_relationships
      WHERE property_id = p_property_id AND source_doc_id = p_source_doc_id));
END;
$function$;

CREATE OR REPLACE FUNCTION public.kontra_review_tenant_relationship(
  p_property_id text,
  p_relationship_id uuid,
  p_decision text,
  p_actor_id text,
  p_actor_role text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_target public.transaction_record_party_relationships%ROWTYPE;
  v_row public.transaction_record_party_relationships%ROWTYPE;
  v_now timestamptz := clock_timestamp();
BEGIN
  IF p_decision NOT IN ('verify', 'reject') OR NULLIF(p_actor_id, '') IS NULL
     OR p_actor_role <> 'owner' THEN
    RAISE EXCEPTION 'Invalid tenant review' USING ERRCODE = '22023';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('kontra:canonical-state:' || p_property_id, 0));
  SELECT * INTO v_target FROM public.transaction_record_party_relationships
   WHERE id = p_relationship_id AND property_id = p_property_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('status', 'not_found'); END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.deal_analyses
     WHERE id = v_target.source_doc_id AND property_id = p_property_id
       AND is_active AND superseded_at IS NULL
       AND source_hash = v_target.source_file_hash
  ) THEN
     IF v_target.status <> 'source_changed' THEN
       INSERT INTO public.transaction_record_party_relationship_history
         (relationship_id, property_id, action, actor_type, before_state, after_state)
       VALUES (
         v_target.id, p_property_id, 'source_changed', 'system', to_jsonb(v_target),
         jsonb_set(to_jsonb(v_target), '{status}', '"source_changed"'::jsonb)
       );
     END IF;
    UPDATE public.transaction_record_party_relationships
       SET status = 'source_changed', updated_at = v_now
     WHERE id = p_relationship_id;
    RETURN jsonb_build_object('status', 'stale_source');
  END IF;
  INSERT INTO public.transaction_record_party_relationship_history
    (relationship_id, property_id, action, actor_id, actor_type, actor_role, before_state, after_state)
  SELECT id, p_property_id,
         CASE WHEN id = p_relationship_id AND p_decision = 'verify' THEN 'verified' ELSE 'rejected' END,
         p_actor_id, 'owner', p_actor_role, to_jsonb(candidate),
         jsonb_set(to_jsonb(candidate), '{status}',
           to_jsonb(CASE WHEN id = p_relationship_id AND p_decision = 'verify'
                         THEN 'verified' ELSE 'rejected' END))
    FROM public.transaction_record_party_relationships candidate
   WHERE (id = p_relationship_id OR
         (p_decision = 'verify' AND property_id = p_property_id
          AND suite_key = v_target.suite_key AND source_doc_id = v_target.source_doc_id));
  UPDATE public.transaction_record_party_relationships
     SET status = CASE WHEN id = p_relationship_id AND p_decision = 'verify' THEN 'verified'
                       WHEN id = p_relationship_id THEN 'rejected'
                       WHEN p_decision = 'verify' AND suite_key = v_target.suite_key
                         AND source_doc_id = v_target.source_doc_id THEN 'rejected'
                       ELSE status END,
         verified_by = CASE WHEN id = p_relationship_id AND p_decision = 'verify' THEN p_actor_id ELSE verified_by END,
         verified_role = CASE WHEN id = p_relationship_id AND p_decision = 'verify' THEN p_actor_role ELSE verified_role END,
         verified_at = CASE WHEN id = p_relationship_id AND p_decision = 'verify' THEN v_now ELSE verified_at END,
         updated_at = v_now
   WHERE id = p_relationship_id OR
     (p_decision = 'verify' AND property_id = p_property_id
      AND suite_key = v_target.suite_key AND source_doc_id = v_target.source_doc_id);
  RETURN jsonb_build_object('status', 'committed');
END;
$function$;

REVOKE ALL ON FUNCTION public.kontra_replace_tenant_relationship_candidates(text, uuid, text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.kontra_review_tenant_relationship(text, uuid, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.kontra_replace_tenant_relationship_candidates(text, uuid, text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.kontra_review_tenant_relationship(text, uuid, text, text, text) TO service_role;

COMMIT;
