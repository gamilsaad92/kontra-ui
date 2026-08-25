'use strict';

const crypto = require('crypto');

const SNAPSHOT_SCHEMA = 'kontra.verified-asset';
const SNAPSHOT_VERSION = '1.0.0';
const CONFIRMED = new Set(['confirmed', 'verified']);
const NON_APPLICABLE = 'not_applicable';

function meaningful(value) {
  return value !== null && value !== undefined && String(value).trim() !== '';
}

function fieldValue(field) {
  return field?.value ?? field?.value_text ?? field?.value_json ?? null;
}

function fieldKey(field) {
  return field?.key || field?.field_key || null;
}

function fieldCategory(field) {
  const key = fieldKey(field) || '';
  return field?.category || field?.field_category || key.split('.')[0] || 'transaction';
}

function fieldProvenance(field) {
  return {
    source_document_id: field?.sourceDocId || field?.source_doc_id || null,
    source_document_version: field?.sourceDocVersion || field?.source_doc_version || null,
    source_file_hash: field?.sourceFileHash || field?.source_file_hash || null,
    source_page: field?.sourcePage ?? field?.source_page ?? null,
    source_excerpt: field?.sourceExcerpt || field?.source_excerpt || null,
    extracted_at: field?.extractionTimestamp || field?.extraction_timestamp || null,
    source_type: field?.sourceType || field?.source_type || null,
  };
}

function provenanceIsIntact(field) {
  const source = fieldProvenance(field);
  return Boolean(
    source.source_document_id
    || source.source_file_hash
    || (source.source_type === 'manual' && (field?.verifiedBy || field?.verified_by)),
  );
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  return Object.keys(value).sort().reduce((result, key) => {
    result[key] = stable(value[key]);
    return result;
  }, {});
}

function hashSnapshot(value) {
  return crypto.createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');
}

function serializeField(field, approvals = []) {
  const status = field?.status || 'missing';
  const confirmed = CONFIRMED.has(status);
  return {
    field_id: field?.fieldId || field?.id || null,
    field_key: fieldKey(field),
    definition_key: field?.definitionKey || field?.definition_key || fieldKey(field),
    label: field?.label || field?.display_label || fieldKey(field),
    category: fieldCategory(field),
    current_state: status,
    value: confirmed ? fieldValue(field) : null,
    confirmation: {
      confirmed,
      verified_by: field?.verifiedBy || field?.verified_by || null,
      verified_role: field?.verifiedRole || field?.verified_role || null,
      verified_at: field?.verifiedAt || field?.verified_at || null,
    },
    provenance: fieldProvenance(field),
    approvals: approvals.map(approval => ({
      action: approval.action,
      actor_role: approval.actor_role || null,
      approved_at: approval.created_at || null,
      is_manual: approval.is_manual !== false,
    })),
  };
}

function buildDigitalAssetReadiness({ fields, requiredFields, conflicts, approvals, room }) {
  const serialized = fields.map(field => serializeField(
    field,
    approvals.filter(approval => approval.field_id && approval.field_id === (field.fieldId || field.id)),
  ));
  const byCategory = category => serialized.filter(field => field.category === category);
  const required = requiredFields.map(field => serializeField(
    field,
    approvals.filter(approval => approval.field_id && approval.field_id === (field.fieldId || field.id)),
  ));
  const requiredApprovalFields = required.filter(field =>
    field.category === 'approvals' || String(field.field_key || '').startsWith('approval.'),
  );
  const approvedFieldIds = new Set(
    approvals.filter(approval => approval.action === 'approved').map(approval => approval.field_id),
  );
  const approvalResults = requiredApprovalFields.map(field => ({
    field_key: field.field_key,
    label: field.label,
    satisfied: field.approvals.some(approval => approval.action === 'approved')
      || approvedFieldIds.has(field.field_id),
  }));
  const blockingFields = required.filter(field =>
    field.current_state !== 'confirmed' && field.current_state !== NON_APPLICABLE,
  );
  const unresolvedConflicts = conflicts.filter(conflict => conflict?.status === 'unresolved');
  const provenanceGaps = required
    .filter(field => field.current_state === 'confirmed')
    .filter(field => !provenanceIsIntact(fields.find(item => fieldKey(item) === field.field_key)));
  const missingApprovals = approvalResults.filter(item => !item.satisfied);
  const sections = {
    asset: byCategory('asset_identity'),
    parties: byCategory('parties'),
    transaction: byCategory('transaction'),
    ownership_evidence: byCategory('beneficial_ownership'),
    jurisdiction: byCategory('transaction').filter(field => /jurisdiction/i.test(`${field.field_key} ${field.label}`)),
    financials: byCategory('financial'),
    legal_governing_documents: byCategory('legal'),
    investor_restrictions: serialized.filter(field => /investor|restriction|accredit|kyc|aml/i.test(`${field.field_key} ${field.label}`)),
  };
  const readiness = {
    status: blockingFields.length || unresolvedConflicts.length || missingApprovals.length || provenanceGaps.length
      ? 'preparation_incomplete'
      : 'ready_for_external_review',
    eligible: blockingFields.length === 0
      && unresolvedConflicts.length === 0
      && missingApprovals.length === 0
      && provenanceGaps.length === 0
      && required.length > 0,
    sections,
    provenance: {
      intact: provenanceGaps.length === 0,
      confirmed_field_count: required.filter(field => field.current_state === 'confirmed').length,
      gaps: provenanceGaps.map(field => ({ field_key: field.field_key, label: field.label })),
    },
    approvals: {
      required: approvalResults,
      satisfied: missingApprovals.length === 0,
      missing: missingApprovals,
    },
    exceptions: {
      blocking_count: blockingFields.length + unresolvedConflicts.length
        + missingApprovals.length + provenanceGaps.length,
      unresolved_conflicts: unresolvedConflicts,
      resolved_conflicts: conflicts.filter(conflict => conflict?.status === 'resolved'),
      incomplete_required_fields: blockingFields.map(field => ({
        field_key: field.field_key,
        label: field.label,
        state: field.current_state,
      })),
    },
    settlement_method: {
      mode: room?.settlement_mode || null,
      recorded: Boolean(room?.settlement_mode),
    },
  };
  return readiness;
}

function buildVerifiedAssetSnapshot({
  propertyId,
  room = {},
  recordState = {},
  conflicts = [],
  approvals = [],
  sourceStateAt = null,
} = {}) {
  const fields = Array.isArray(recordState.fields) ? recordState.fields : [];
  const requiredFields = Array.isArray(recordState.requiredFields) ? recordState.requiredFields : [];
  const digitalAssetReadiness = buildDigitalAssetReadiness({
    fields,
    requiredFields,
    conflicts,
    approvals,
    room,
  });
  const snapshot = {
    schema: SNAPSHOT_SCHEMA,
    schema_version: SNAPSHOT_VERSION,
    property_id: propertyId || null,
    created_from: {
      transaction_record: {
        schema_key: recordState.schemaKey || null,
        required_count: requiredFields.length,
        confirmed_count: recordState.confirmedCount || 0,
        fields: requiredFields.map(field => serializeField(
          field,
          approvals.filter(approval => approval.field_id === (field.fieldId || field.id)),
        )),
      },
      provenance_manifest: fields.map(field => ({
        field_key: fieldKey(field),
        provenance: fieldProvenance(field),
      })),
      approvals: approvals.map(approval => ({
        field_id: approval.field_id || null,
        action: approval.action,
        actor_role: approval.actor_role || null,
        actor_email: approval.actor_email || null,
        created_at: approval.created_at || null,
      })),
      exceptions: conflicts.map(conflict => ({
        id: conflict.id || null,
        field_key: conflict.field_key || null,
        label: conflict.display_label || conflict.field_key || 'Transaction Record exception',
        status: conflict.status || 'unresolved',
        canonical_value: conflict.canonical_value ?? null,
        conflicting_value: conflict.conflicting_value ?? null,
        resolution_value: conflict.resolution_value ?? null,
        resolution_note: conflict.resolution_note ?? null,
        resolved_by: conflict.resolved_by ?? null,
        resolved_at: conflict.resolved_at ?? null,
      })),
      settlement_mode: room.settlement_mode || null,
      readiness: {
        overall: recordState.requiredCount
          ? Math.round(((recordState.confirmedCount || 0) / recordState.requiredCount) * 100)
          : 0,
        confirmed_count: recordState.confirmedCount || 0,
        required_count: recordState.requiredCount || requiredFields.length,
        awaiting_count: recordState.awaitingRequiredCount || 0,
        missing_count: recordState.missingRequiredCount || 0,
        conflict_count: recordState.unresolvedConflictCount || 0,
      },
    },
    digital_asset_readiness: digitalAssetReadiness,
    disclosure: 'Kontra coordinates and prepares information for external review. This snapshot is not legal, regulatory, investment, issuance, custody, KYC, or settlement approval.',
  };
  const sourceFields = [...fields, ...requiredFields];
  const sourceTimes = sourceFields
    .map(field => field?.updatedAt || field?.updated_at)
    .filter(Boolean)
    .sort();
  return {
    ...snapshot,
    source_state_at: sourceStateAt || sourceTimes.at(-1) || room.updated_at || room.activated_at || null,
    snapshot_hash: hashSnapshot(snapshot),
  };
}

module.exports = {
  SNAPSHOT_SCHEMA,
  SNAPSHOT_VERSION,
  buildVerifiedAssetSnapshot,
  hashSnapshot,
  provenanceIsIntact,
};