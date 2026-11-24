'use strict';

const {
  aliasKeysForCanonical,
  canonicalizeTransactionRecordKey,
} = require('./transactionRecordCanonicalization');
const {
  isValidExtractedSemanticCandidate,
  semanticRecordKey,
} = require('./semanticFieldTaxonomy');

const BUYER_FUNDS_DUE_KEY = 'financial.buyer_funds_due';
const BUYER_FUNDS_DUE_LABEL = 'Estimated Buyer Funds Due';

function hasStoredValue(field) {
  if (String(field?.value_text ?? '').trim()) return true;
  const value = field?.value_json;
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return Boolean(value.trim());
  if (typeof value === 'object') return Object.keys(value).length > 0;
  return true;
}

function findExistingBuyerFundsField(fields = []) {
  const canonicalAliases = aliasKeysForCanonical(BUYER_FUNDS_DUE_KEY, 'generic');
  return fields.filter(field =>
    canonicalAliases.includes(canonicalizeTransactionRecordKey(field?.field_key || '', 'generic')),
  );
}

function deriveRecoverableBuyerFundsEvidence({
  conflict,
  activeDocuments = [],
  fields = [],
}) {
  if (!conflict || conflict.status !== 'resolved' || !conflict.id) return null;
  const value = String(conflict.conflicting_value ?? '').trim();
  const sourceKey = canonicalizeTransactionRecordKey(conflict.field_key || '', 'generic');
  const semanticKey = semanticRecordKey(
    conflict.field_key || '',
    conflict.display_label || '',
    value,
  );
  const targetKey = canonicalizeTransactionRecordKey(semanticKey || '', 'generic');
  if (
    targetKey !== BUYER_FUNDS_DUE_KEY
    || sourceKey === BUYER_FUNDS_DUE_KEY
    || !value
    || !isValidExtractedSemanticCandidate(
      conflict.field_key || '',
      value,
      conflict.display_label || '',
    )
  ) {
    return null;
  }

  const sourceDocumentId = conflict.conflicting_source_doc_id || null;
  const sourceDocument = activeDocuments.find(document =>
    document?.id === sourceDocumentId
      && (!document.property_id || document.property_id === conflict.property_id),
  );
  if (!sourceDocument) return null;

  const existingBuyerFundsFields = findExistingBuyerFundsField(fields);
  if (existingBuyerFundsFields.length > 1) return null;
  const existingField = existingBuyerFundsFields[0] || null;
  if (existingField) {
    if (hasStoredValue(existingField)) return null;
    if (String(existingField.status || '').toLowerCase() !== 'missing') return null;
    if (existingField.verified_at || existingField.verified_by) return null;
  }

  return {
    conflict_id: conflict.id,
    original_field_key: conflict.field_key,
    field_key: BUYER_FUNDS_DUE_KEY,
    display_label: BUYER_FUNDS_DUE_LABEL,
    value_text: value.slice(0, 2000),
    source_doc_id: sourceDocument.id,
    source_doc_version: sourceDocument.id,
    source_file_hash: sourceDocument.source_hash || null,
    source_page: conflict.conflicting_source_page ?? null,
    source_excerpt: conflict.conflicting_source_excerpt
      ? String(conflict.conflicting_source_excerpt).slice(0, 200)
      : null,
    existing_field_id: existingField?.id || null,
  };
}

function buildRecoveredBuyerFundsFieldPatch(candidate, sourceDocument, existingField = null, now = new Date().toISOString()) {
  if (!candidate || candidate.field_key !== BUYER_FUNDS_DUE_KEY || !sourceDocument?.id) {
    throw new Error('A current Buyer Funds Due evidence candidate is required');
  }
  return {
    field_key: BUYER_FUNDS_DUE_KEY,
    field_category: 'financial',
    display_label: BUYER_FUNDS_DUE_LABEL,
    value_text: candidate.value_text,
    value_json: null,
    status: 'needs_review',
    confidence: null,
    source_type: 'document',
    source_doc_id: sourceDocument.id,
    source_doc_version: sourceDocument.id,
    source_file_hash: sourceDocument.source_hash || null,
    source_page: candidate.source_page,
    source_excerpt: candidate.source_excerpt,
    extracted_by: 'evidence_recovery',
    verified_by: null,
    verified_role: null,
    verified_at: null,
    is_required: typeof existingField?.is_required === 'boolean'
      ? existingField.is_required
      : false,
    definition_key: existingField?.definition_key || BUYER_FUNDS_DUE_KEY,
    notes: [
      existingField?.notes,
      `Recovered from conflict ${candidate.conflict_id}; awaiting owner confirmation.`,
    ].filter(Boolean).join('\n').slice(0, 500),
    updated_at: now,
  };
}

module.exports = {
  BUYER_FUNDS_DUE_KEY,
  BUYER_FUNDS_DUE_LABEL,
  hasStoredValue,
  findExistingBuyerFundsField,
  deriveRecoverableBuyerFundsEvidence,
  buildRecoveredBuyerFundsFieldPatch,
};
