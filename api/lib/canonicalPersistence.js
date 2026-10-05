'use strict';

const { supabase } = require('../db');

const MAX_CANONICAL_ATTEMPTS = 3;

function delay(milliseconds) {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

function isTransientDatabaseError(error) {
  return ['40001', '40P01', '55P03', '57014'].includes(String(error?.code || ''));
}

function expectedFieldSnapshot(field, fieldKey = null) {
  if (!field?.id) {
    return { absent: true, field_key: fieldKey || field?.field_key || null };
  }
  return {
    id: field.id,
    field_key: field.field_key,
    field_category: field.field_category ?? null,
    display_label: field.display_label ?? null,
    updated_at: field.updated_at || null,
    status: field.status ?? null,
    value_text: field.value_text ?? null,
    value_json: field.value_json ?? null,
    confidence: field.confidence ?? null,
    source_doc_id: field.source_doc_id ?? null,
    source_doc_version: field.source_doc_version ?? null,
    source_file_hash: field.source_file_hash ?? null,
    source_page: field.source_page ?? null,
    source_excerpt: field.source_excerpt ?? null,
    extracted_by: field.extracted_by ?? null,
    verified_by: field.verified_by ?? null,
    verified_role: field.verified_role ?? null,
    verified_at: field.verified_at ?? null,
    notes: field.notes ?? null,
    extraction_timestamp: field.extraction_timestamp ?? null,
    definition_key: field.definition_key ?? null,
    is_required: field.is_required ?? null,
    source_type: field.source_type ?? null,
    conflict_candidates: field.conflict_candidates ?? [],
  };
}

function expectedConflictSnapshot(conflict, fieldKey = null) {
  if (!conflict?.id) {
    return { absent: true, field_key: fieldKey || conflict?.field_key || null };
  }
  return {
    id: conflict.id,
    field_key: conflict.field_key,
    field_id: conflict.field_id ?? null,
    display_label: conflict.display_label ?? null,
    status: conflict.status,
    updated_at: conflict.updated_at || null,
    canonical_value: conflict.canonical_value ?? null,
    conflicting_value: conflict.conflicting_value ?? null,
    canonical_source_doc_id: conflict.canonical_source_doc_id ?? null,
    conflicting_source_doc_id: conflict.conflicting_source_doc_id ?? null,
    canonical_source_page: conflict.canonical_source_page ?? null,
    conflicting_source_page: conflict.conflicting_source_page ?? null,
    canonical_source_excerpt: conflict.canonical_source_excerpt ?? null,
    conflicting_source_excerpt: conflict.conflicting_source_excerpt ?? null,
    resolution_value: conflict.resolution_value ?? null,
    resolution_note: conflict.resolution_note ?? null,
    resolved_by: conflict.resolved_by ?? null,
    resolved_at: conflict.resolved_at ?? null,
  };
}

function requiredSource(document) {
  if (!document?.id) return null;
  return {
    id: document.id,
    source_hash: document.source_hash ?? document.source_file_hash ?? null,
  };
}

async function invokeCanonicalRpc(functionName, buildArgs, { retrySnapshots = false } = {}) {
  const build = typeof buildArgs === 'function' ? buildArgs : async () => buildArgs;
  for (let attempt = 0; attempt < MAX_CANONICAL_ATTEMPTS; attempt += 1) {
    const args = await build(attempt);
    let result;
    try {
      result = await supabase.rpc(functionName, args);
    } catch (error) {
      if (isTransientDatabaseError(error) && attempt + 1 < MAX_CANONICAL_ATTEMPTS) {
        await delay(40 * (2 ** attempt));
        continue;
      }
      return { status: 'error', error };
    }

    if (result?.error) {
      if (isTransientDatabaseError(result.error) && attempt + 1 < MAX_CANONICAL_ATTEMPTS) {
        await delay(40 * (2 ** attempt));
        continue;
      }
      return { status: 'error', error: result.error };
    }
    if (!result || result.data == null || typeof result.data !== 'object') {
      return {
        status: 'error',
        error: new Error(`Canonical persistence RPC ${functionName} returned no result`),
      };
    }

    if (
      retrySnapshots
      && result.data.status === 'retry_snapshot'
      && typeof buildArgs === 'function'
      && attempt + 1 < MAX_CANONICAL_ATTEMPTS
    ) {
      await delay(20 * (attempt + 1));
      continue;
    }
    return result.data;
  }
  return { status: 'error', error: new Error(`Canonical persistence RPC ${functionName} exhausted retries`) };
}

function commitCanonicalChangeSet(buildArgs, options = {}) {
  return invokeCanonicalRpc(
    'kontra_commit_canonical_change_set',
    buildArgs,
    { retrySnapshots: options.retrySnapshots !== false },
  );
}

function canonicalExtractionOutcome(result) {
  if (result?.status === 'committed') return 'committed';
  if (result?.status === 'stale_source' || result?.skipped === 'superseded') {
    return 'stale_source';
  }
  return 'failed';
}

async function afterCanonicalCommit(result, callback) {
  const outcome = canonicalExtractionOutcome(result);
  if (outcome === 'committed' && typeof callback === 'function') {
    await callback(result);
  }
  return outcome;
}

function activateDocumentVersion({
  propertyId,
  section,
  document,
  existingDocumentId = null,
}) {
  return invokeCanonicalRpc('kontra_activate_document_version', {
    p_property_id: propertyId,
    p_section: section,
    p_document: document,
    p_existing_document_id: existingDocumentId,
  });
}

module.exports = {
  activateDocumentVersion,
  afterCanonicalCommit,
  canonicalExtractionOutcome,
  commitCanonicalChangeSet,
  expectedConflictSnapshot,
  expectedFieldSnapshot,
  requiredSource,
};