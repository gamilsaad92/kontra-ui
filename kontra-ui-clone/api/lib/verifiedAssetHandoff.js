'use strict';

const crypto = require('crypto');
const { buildVerifiedAssetSnapshot } = require('./verifiedAssetSnapshot');

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
  const foundationSnapshot = buildVerifiedAssetSnapshot({
    propertyId,
    room: { settlement_mode: closingContext.settlement_mode || null },
    recordState,
    approvals,
    confirmationHistory: history,
    conflicts,
    sourceStateAt,
  });
  const foundationFields = foundationSnapshot.created_from?.transaction_record?.canonical_fields || [];
  const serialized = fields.map(field => {
    const identity = field?.fieldId || field?.field_id || field?.id || field?.key || field?.field_key;
    const foundationField = foundationFields.find(candidate => (
      identity
      && (
        identity === candidate.field_id
        || identity === candidate.field_key
        || identity === candidate.definition_key
      )
    ));
    return {
      ...serializeField(field, approvalsByField),
      evidence_lineage: foundationField?.evidence_lineage || null,
    };
  });
  const verifiedData = serialized
    .filter(field => field.current_state === 'confirmed' && field.value !== null && field.value !== '')
    .map(({ field_key, definition_key, label, category, value, confirmation, approval_context, provenance: source, evidence_lineage }) => ({
      field_key, definition_key, label, category, value, confirmation, approval_context, provenance: source, evidence_lineage,
    }));
  const stateManifest = serialized.map(({ field_key, definition_key, label, category, current_state, provenance: source, evidence_lineage }) => ({
    field_key, definition_key, label, category, current_state, provenance: source, evidence_lineage,
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
        evidence_lineage: field.evidence_lineage,
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
    history_manifest: history.map(event => ({
      id: event?.id || null,
      field_id: event?.field_id || event?.fieldId || null,
      field_key: event?.field_key || event?.fieldKey || null,
      event_type: event?.event_type || event?.eventType || null,
      actor_email: event?.actor_email || event?.actorEmail || null,
      actor_role: event?.actor_role || event?.actorRole || null,
      prior_value: event?.prior_value ?? null,
      new_value: event?.new_value ?? null,
      prior_status: event?.prior_status || null,
      new_status: event?.new_status || null,
      source_document_id: event?.source_doc_id || event?.sourceDocId || null,
      source_page: event?.source_page ?? event?.sourcePage ?? null,
      source_excerpt: event?.source_excerpt || event?.sourceExcerpt || null,
      metadata: event?.metadata || null,
      created_at: event?.created_at || event?.createdAt || null,
    })),
    exception_history: conflicts.map(conflict => ({
      id: conflict?.id || null,
      field_id: conflict?.field_id || conflict?.fieldId || null,
      field_key: conflict?.field_key || conflict?.fieldKey || null,
      status: conflict?.status || 'unresolved',
      canonical_value: conflict?.canonical_value ?? null,
      conflicting_value: conflict?.conflicting_value ?? null,
      canonical_source_doc_id: conflict?.canonical_source_doc_id || null,
      conflicting_source_doc_id: conflict?.conflicting_source_doc_id || null,
      resolution_value: conflict?.resolution_value ?? null,
      resolution_note: conflict?.resolution_note || null,
      resolved_by: conflict?.resolved_by || null,
      resolved_at: conflict?.resolved_at || null,
      created_at: conflict?.created_at || null,
      updated_at: conflict?.updated_at || null,
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
    verified_asset: foundationSnapshot.verified_asset,
    digital_asset_readiness_export: foundationSnapshot.digital_asset_readiness,
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