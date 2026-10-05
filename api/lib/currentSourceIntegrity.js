'use strict';

const VERIFIED_STATUSES = new Set(['verified', 'confirmed']);
const NON_CURRENT_CONFLICT_STATUSES = new Set(['conflict', 'conflicting', 'source_changed']);
const NON_REVIEWABLE_STATUSES = new Set(['missing', 'not_applicable']);
const VERSION_SCHEMA_ERROR = /is_active|superseded_at|superseded_by|source_hash|schema cache|column .* does not exist/i;
const {
  commitCanonicalChangeSet,
  expectedFieldSnapshot,
} = require('./canonicalPersistence');
const {
  inferSemanticDefinition,
  normalizeComparableValue,
  compareComparableValues,
} = require('./semanticFieldTaxonomy');

function sourceDocumentId(field = {}) {
  return field.source_doc_id
    || field.sourceDocId
    || field.source_doc_version
    || field.sourceDocVersion
    || null;
}

function sourceFileHash(field = {}) {
  return field.source_file_hash || field.sourceFileHash || null;
}

function conflictValueMatches(selectedValue, candidateValue, fieldKey, displayLabel = '') {
  if (selectedValue === null || selectedValue === undefined
      || candidateValue === null || candidateValue === undefined) return false;
  const semantic = inferSemanticDefinition(fieldKey, selectedValue, displayLabel);
  const comparison = compareComparableValues(
    normalizeComparableValue(selectedValue, semantic),
    normalizeComparableValue(candidateValue, semantic),
    semantic,
  );
  return (comparison.comparable && comparison.equivalent)
    || String(selectedValue).trim() === String(candidateValue).trim();
}

function hasDocumentProvenance(field = {}) {
  return Boolean(
    sourceDocumentId(field)
      || sourceFileHash(field)
      || field.source_page != null
      || field.sourcePage != null
      || field.source_excerpt
      || field.sourceExcerpt
      || ['document', 'document_extraction'].includes(String(field.source_type || field.sourceType || '').toLowerCase()),
  );
}

function currentSourceDocuments(documents = []) {
  const rows = (Array.isArray(documents) ? documents : [])
    .filter(document => document && document.section !== 'cross_document_verification');
  const hasExplicitVersionState = rows.some(document =>
    Object.prototype.hasOwnProperty.call(document, 'is_active')
      || Object.prototype.hasOwnProperty.call(document, 'superseded_at'),
  );
  const hasPersistedVersionState = rows.some(document =>
    document.is_active === true
      || document.is_active === false
      || Boolean(document.superseded_at),
  );
  if (hasExplicitVersionState && hasPersistedVersionState) {
    return rows.filter(document => document.id && document.is_active === true && !document.superseded_at);
  }

  const latestBySection = new Map();
  for (const document of rows) {
    const key = document.section || `document:${document.id}`;
    const current = latestBySection.get(key);
    if (!current || new Date(document.created_at || 0) >= new Date(current.created_at || 0)) {
      latestBySection.set(key, document);
    }
  }
  return [...latestBySection.values()].filter(document => document.id);
}

function isFieldSourceCurrent(field = {}, activeDocuments = null) {
  if (activeDocuments == null) {
    if (typeof field.current_source_is_active === 'boolean') return field.current_source_is_active;
    if (typeof field.currentSourceIsActive === 'boolean') return field.currentSourceIsActive;
    return !hasDocumentProvenance(field);
  }
  if (!hasDocumentProvenance(field)) return true;

  const id = sourceDocumentId(field);
  const hash = sourceFileHash(field);
  if (activeDocuments instanceof Set) {
    return Boolean(id && activeDocuments.has(id));
  }
  const active = currentSourceDocuments(activeDocuments);
  if (id) {
    const document = active.find(candidate => candidate.id === id);
    return Boolean(
      document
        && (!hash || !document.source_hash || hash === document.source_hash)
    );
  }
  return Boolean(hash && active.some(document => document.source_hash === hash));
}

function projectCurrentSourceField(field = {}, activeDocuments = null) {
  const current = isFieldSourceCurrent(field, activeDocuments);
  const projected = { ...field, current_source_is_active: current };
  if (!current) {
    projected.verified_by = null;
    projected.verified_role = null;
    projected.verified_at = null;
    projected.verifiedBy = null;
    projected.verifiedRole = null;
    projected.verifiedAt = null;
    if (VERIFIED_STATUSES.has(String(field.status || '').toLowerCase())) {
      projected.status = 'needs_review';
    }
  }
  return projected;
}

function isCurrentVerification(field = {}, activeDocuments = null) {
  return VERIFIED_STATUSES.has(String(field.status || '').toLowerCase())
    && isFieldSourceCurrent(field, activeDocuments);
}

function isConfirmationFromCurrentSource(field = {}, event = {}, activeDocuments = null) {
  if (!hasDocumentProvenance(field)) return true;
  if (!isFieldSourceCurrent(field, activeDocuments)) return false;
  const eventSourceId = event.source_doc_id
    || event.sourceDocId
    || event.metadata?.source_doc_id
    || event.metadata?.source_document_id
    || null;
  const eventSourceHash = event.metadata?.source_file_hash || null;
  if (!eventSourceId && !eventSourceHash) return false;
  if (eventSourceId && eventSourceId !== sourceDocumentId(field)) return false;
  if (eventSourceHash && sourceFileHash(field) && eventSourceHash !== sourceFileHash(field)) return false;
  const documents = currentSourceDocuments(activeDocuments);
  const activeSource = documents.find(document =>
    (eventSourceId && document.id === eventSourceId)
      || (!eventSourceId && eventSourceHash && document.source_hash === eventSourceHash)
  );
  if (!activeSource) return false;
  if (eventSourceHash && activeSource.source_hash && eventSourceHash !== activeSource.source_hash) return false;
  return true;
}

function invalidationForSupersededField(field, priorDocuments = [], replacementDocument = {}, now = new Date().toISOString()) {
  const priorIds = new Set((priorDocuments || []).map(document => document?.id).filter(Boolean));
  const priorHashes = new Set((priorDocuments || []).map(document => document?.source_hash).filter(Boolean));
  const fieldDocumentId = sourceDocumentId(field);
  const fieldHash = sourceFileHash(field);
  if (
    !(fieldDocumentId && priorIds.has(fieldDocumentId))
    && !(fieldHash && priorHashes.has(fieldHash))
  ) return null;

  const priorStatus = String(field.status || '').toLowerCase();
  if (NON_REVIEWABLE_STATUSES.has(priorStatus)) return null;
  const hasPriorVerification = Boolean(
    field.verified_by
      || field.verifiedBy
      || field.verified_at
      || field.verifiedAt
      || VERIFIED_STATUSES.has(priorStatus),
  );
  if (priorStatus === 'needs_review' && !hasPriorVerification) return null;
  const nextStatus = NON_CURRENT_CONFLICT_STATUSES.has(priorStatus)
    ? priorStatus
    : 'needs_review';
  const value = field.value_text ?? field.value_json ?? null;
  return {
    update: {
      status: nextStatus,
      verified_by: null,
      verified_role: null,
      verified_at: null,
      updated_at: now,
    },
    history: {
      event_type: 'source_changed',
      actor_email: 'system',
      actor_role: 'system',
      prior_value: value == null ? null : String(value),
      new_value: value == null ? null : String(value),
      prior_status: field.status || null,
      new_status: nextStatus,
      source_doc_id: fieldDocumentId,
      source_page: field.source_page ?? null,
      source_excerpt: field.source_excerpt || null,
      metadata: {
        reason: 'document_replaced',
        prior_source_doc_id: fieldDocumentId,
        prior_source_doc_version: field.source_doc_version || field.sourceDocVersion || null,
        prior_source_file_hash: fieldHash,
        prior_verified_by: field.verified_by || field.verifiedBy || null,
        prior_verified_role: field.verified_role || field.verifiedRole || null,
        prior_verified_at: field.verified_at || field.verifiedAt || null,
        replacement_document_id: replacementDocument?.id || null,
        replacement_source_hash: replacementDocument?.source_hash || null,
        replacement_created_at: replacementDocument?.created_at || null,
      },
    },
  };
}

async function invalidateSupersededFields({
  supabase,
  propertyId,
  priorDocuments = [],
  replacementDocument = {},
  correlationId = null,
  now = new Date().toISOString(),
} = {}) {
  if (!supabase || !propertyId || !priorDocuments.length) return [];
  let changed = [];
  const result = await commitCanonicalChangeSet(async () => {
    const { data: fields, error } = await supabase
      .from('transaction_record_fields')
      .select('*')
      .eq('property_id', propertyId);
    if (error) throw error;

    const expected_fields = [];
    const field_changes = [];
    const history_rows = [];
    changed = [];
    for (const field of fields || []) {
      const transition = invalidationForSupersededField(field, priorDocuments, replacementDocument, now);
      if (!transition || !field.id) continue;
      expected_fields.push(expectedFieldSnapshot(field));
      field_changes.push({
        op: 'update',
        id: field.id,
        patch: transition.update,
      });
      history_rows.push({
        ...transition.history,
        property_id: propertyId,
        field_id: field.id,
        metadata: {
          ...transition.history.metadata,
          ...(correlationId ? { correlation_id: correlationId } : {}),
        },
      });
      changed.push(field.id);
    }
    return {
      p_change_set: {
        property_id: propertyId,
        expected_fields,
        field_changes,
        history_rows,
      },
    };
  });
  if (result.status !== 'committed') {
    throw result.error || new Error(`Superseded-source invalidation did not commit (${result.status || 'unknown'})`);
  }
  return changed;
}

async function loadSourceDocuments(supabase, propertyId) {
  let { data, error } = await supabase
    .from('deal_analyses')
    .select('id, property_id, section, created_at, source_hash, is_active, superseded_at')
    .eq('property_id', propertyId)
    .order('created_at', { ascending: true });
  if (error && VERSION_SCHEMA_ERROR.test(error.message || '')) {
    ({ data, error } = await supabase
      .from('deal_analyses')
      .select('id, property_id, section, created_at, source_hash')
      .eq('property_id', propertyId)
      .order('created_at', { ascending: true }));
  }
  if (error && VERSION_SCHEMA_ERROR.test(error.message || '')) {
    ({ data, error } = await supabase
      .from('deal_analyses')
      .select('id, property_id, section, created_at')
      .eq('property_id', propertyId)
      .order('created_at', { ascending: true }));
  }
  if (error) throw error;
  return data || [];
}

async function resolveCurrentSourceDocument(supabase, propertyId, field = {}) {
  if (!hasDocumentProvenance(field)) {
    return { current: true, document: null, documents: [] };
  }
  const documents = await loadSourceDocuments(supabase, propertyId);
  const active = currentSourceDocuments(documents);
  const id = sourceDocumentId(field);
  const hash = sourceFileHash(field);
  const document = (id && documents.find(candidate => candidate.id === id))
    || (!id && hash && documents.find(candidate => candidate.source_hash === hash))
    || null;
  const current = Boolean(
    document
      && active.some(candidate => candidate.id === document.id)
      && (!hash || !document.source_hash || hash === document.source_hash)
  );
  return { current, document, documents };
}

module.exports = {
  VERIFIED_STATUSES,
  sourceDocumentId,
  sourceFileHash,
  conflictValueMatches,
  hasDocumentProvenance,
  currentSourceDocuments,
  isFieldSourceCurrent,
  projectCurrentSourceField,
  isCurrentVerification,
  isConfirmationFromCurrentSource,
  invalidationForSupersededField,
  invalidateSupersededFields,
  loadSourceDocuments,
  resolveCurrentSourceDocument,
};