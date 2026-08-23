'use strict';

const crypto = require('crypto');

const HANDOFF_SCHEMA = 'kontra.verified-asset-handoff';
const HANDOFF_VERSION = '1.0.0';
const CONFIRMED = new Set(['confirmed', 'verified']);
const OPEN = new Set(['awaiting', 'missing', 'conflict', 'conflicting', 'source_changed']);
const NON_APPLICABLE = 'not_applicable';

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  return Object.keys(value).sort().reduce((out, key) => {
    out[key] = stable(value[key]);
    return out;
  }, {});
}

function handoffKey(payload) {
  return crypto.createHash('sha256')
    .update(JSON.stringify(stable(payload)))
    .digest('hex');
}

function fieldState(field) {
  const status = field?.status || 'missing';
  if (CONFIRMED.has(status)) return 'confirmed';
  if (status === 'missing') return 'missing';
  if (status === NON_APPLICABLE) return NON_APPLICABLE;
  if (OPEN.has(status)) return status === 'source_changed' ? 'source_changed' : 'awaiting_confirmation';
  return status;
}

function provenance(field) {
  return {
    source_document_id: field?.sourceDocId || field?.source_doc_id || null,
    source_document_version: field?.sourceDocVersion || field?.source_doc_version || null,
    source_file_hash: field?.sourceFileHash || field?.source_file_hash || null,
    source_page: field?.sourcePage ?? field?.source_page ?? null,
    source_excerpt: field?.sourceExcerpt || field?.source_excerpt || null,
    extracted_at: field?.extractionTimestamp || field?.extraction_timestamp || null,
  };
}

function serializeField(field, approvalsByField = new Map()) {
  const key = field?.key || field?.field_key || null;
  const state = fieldState(field);
  const approvals = approvalsByField.get(field?.fieldId || field?.id) || [];
  return {
    field_key: key,
    definition_key: field?.definitionKey || field?.definition_key || key,
    label: field?.label || field?.display_label || key,
    category: field?.category || field?.field_category || null,
    value: state === 'confirmed' ? (field?.value ?? field?.value_text ?? null) : null,
    current_state: state,
    confirmation: {
      confirmed: state === 'confirmed',
      verified_by: field?.verifiedBy || field?.verified_by || null,
      verified_role: field?.verifiedRole || field?.verified_role || null,
      verified_at: field?.verifiedAt || field?.verified_at || null,
    },
    approval_context: approvals.map(approval => ({
      action: approval.action,
      actor_role: approval.actor_role || null,
      approved_at: approval.created_at || null,
      is_manual: approval.is_manual !== false,
    })),
    provenance: provenance(field),
  };
}

function buildVerifiedAssetHandoff({
  propertyId,
  sourceStateAt,
  recordState = {},
  approvals = [],
  history = [],
  conflicts = [],
  closingContext = {},
  readiness = null,
} = {}) {
  const fields = Array.isArray(recordState.fields) ? recordState.fields : [];
  const approvalsByField = new Map();
  for (const approval of approvals) {
    const id = approval.field_id;
    if (!id) continue;
    if (!approvalsByField.has(id)) approvalsByField.set(id, []);
    approvalsByField.get(id).push(approval);
  }
  const serialized = fields.map(field => serializeField(field, approvalsByField));
  const verifiedData = serialized
    .filter(field => field.current_state === 'confirmed' && field.value !== null && field.value !== '')
    .map(({ field_key, definition_key, label, category, value, confirmation, approval_context, provenance: source }) => ({
      field_key, definition_key, label, category, value, confirmation, approval_context, provenance: source,
    }));
  const stateManifest = serialized.map(({ field_key, definition_key, label, category, current_state, provenance: source }) => ({
    field_key, definition_key, label, category, current_state, provenance: source,
  }));
  const exceptions = [
    ...serialized
      .filter(field => field.current_state !== 'confirmed')
      .map(field => ({
        type: field.current_state === NON_APPLICABLE ? NON_APPLICABLE : field.current_state,
        field_key: field.field_key,
        label: field.label,
        current_state: field.current_state,
        provenance: field.provenance,
      })),
    ...conflicts.filter(conflict => conflict?.status === 'unresolved').map(conflict => ({
      type: 'unresolved_conflict',
      field_key: conflict.field_key || null,
      label: conflict.display_label || conflict.field_key || 'Transaction Record field',
      canonical_value: conflict.canonical_value ?? null,
      conflicting_value: conflict.conflicting_value ?? null,
      canonical_source_doc_id: conflict.canonical_source_doc_id || null,
      conflicting_source_doc_id: conflict.conflicting_source_doc_id || null,
    })),
  ];
  const base = {
    schema: HANDOFF_SCHEMA,
    schema_version: HANDOFF_VERSION,
    property_id: propertyId || null,
    source_state_at: sourceStateAt || null,
    verified_data: verifiedData,
    state_manifest: stateManifest,
    provenance_manifest: serialized.map(field => ({
      field_key: field.field_key,
      provenance: field.provenance,
    })),
    approval_manifest: approvals.map(approval => ({
      field_id: approval.field_id || null,
      field_key: fields.find(field => (field.fieldId || field.id) === approval.field_id)?.key || null,
      action: approval.action,
      actor_role: approval.actor_role || null,
      approved_at: approval.created_at || null,
      is_manual: approval.is_manual !== false,
    })),
    exception_manifest: exceptions,
    closing_context: closingContext,
    digital_asset_readiness: readiness || null,
  };
  return {
    ...base,
    handoff_key: handoffKey(base),
    generated_at: new Date().toISOString(),
    revision_source: {
      field_history_count: history.length,
      approval_count: approvals.length,
      unresolved_exception_count: exceptions.length,
    },
  };
}

module.exports = {
  HANDOFF_SCHEMA,
  HANDOFF_VERSION,
  buildVerifiedAssetHandoff,
  fieldState,
  handoffKey,
  stable,
};