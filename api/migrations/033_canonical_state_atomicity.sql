-- Atomic property-scoped persistence for document versions and Transaction
-- Record canonical state. This migration intentionally does not create the
-- active-version unique index; migration 034 is gated on completed regression
-- tests and runs its own fail-closed preflight immediately before index creation.

BEGIN;
SET LOCAL lock_timeout = '5s';

CREATE OR REPLACE FUNCTION public.kontra_activate_document_version(
  p_property_id text,
  p_section text,
  p_document jsonb,
  p_existing_document_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_now timestamptz := clock_timestamp();
  v_is_post_completion boolean := false;
  v_source_hash text;
  v_existing public.deal_analyses%ROWTYPE;
  v_new_id uuid;
  v_prior_ids uuid[] := ARRAY[]::uuid[];
  v_prior_hashes text[] := ARRAY[]::text[];
  v_prior_documents jsonb := '[]'::jsonb;
  v_field public.transaction_record_fields%ROWTYPE;
  v_prior_status text;
  v_next_status text;
  v_has_prior_verification boolean;
  v_prior_value text;
  v_prior_doc_id uuid;
  v_prior_hash text;
BEGIN
  IF p_property_id IS NULL OR btrim(p_property_id) = ''
     OR p_section IS NULL OR btrim(p_section) = ''
     OR jsonb_typeof(p_document) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'Invalid document activation request' USING ERRCODE = '22023';
  END IF;

  IF COALESCE(lower(p_document->>'uploaded_by_role'), '') IN ('system', 'verification_engine')
     OR p_section IN ('cross_document_verification', 'verification_summary', 'system') THEN
    RAISE EXCEPTION 'System documents cannot be activated as ordinary versions'
      USING ERRCODE = '22023';
  END IF;

  v_is_post_completion := COALESCE((p_document->>'post_completion')::boolean, false);
  v_source_hash := p_document->>'source_hash';

  PERFORM set_config('lock_timeout', '5s', true);
  PERFORM set_config('kontra.canonical_write', 'on', true);
  PERFORM pg_advisory_xact_lock(
    hashtextextended('kontra:canonical-state:' || p_property_id, 0)
  );

  -- A same-file refresh is allowed only while that exact source remains the
  -- active row. A changed source hash must use the replacement path below.
  IF p_existing_document_id IS NOT NULL THEN
    SELECT *
      INTO v_existing
      FROM public.deal_analyses
     WHERE id = p_existing_document_id
       AND property_id = p_property_id
       AND section = p_section
       AND is_active
       AND superseded_at IS NULL
       AND post_completion IS NOT TRUE
     FOR UPDATE;

    IF NOT FOUND OR v_existing.source_hash IS DISTINCT FROM v_source_hash THEN
      RETURN jsonb_build_object(
        'status', 'stale_source',
        'document_id', p_existing_document_id
      );
    END IF;

    UPDATE public.deal_analyses
       SET filename = CASE WHEN p_document ? 'filename' THEN p_document->>'filename' ELSE v_existing.filename END,
           analysis = CASE WHEN p_document ? 'analysis' THEN p_document->'analysis' ELSE v_existing.analysis END,
           uploaded_by_role = CASE WHEN p_document ? 'uploaded_by_role' THEN p_document->>'uploaded_by_role' ELSE v_existing.uploaded_by_role END,
           storage_path = CASE WHEN p_document ? 'storage_path' THEN p_document->>'storage_path' ELSE v_existing.storage_path END,
           document_hash = CASE WHEN p_document ? 'document_hash' THEN p_document->>'document_hash' ELSE v_existing.document_hash END,
           extracted_fields = CASE WHEN p_document ? 'extracted_fields' THEN p_document->'extracted_fields' ELSE v_existing.extracted_fields END,
           extraction_version = CASE WHEN p_document ? 'extraction_version' THEN NULLIF(p_document->>'extraction_version', '')::integer ELSE v_existing.extraction_version END,
           processing_status = CASE WHEN p_document ? 'processing_status' THEN p_document->>'processing_status' ELSE v_existing.processing_status END,
           processing_attempt = CASE WHEN p_document ? 'processing_attempt' THEN COALESCE(NULLIF(p_document->>'processing_attempt', '')::integer, 0) ELSE v_existing.processing_attempt END,
           correlation_id = CASE WHEN p_document ? 'correlation_id' THEN NULLIF(p_document->>'correlation_id', '')::uuid ELSE v_existing.correlation_id END,
           failure_reason = CASE WHEN p_document ? 'failure_reason' THEN p_document->>'failure_reason' ELSE v_existing.failure_reason END,
           processing_started_at = CASE WHEN p_document ? 'processing_started_at' THEN NULLIF(p_document->>'processing_started_at', '')::timestamptz ELSE v_existing.processing_started_at END,
           processing_completed_at = CASE WHEN p_document ? 'processing_completed_at' THEN NULLIF(p_document->>'processing_completed_at', '')::timestamptz ELSE v_existing.processing_completed_at END
     WHERE id = p_existing_document_id;

    RETURN jsonb_build_object(
      'status', 'committed',
      'document_id', p_existing_document_id,
      'replaced', false,
      'refreshed', true,
      'prior_ids', '[]'::jsonb
    );
  END IF;

  SELECT COALESCE(array_agg(document.id), ARRAY[]::uuid[]),
         COALESCE(array_remove(array_agg(document.source_hash), NULL), ARRAY[]::text[]),
         COALESCE(
           jsonb_agg(jsonb_build_object(
             'id', document.id,
             'source_hash', document.source_hash,
             'created_at', document.created_at
           )),
           '[]'::jsonb
         )
    INTO v_prior_ids, v_prior_hashes, v_prior_documents
    FROM public.deal_analyses AS document
   WHERE document.property_id = p_property_id
     AND document.section = p_section
     AND document.post_completion IS NOT TRUE
     AND document.is_active IS TRUE
     AND document.superseded_at IS NULL
     AND NOT (
       COALESCE(document.section = 'cross_document_verification', false)
       OR lower(COALESCE(document.uploaded_by_role, '')) = 'verification_engine'
       OR COALESCE(document.section IN ('verification_summary', 'system'), false)
       OR lower(COALESCE(document.uploaded_by_role, '')) = 'system'
     );

  INSERT INTO public.deal_analyses (
    property_id, section, filename, analysis, uploaded_by_role, storage_path,
    document_hash, extracted_fields, extraction_version, processing_status,
    source_hash, processing_attempt, correlation_id, failure_reason,
    processing_started_at, processing_completed_at, post_completion,
    post_completion_added_at, is_active, superseded_at, superseded_by
  ) VALUES (
    p_property_id,
    p_section,
    p_document->>'filename',
    COALESCE(p_document->'analysis', '{}'::jsonb),
    COALESCE(p_document->>'uploaded_by_role', 'unknown'),
    p_document->>'storage_path',
    p_document->>'document_hash',
    p_document->'extracted_fields',
    COALESCE(NULLIF(p_document->>'extraction_version', '')::integer, 1),
    COALESCE(p_document->>'processing_status', 'extracted'),
    v_source_hash,
    COALESCE(NULLIF(p_document->>'processing_attempt', '')::integer, 0),
    NULLIF(p_document->>'correlation_id', '')::uuid,
    p_document->>'failure_reason',
    NULLIF(p_document->>'processing_started_at', '')::timestamptz,
    NULLIF(p_document->>'processing_completed_at', '')::timestamptz,
    v_is_post_completion,
    COALESCE(
      NULLIF(p_document->>'post_completion_added_at', '')::timestamptz,
      CASE WHEN v_is_post_completion THEN v_now ELSE NULL END
    ),
    v_is_post_completion,
    NULL,
    NULL
  )
  RETURNING id INTO v_new_id;

  -- Post-completion uploads are a separate archive. They remain active for the
  -- existing archive projection but never supersede sealed canonical evidence.
  IF v_is_post_completion THEN
    RETURN jsonb_build_object(
      'status', 'committed',
      'document_id', v_new_id,
      'replaced', false,
      'post_completion', true,
      'prior_ids', '[]'::jsonb
    );
  END IF;

  IF cardinality(v_prior_ids) > 0 THEN
    UPDATE public.deal_analyses
       SET is_active = false,
           superseded_at = v_now,
           superseded_by = v_new_id
     WHERE id = ANY(v_prior_ids);

    FOR v_field IN
      SELECT field.*
        FROM public.transaction_record_fields AS field
       WHERE field.property_id = p_property_id
         AND (
           field.source_doc_id = ANY(v_prior_ids)
           OR field.source_file_hash = ANY(v_prior_hashes)
         )
       FOR UPDATE
    LOOP
      v_prior_status := lower(COALESCE(v_field.status, ''));
      v_has_prior_verification := COALESCE(v_field.verified_by IS NOT NULL, false)
        OR COALESCE(v_field.verified_at IS NOT NULL, false)
        OR v_prior_status IN ('verified', 'confirmed');

      IF v_prior_status IN ('missing', 'not_applicable')
         OR (v_prior_status = 'needs_review' AND NOT v_has_prior_verification) THEN
        CONTINUE;
      END IF;

      v_next_status := CASE
        WHEN v_prior_status IN ('conflict', 'conflicting', 'source_changed')
          THEN v_prior_status
        ELSE 'needs_review'
      END;
      v_prior_value := COALESCE(v_field.value_text, v_field.value_json::text);
      -- source_doc_version is a legacy text field and is not guaranteed to be a UUID.
      v_prior_doc_id := v_field.source_doc_id;
      v_prior_hash := v_field.source_file_hash;

      UPDATE public.transaction_record_fields
         SET status = v_next_status,
             verified_by = NULL,
             verified_role = NULL,
             verified_at = NULL,
             updated_at = v_now
       WHERE id = v_field.id;

      INSERT INTO public.transaction_record_history (
        field_id, property_id, event_type, actor_email, actor_role,
        prior_value, new_value, prior_status, new_status, source_doc_id,
        source_page, source_excerpt, metadata
      ) VALUES (
        v_field.id, p_property_id, 'source_changed', 'system', 'system',
        v_prior_value, v_prior_value, v_field.status, v_next_status,
        v_prior_doc_id, v_field.source_page, v_field.source_excerpt,
        jsonb_build_object(
          'reason', 'document_replaced',
          'prior_source_doc_id', v_prior_doc_id,
          'prior_source_doc_version', v_field.source_doc_version,
          'prior_source_file_hash', v_prior_hash,
          'prior_verified_by', v_field.verified_by,
          'prior_verified_role', v_field.verified_role,
          'prior_verified_at', v_field.verified_at,
          'replacement_document_id', v_new_id,
          'replacement_source_hash', v_source_hash,
          'replacement_created_at', v_now
        )
      );
    END LOOP;

    UPDATE public.transaction_record_conflicts
       SET status = 'resolved',
           resolved_at = v_now,
           resolution_note = 'Source document was replaced; review the replacement evidence.',
           updated_at = v_now
     WHERE property_id = p_property_id
       AND status = 'unresolved'
       AND (
         canonical_source_doc_id = ANY(v_prior_ids)
         OR conflicting_source_doc_id = ANY(v_prior_ids)
       );
  END IF;

  UPDATE public.deal_analyses
     SET is_active = true,
         superseded_at = NULL,
         superseded_by = NULL
   WHERE id = v_new_id;

  RETURN jsonb_build_object(
    'status', 'committed',
    'document_id', v_new_id,
    'replaced', cardinality(v_prior_ids) > 0,
    'prior_ids', to_jsonb(v_prior_ids)
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.kontra_commit_canonical_change_set(
  p_change_set jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_property_id text := p_change_set->>'property_id';
  v_now timestamptz := clock_timestamp();
  v_item jsonb;
  v_patch jsonb;
  v_payload jsonb;
  v_key text;
  v_op text;
  v_source uuid;
  v_source_hash text;
  v_expected_id uuid;
  v_field public.transaction_record_fields%ROWTYPE;
  v_conflict public.transaction_record_conflicts%ROWTYPE;
  v_history public.transaction_record_history%ROWTYPE;
  v_approval public.transaction_record_approvals%ROWTYPE;
  v_field_id uuid;
  v_conflict_id uuid;
  v_absent boolean;
  v_result_field_ids jsonb := '[]'::jsonb;
  v_restricted_column text;
  v_deleted_conflicts integer := 0;
  v_deleted_fields integer := 0;
  v_deleted_documents integer := 0;
BEGIN
  IF jsonb_typeof(p_change_set) IS DISTINCT FROM 'object'
     OR v_property_id IS NULL OR btrim(v_property_id) = '' THEN
    RAISE EXCEPTION 'Invalid canonical change set' USING ERRCODE = '22023';
  END IF;

  PERFORM set_config('lock_timeout', '5s', true);
  PERFORM set_config('kontra.canonical_write', 'on', true);
  PERFORM pg_advisory_xact_lock(
    hashtextextended('kontra:canonical-state:' || v_property_id, 0)
  );

  -- Room retention is a distinct, owner-authorized operation after storage
  -- cleanup. Keep guarded rows deletable without exposing direct table writes.
  IF p_change_set ? 'operation' THEN
    IF p_change_set->>'operation' <> 'room_retention_delete'
       OR jsonb_array_length(COALESCE(p_change_set->'required_sources', '[]'::jsonb)) <> 0
       OR jsonb_array_length(COALESCE(p_change_set->'expected_fields', '[]'::jsonb)) <> 0
       OR jsonb_array_length(COALESCE(p_change_set->'expected_conflicts', '[]'::jsonb)) <> 0
       OR jsonb_array_length(COALESCE(p_change_set->'field_changes', '[]'::jsonb)) <> 0
       OR jsonb_array_length(COALESCE(p_change_set->'conflict_changes', '[]'::jsonb)) <> 0
       OR jsonb_array_length(COALESCE(p_change_set->'history_rows', '[]'::jsonb)) <> 0
       OR jsonb_array_length(COALESCE(p_change_set->'approval_rows', '[]'::jsonb)) <> 0
       OR jsonb_array_length(COALESCE(p_change_set->'history_reassignments', '[]'::jsonb)) <> 0 THEN
      RAISE EXCEPTION 'Invalid room-retention canonical change set' USING ERRCODE = '22023';
    END IF;

    PERFORM set_config('kontra.room_retention', 'on', true);
    DELETE FROM public.transaction_record_conflicts WHERE property_id = v_property_id;
    GET DIAGNOSTICS v_deleted_conflicts = ROW_COUNT;
    DELETE FROM public.transaction_record_fields WHERE property_id = v_property_id;
    GET DIAGNOSTICS v_deleted_fields = ROW_COUNT;
    DELETE FROM public.deal_analyses WHERE property_id = v_property_id;
    GET DIAGNOSTICS v_deleted_documents = ROW_COUNT;

    RETURN jsonb_build_object(
      'status', 'committed',
      'operation', 'room_retention_delete',
      'deleted', jsonb_build_object(
        'transaction_record_conflicts', v_deleted_conflicts,
        'transaction_record_fields', v_deleted_fields,
        'deal_analyses', v_deleted_documents
      )
    );
  END IF;

  -- Recheck every document dependency after the property lock is held. The
  -- source hash is included when available so a reused ID cannot mask a change.
  FOR v_item IN
    SELECT value
      FROM jsonb_array_elements(COALESCE(p_change_set->'required_sources', '[]'::jsonb)) AS source(value)
  LOOP
    IF NULLIF(v_item->>'id', '') IS NULL THEN
      CONTINUE;
    END IF;
    v_source := (v_item->>'id')::uuid;
    v_source_hash := v_item->>'source_hash';
    PERFORM 1
      FROM public.deal_analyses AS document
     WHERE document.id = v_source
       AND document.property_id = v_property_id
       AND document.is_active
       AND document.superseded_at IS NULL
       AND document.post_completion IS NOT TRUE
       AND (v_source_hash IS NULL OR document.source_hash IS NOT DISTINCT FROM v_source_hash)
     FOR UPDATE;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('status', 'stale_source', 'source_id', v_source);
    END IF;
  END LOOP;

  -- Optimistic snapshots prevent a plan made from an older field/conflict row
  -- from overwriting a concurrent coordinator action.
  FOR v_item IN
    SELECT value
      FROM jsonb_array_elements(COALESCE(p_change_set->'expected_fields', '[]'::jsonb)) AS expected(value)
  LOOP
    v_absent := COALESCE((v_item->>'absent')::boolean, false);
    IF v_absent THEN
      PERFORM 1
        FROM public.transaction_record_fields AS field
       WHERE field.property_id = v_property_id
         AND field.field_key = v_item->>'field_key'
       FOR UPDATE;
      IF FOUND THEN
        RETURN jsonb_build_object('status', 'retry_snapshot', 'field_key', v_item->>'field_key');
      END IF;
      CONTINUE;
    END IF;

    v_expected_id := NULLIF(v_item->>'id', '')::uuid;
    SELECT * INTO v_field
      FROM public.transaction_record_fields AS field
     WHERE field.id = v_expected_id
       AND field.property_id = v_property_id
     FOR UPDATE;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('status', 'retry_snapshot', 'field_id', v_expected_id);
    END IF;

    FOR v_key IN SELECT jsonb_object_keys(v_item) LOOP
      IF v_key IN ('id', 'absent') THEN CONTINUE; END IF;
      IF v_key = 'updated_at' THEN
        IF v_field.updated_at IS DISTINCT FROM NULLIF(v_item->>'updated_at', '')::timestamptz THEN
          RETURN jsonb_build_object('status', 'retry_snapshot', 'field_id', v_expected_id);
        END IF;
      ELSIF to_jsonb(v_field)->v_key IS DISTINCT FROM v_item->v_key THEN
        RETURN jsonb_build_object('status', 'retry_snapshot', 'field_id', v_expected_id);
      END IF;
    END LOOP;
  END LOOP;

  FOR v_item IN
    SELECT value
      FROM jsonb_array_elements(COALESCE(p_change_set->'expected_conflicts', '[]'::jsonb)) AS expected(value)
  LOOP
    v_absent := COALESCE((v_item->>'absent')::boolean, false);
    IF v_absent THEN
      PERFORM 1
        FROM public.transaction_record_conflicts AS conflict
       WHERE conflict.property_id = v_property_id
         AND conflict.field_key = v_item->>'field_key'
         AND conflict.status = 'unresolved'
       FOR UPDATE;
      IF FOUND THEN
        RETURN jsonb_build_object('status', 'retry_snapshot', 'conflict_key', v_item->>'field_key');
      END IF;
      CONTINUE;
    END IF;

    v_expected_id := NULLIF(v_item->>'id', '')::uuid;
    SELECT * INTO v_conflict
      FROM public.transaction_record_conflicts AS conflict
     WHERE conflict.id = v_expected_id
       AND conflict.property_id = v_property_id
     FOR UPDATE;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('status', 'retry_snapshot', 'conflict_id', v_expected_id);
    END IF;

    FOR v_key IN SELECT jsonb_object_keys(v_item) LOOP
      IF v_key IN ('id', 'absent') THEN CONTINUE; END IF;
      IF v_key = 'updated_at' THEN
        IF v_conflict.updated_at IS DISTINCT FROM NULLIF(v_item->>'updated_at', '')::timestamptz THEN
          RETURN jsonb_build_object('status', 'retry_snapshot', 'conflict_id', v_expected_id);
        END IF;
      ELSIF to_jsonb(v_conflict)->v_key IS DISTINCT FROM v_item->v_key THEN
        RETURN jsonb_build_object('status', 'retry_snapshot', 'conflict_id', v_expected_id);
      END IF;
    END LOOP;
  END LOOP;

  -- Reassign legacy history before duplicate-field rows are removed. Both
  -- field rows must be represented by optimistic snapshots in the same set.
  FOR v_item IN
    SELECT value
      FROM jsonb_array_elements(COALESCE(p_change_set->'history_reassignments', '[]'::jsonb)) AS reassignment(value)
  LOOP
    IF NOT EXISTS (
      SELECT 1
        FROM jsonb_array_elements(COALESCE(p_change_set->'expected_fields', '[]'::jsonb)) AS expected(value)
       WHERE expected.value->>'id' = v_item->>'from_field_id'
    ) OR NOT EXISTS (
      SELECT 1
        FROM jsonb_array_elements(COALESCE(p_change_set->'expected_fields', '[]'::jsonb)) AS expected(value)
       WHERE expected.value->>'id' = v_item->>'to_field_id'
    ) THEN
      RAISE EXCEPTION 'History reassignment requires expected field snapshots' USING ERRCODE = '22023';
    END IF;
    UPDATE public.transaction_record_history
       SET field_id = (v_item->>'to_field_id')::uuid
     WHERE property_id = v_property_id
       AND field_id = (v_item->>'from_field_id')::uuid;
  END LOOP;

  -- Every field mutation must be tied to an expected row or expected absence.
  FOR v_item IN
    SELECT value
      FROM jsonb_array_elements(COALESCE(p_change_set->'field_changes', '[]'::jsonb)) AS change(value)
  LOOP
    v_op := COALESCE(v_item->>'op', 'update');
    v_patch := COALESCE(v_item->'patch', '{}'::jsonb);
    IF v_op NOT IN ('update', 'insert', 'delete') THEN
      RAISE EXCEPTION 'Unsupported field mutation operation: %', v_op USING ERRCODE = '22023';
    END IF;
    IF v_op = 'delete' THEN
      v_field_id := NULLIF(v_item->>'id', '')::uuid;
      IF NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(COALESCE(p_change_set->'expected_fields', '[]'::jsonb)) AS expected(value)
         WHERE expected.value->>'id' = v_field_id::text
      ) THEN
        RAISE EXCEPTION 'Field deletion requires an expected snapshot' USING ERRCODE = '22023';
      END IF;
      DELETE FROM public.transaction_record_fields
       WHERE id = v_field_id AND property_id = v_property_id;
      CONTINUE;
    END IF;

    SELECT key INTO v_restricted_column
      FROM jsonb_object_keys(v_patch) AS patch_key(key)
     WHERE key IN ('id', 'property_id', 'created_at')
     LIMIT 1;
    IF v_restricted_column IS NOT NULL THEN
      RAISE EXCEPTION 'Field patch cannot change protected column %', v_restricted_column USING ERRCODE = '22023';
    END IF;
    SELECT key INTO v_restricted_column
      FROM jsonb_object_keys(v_patch) AS patch_key(key)
     WHERE key NOT IN (
       'field_key', 'field_category', 'display_label', 'value_text', 'value_json',
       'status', 'confidence', 'source_doc_id', 'source_doc_version',
       'source_file_hash', 'source_page', 'source_excerpt', 'extracted_by',
       'verified_by', 'verified_role', 'verified_at', 'notes', 'updated_at',
       'extraction_timestamp', 'definition_key', 'is_required', 'source_type',
       'conflict_candidates'
     )
     LIMIT 1;
    IF v_restricted_column IS NOT NULL THEN
      RAISE EXCEPTION 'Unsupported Transaction Record field column %', v_restricted_column USING ERRCODE = '22023';
    END IF;

    v_field_id := NULLIF(v_item->>'id', '')::uuid;
    IF v_field_id IS NOT NULL THEN
      IF NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(COALESCE(p_change_set->'expected_fields', '[]'::jsonb)) AS expected(value)
         WHERE expected.value->>'id' = v_field_id::text
      ) THEN
        RAISE EXCEPTION 'Field update requires an expected snapshot' USING ERRCODE = '22023';
      END IF;
      SELECT * INTO v_field
        FROM public.transaction_record_fields
       WHERE id = v_field_id AND property_id = v_property_id
       FOR UPDATE;
      IF NOT FOUND THEN
        RETURN jsonb_build_object('status', 'retry_snapshot', 'field_id', v_field_id);
      END IF;
    ELSE
      v_field := NULL;
    END IF;

    IF v_field.id IS NULL THEN
      IF v_op = 'update' THEN
        RETURN jsonb_build_object('status', 'retry_snapshot', 'field_id', v_field_id);
      END IF;
      IF NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(COALESCE(p_change_set->'expected_fields', '[]'::jsonb)) AS expected(value)
         WHERE COALESCE((expected.value->>'absent')::boolean, false)
           AND expected.value->>'field_key' = COALESCE(v_patch->>'field_key', v_item->>'field_key')
      ) THEN
        RAISE EXCEPTION 'Field insertion requires an expected-absence snapshot' USING ERRCODE = '22023';
      END IF;

      v_field := jsonb_populate_record(NULL::public.transaction_record_fields, v_patch);
      v_field.id := COALESCE(v_field.id, gen_random_uuid());
      v_field.property_id := v_property_id;
      v_field.field_key := COALESCE(v_field.field_key, v_item->>'field_key');
      v_field.field_category := COALESCE(v_field.field_category, 'transaction');
      v_field.display_label := COALESCE(v_field.display_label, v_field.field_key);
      v_field.status := COALESCE(v_field.status, 'missing');
      v_field.is_required := COALESCE(v_field.is_required, false);
      v_field.conflict_candidates := COALESCE(v_field.conflict_candidates, '[]'::jsonb);
      v_field.created_at := COALESCE(v_field.created_at, v_now);
      v_field.updated_at := COALESCE(v_field.updated_at, v_now);
      INSERT INTO public.transaction_record_fields SELECT (v_field).*;
    ELSE
      v_field := jsonb_populate_record(v_field, v_patch);
      v_field.updated_at := COALESCE(v_field.updated_at, v_now);
      UPDATE public.transaction_record_fields
         SET field_key = v_field.field_key,
             field_category = v_field.field_category,
             display_label = v_field.display_label,
             value_text = v_field.value_text,
             value_json = v_field.value_json,
             status = v_field.status,
             confidence = v_field.confidence,
             source_doc_id = v_field.source_doc_id,
             source_doc_version = v_field.source_doc_version,
             source_file_hash = v_field.source_file_hash,
             source_page = v_field.source_page,
             source_excerpt = v_field.source_excerpt,
             extracted_by = v_field.extracted_by,
             verified_by = v_field.verified_by,
             verified_role = v_field.verified_role,
             verified_at = v_field.verified_at,
             notes = v_field.notes,
             updated_at = v_field.updated_at,
             extraction_timestamp = v_field.extraction_timestamp,
             definition_key = v_field.definition_key,
             is_required = v_field.is_required,
             source_type = v_field.source_type,
             conflict_candidates = v_field.conflict_candidates
       WHERE id = v_field.id AND property_id = v_property_id;
    END IF;
    v_result_field_ids := v_result_field_ids || jsonb_build_array(v_field.id);
  END LOOP;

  FOR v_item IN
    SELECT value
      FROM jsonb_array_elements(COALESCE(p_change_set->'conflict_changes', '[]'::jsonb)) AS change(value)
  LOOP
    v_op := COALESCE(v_item->>'op', 'upsert');
    v_payload := COALESCE(v_item->'payload', '{}'::jsonb);
    IF v_op = 'resolve' THEN
      v_conflict_id := NULLIF(v_item->>'id', '')::uuid;
      IF v_conflict_id IS NULL OR NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(COALESCE(p_change_set->'expected_conflicts', '[]'::jsonb)) AS expected(value)
         WHERE expected.value->>'id' = v_conflict_id::text
      ) THEN
        RAISE EXCEPTION 'Conflict resolution requires an expected snapshot' USING ERRCODE = '22023';
      END IF;
      UPDATE public.transaction_record_conflicts
         SET status = 'resolved',
             resolution_value = CASE WHEN v_item ? 'resolution_value' THEN v_item->>'resolution_value' ELSE resolution_value END,
             resolution_note = CASE WHEN v_item ? 'resolution_note' THEN v_item->>'resolution_note' ELSE resolution_note END,
             resolved_by = CASE WHEN v_item ? 'resolved_by' THEN v_item->>'resolved_by' ELSE resolved_by END,
             resolved_at = v_now,
             updated_at = v_now
       WHERE property_id = v_property_id
         AND status = 'unresolved'
         AND (
           (v_conflict_id IS NOT NULL AND id = v_conflict_id)
           OR (v_conflict_id IS NULL AND field_key = v_item->>'field_key')
         );
      CONTINUE;
    ELSIF v_op <> 'upsert' THEN
      RAISE EXCEPTION 'Unsupported conflict mutation operation: %', v_op USING ERRCODE = '22023';
    END IF;

    v_conflict_id := NULLIF(v_payload->>'id', '')::uuid;
    IF v_conflict_id IS NOT NULL THEN
      IF NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(COALESCE(p_change_set->'expected_conflicts', '[]'::jsonb)) AS expected(value)
         WHERE expected.value->>'id' = v_conflict_id::text
      ) THEN
        RAISE EXCEPTION 'Conflict upsert requires an expected snapshot' USING ERRCODE = '22023';
      END IF;
      SELECT * INTO v_conflict
        FROM public.transaction_record_conflicts
       WHERE id = v_conflict_id AND property_id = v_property_id
       FOR UPDATE;
    ELSE
      IF NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(COALESCE(p_change_set->'expected_conflicts', '[]'::jsonb)) AS expected(value)
         WHERE COALESCE((expected.value->>'absent')::boolean, false)
           AND expected.value->>'field_key' = v_payload->>'field_key'
      ) THEN
        RAISE EXCEPTION 'Conflict insertion requires an expected-absence snapshot' USING ERRCODE = '22023';
      END IF;
      SELECT * INTO v_conflict
        FROM public.transaction_record_conflicts
       WHERE property_id = v_property_id
         AND field_key = v_payload->>'field_key'
         AND status = 'unresolved'
       ORDER BY updated_at DESC
       LIMIT 1
       FOR UPDATE;
    END IF;

    IF v_conflict.id IS NULL THEN
      v_conflict := jsonb_populate_record(NULL::public.transaction_record_conflicts, v_payload);
      v_conflict.id := COALESCE(v_conflict.id, gen_random_uuid());
      v_conflict.property_id := v_property_id;
      v_conflict.field_id := COALESCE(
        v_conflict.field_id,
        (SELECT field.id FROM public.transaction_record_fields AS field
          WHERE field.property_id = v_property_id AND field.field_key = v_conflict.field_key
          ORDER BY field.updated_at DESC LIMIT 1)
      );
      v_conflict.status := COALESCE(v_conflict.status, 'unresolved');
      v_conflict.created_at := COALESCE(v_conflict.created_at, v_now);
      v_conflict.updated_at := COALESCE(v_conflict.updated_at, v_now);
      INSERT INTO public.transaction_record_conflicts SELECT (v_conflict).*;
    ELSE
      v_conflict := jsonb_populate_record(v_conflict, v_payload);
      v_conflict.property_id := v_property_id;
      v_conflict.updated_at := v_now;
      UPDATE public.transaction_record_conflicts
         SET field_id = v_conflict.field_id,
             field_key = v_conflict.field_key,
             display_label = v_conflict.display_label,
             canonical_value = v_conflict.canonical_value,
             conflicting_value = v_conflict.conflicting_value,
             canonical_source_doc_id = v_conflict.canonical_source_doc_id,
             conflicting_source_doc_id = v_conflict.conflicting_source_doc_id,
             canonical_source_page = v_conflict.canonical_source_page,
             conflicting_source_page = v_conflict.conflicting_source_page,
             canonical_source_excerpt = v_conflict.canonical_source_excerpt,
             conflicting_source_excerpt = v_conflict.conflicting_source_excerpt,
             status = v_conflict.status,
             resolution_value = v_conflict.resolution_value,
             resolution_note = v_conflict.resolution_note,
             resolved_by = v_conflict.resolved_by,
             resolved_at = v_conflict.resolved_at,
             updated_at = v_conflict.updated_at
       WHERE id = v_conflict.id AND property_id = v_property_id;
    END IF;
  END LOOP;

  FOR v_item IN
    SELECT value
      FROM jsonb_array_elements(COALESCE(p_change_set->'history_rows', '[]'::jsonb)) AS history_row(value)
  LOOP
    v_history := jsonb_populate_record(NULL::public.transaction_record_history, v_item);
    v_history.id := COALESCE(v_history.id, gen_random_uuid());
    v_history.property_id := v_property_id;
    IF v_history.field_id IS NULL AND NULLIF(v_item->>'field_key', '') IS NOT NULL THEN
      SELECT field.id INTO v_history.field_id
        FROM public.transaction_record_fields AS field
       WHERE field.property_id = v_property_id
         AND field.field_key = v_item->>'field_key'
       ORDER BY field.updated_at DESC
       LIMIT 1;
    END IF;
    IF v_history.field_id IS NULL THEN
      RAISE EXCEPTION 'History row requires an existing field' USING ERRCODE = '22023';
    END IF;
    v_history.created_at := COALESCE(v_history.created_at, v_now);
    INSERT INTO public.transaction_record_history SELECT (v_history).*;
  END LOOP;

  FOR v_item IN
    SELECT value
      FROM jsonb_array_elements(COALESCE(p_change_set->'approval_rows', '[]'::jsonb)) AS approval_row(value)
  LOOP
    v_approval := jsonb_populate_record(NULL::public.transaction_record_approvals, v_item);
    v_approval.id := COALESCE(v_approval.id, gen_random_uuid());
    v_approval.property_id := v_property_id;
    IF v_approval.field_id IS NULL AND NULLIF(v_item->>'field_key', '') IS NOT NULL THEN
      SELECT field.id INTO v_approval.field_id
        FROM public.transaction_record_fields AS field
       WHERE field.property_id = v_property_id
         AND field.field_key = v_item->>'field_key'
       ORDER BY field.updated_at DESC
       LIMIT 1;
    END IF;
    IF v_approval.field_id IS NULL THEN
      RAISE EXCEPTION 'Approval row requires an existing field' USING ERRCODE = '22023';
    END IF;
    v_approval.created_at := COALESCE(v_approval.created_at, v_now);
    v_approval.is_manual := COALESCE(v_approval.is_manual, false);
    INSERT INTO public.transaction_record_approvals SELECT (v_approval).*;
  END LOOP;

  RETURN jsonb_build_object(
    'status', 'committed',
    'field_ids', v_result_field_ids
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.kontra_guard_canonical_write()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_property_id text;
  v_rpc_owner name;
  v_is_system_document boolean := false;
  v_version_state_changed boolean := false;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_property_id := OLD.property_id;
  ELSE
    v_property_id := NEW.property_id;
  END IF;

  IF v_property_id IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(
      hashtextextended('kontra:canonical-state:' || v_property_id, 0)
    );
  END IF;

  IF TG_TABLE_NAME = 'deal_analyses' THEN
    IF TG_OP = 'DELETE' THEN
      v_is_system_document := (
        COALESCE(OLD.section = 'cross_document_verification', false)
        OR lower(COALESCE(OLD.uploaded_by_role, '')) = 'verification_engine'
        OR COALESCE(OLD.section IN ('verification_summary', 'system'), false)
        OR lower(COALESCE(OLD.uploaded_by_role, '')) = 'system'
      );
      IF NOT v_is_system_document THEN
        IF current_setting('kontra.room_retention', true) IS DISTINCT FROM 'on' THEN
          RAISE EXCEPTION 'Ordinary document deletion is not allowed outside a retention procedure'
            USING ERRCODE = '42501';
        END IF;
        SELECT pg_get_userbyid(proowner)
          INTO v_rpc_owner
          FROM pg_proc
         WHERE oid = 'public.kontra_commit_canonical_change_set(jsonb)'::regprocedure;
        IF v_rpc_owner IS NULL OR current_user <> v_rpc_owner THEN
          RAISE EXCEPTION 'Room retention execution context is required'
            USING ERRCODE = '42501';
        END IF;
      END IF;
      RETURN OLD;
    END IF;
    IF TG_OP = 'INSERT' THEN
      v_is_system_document := (
        COALESCE(NEW.section = 'cross_document_verification', false)
        OR lower(COALESCE(NEW.uploaded_by_role, '')) = 'verification_engine'
        OR COALESCE(NEW.section IN ('verification_summary', 'system'), false)
        OR lower(COALESCE(NEW.uploaded_by_role, '')) = 'system'
      );
      IF NOT v_is_system_document THEN
        IF current_setting('kontra.canonical_write', true) IS DISTINCT FROM 'on' THEN
          RAISE EXCEPTION 'Ordinary document activation requires the canonical RPC'
            USING ERRCODE = '42501';
        END IF;
        SELECT pg_get_userbyid(proowner)
          INTO v_rpc_owner
          FROM pg_proc
         WHERE oid = 'public.kontra_activate_document_version(text, text, jsonb, uuid)'::regprocedure;
        IF v_rpc_owner IS NULL OR current_user <> v_rpc_owner THEN
          RAISE EXCEPTION 'Document activation RPC execution context is required'
            USING ERRCODE = '42501';
        END IF;
      END IF;
    ELSE
      v_is_system_document := (
        COALESCE(OLD.section = 'cross_document_verification', false)
        OR lower(COALESCE(OLD.uploaded_by_role, '')) = 'verification_engine'
        OR COALESCE(OLD.section IN ('verification_summary', 'system'), false)
        OR lower(COALESCE(OLD.uploaded_by_role, '')) = 'system'
      ) AND (
        COALESCE(NEW.section = 'cross_document_verification', false)
        OR lower(COALESCE(NEW.uploaded_by_role, '')) = 'verification_engine'
        OR COALESCE(NEW.section IN ('verification_summary', 'system'), false)
        OR lower(COALESCE(NEW.uploaded_by_role, '')) = 'system'
      );
      v_version_state_changed :=
        OLD.property_id IS DISTINCT FROM NEW.property_id
        OR OLD.section IS DISTINCT FROM NEW.section
        OR OLD.source_hash IS DISTINCT FROM NEW.source_hash
        OR OLD.post_completion IS DISTINCT FROM NEW.post_completion
        OR OLD.is_active IS DISTINCT FROM NEW.is_active
        OR OLD.superseded_at IS DISTINCT FROM NEW.superseded_at
        OR OLD.superseded_by IS DISTINCT FROM NEW.superseded_by
        OR OLD.uploaded_by_role IS DISTINCT FROM NEW.uploaded_by_role;
      IF v_version_state_changed AND NOT v_is_system_document THEN
        IF current_setting('kontra.canonical_write', true) IS DISTINCT FROM 'on' THEN
          RAISE EXCEPTION 'Document version changes require the canonical RPC'
            USING ERRCODE = '42501';
        END IF;
        SELECT pg_get_userbyid(proowner)
          INTO v_rpc_owner
          FROM pg_proc
         WHERE oid = 'public.kontra_activate_document_version(text, text, jsonb, uuid)'::regprocedure;
        IF v_rpc_owner IS NULL OR current_user <> v_rpc_owner THEN
          RAISE EXCEPTION 'Document activation RPC execution context is required'
            USING ERRCODE = '42501';
        END IF;
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  IF current_setting('kontra.canonical_write', true) IS DISTINCT FROM 'on' THEN
    RAISE EXCEPTION 'Canonical Transaction Record writes require the canonical RPC'
      USING ERRCODE = '42501';
  END IF;

  SELECT pg_get_userbyid(proowner)
    INTO v_rpc_owner
    FROM pg_proc
   WHERE oid = 'public.kontra_commit_canonical_change_set(jsonb)'::regprocedure;
  IF v_rpc_owner IS NOT NULL AND current_user <> v_rpc_owner THEN
    RAISE EXCEPTION 'Canonical RPC execution context is required'
      USING ERRCODE = '42501';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$function$;

CREATE TRIGGER trg_deal_analyses_canonical_write
  BEFORE INSERT OR UPDATE OR DELETE ON public.deal_analyses
  FOR EACH ROW EXECUTE FUNCTION public.kontra_guard_canonical_write();

CREATE TRIGGER trg_transaction_record_fields_canonical_write
  BEFORE INSERT OR UPDATE OR DELETE ON public.transaction_record_fields
  FOR EACH ROW EXECUTE FUNCTION public.kontra_guard_canonical_write();

CREATE TRIGGER trg_transaction_record_history_canonical_write
  BEFORE INSERT OR UPDATE OR DELETE ON public.transaction_record_history
  FOR EACH ROW EXECUTE FUNCTION public.kontra_guard_canonical_write();

CREATE TRIGGER trg_transaction_record_conflicts_canonical_write
  BEFORE INSERT OR UPDATE OR DELETE ON public.transaction_record_conflicts
  FOR EACH ROW EXECUTE FUNCTION public.kontra_guard_canonical_write();

CREATE TRIGGER trg_transaction_record_approvals_canonical_write
  BEFORE INSERT OR UPDATE OR DELETE ON public.transaction_record_approvals
  FOR EACH ROW EXECUTE FUNCTION public.kontra_guard_canonical_write();

REVOKE EXECUTE ON FUNCTION public.kontra_activate_document_version(text, text, jsonb, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.kontra_commit_canonical_change_set(jsonb) FROM PUBLIC;
DO $grants$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.kontra_activate_document_version(text, text, jsonb, uuid) FROM anon';
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.kontra_commit_canonical_change_set(jsonb) FROM anon';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.kontra_activate_document_version(text, text, jsonb, uuid) FROM authenticated';
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.kontra_commit_canonical_change_set(jsonb) FROM authenticated';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.kontra_activate_document_version(text, text, jsonb, uuid) TO service_role';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.kontra_commit_canonical_change_set(jsonb) TO service_role';
  END IF;
END;
$grants$;

COMMIT;