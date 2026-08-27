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

function backingFieldFor(requiredField, fields = []) {
  const requiredIdentities = [
    requiredField?.fieldId,
    requiredField?.field_id,
    requiredField?.id,
    requiredField?.fieldKey,
    requiredField?.field_key,
    requiredField?.key,
    requiredField?.definitionKey,
    requiredField?.definition_key,
    requiredField?.label,
  ].filter(Boolean).map(value => String(value).trim().toLowerCase());
  return fields.find(field => [
    field?.fieldId,
    field?.field_id,
    field?.id,
    field?.fieldKey,
    field?.field_key,
    field?.key,
    field?.definitionKey,
    field?.definition_key,
    field?.label,
  ].filter(Boolean).some(value => requiredIdentities.includes(String(value).trim().toLowerCase()))) || requiredField;
}

function latestApprovalForField(field, approvals = []) {
  const fieldId = field?.fieldId || field?.field_id || field?.id;
  if (!fieldId) return null;
  return (Array.isArray(approvals) ? approvals : [])
    .filter(approval => approval?.field_id === fieldId)
    .sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0))
    .at(-1) || null;
}

function fieldProvenance(field, approval = null) {
  return {
    source_document_id: field?.sourceDocId || field?.source_doc_id || approval?.source_doc_id || null,
    source_document_version: field?.sourceDocVersion || field?.source_doc_version || null,
    source_file_hash: field?.sourceFileHash || field?.source_file_hash || approval?.source_file_hash || null,
    source_page: field?.sourcePage ?? field?.source_page ?? null,
    source_excerpt: field?.sourceExcerpt || field?.source_excerpt || null,
    extracted_at: field?.extractionTimestamp || field?.extraction_timestamp || null,
    source_type: field?.sourceType || field?.source_type
      || (approval ? (approval.is_manual !== false ? 'manual_confirmation' : 'provider_confirmation') : null),
  };
}

function provenanceIsIntact(field, approvals = []) {
  const approval = approvalEvidence(field, approvals);
  const source = fieldProvenance(field, approval);
  return Boolean(
    source.source_document_id
    || source.source_file_hash
    || (source.source_type === 'manual' && (field?.verifiedBy || field?.verified_by))
    || (
      approval?.action === 'approved'
      && approval?.is_manual !== false
      && (approval.actor_email || approval.actor_role)
      && approval.created_at
    ),
  );
}

function approvalEvidence(field, approvals = []) {
  const approval = latestApprovalForField(field, approvals);
  if (!approval || approval.action !== 'approved' || approval.is_manual === false) return null;
  if (!(approval.actor_email || approval.actor_role) || !approval.created_at) return null;
  // A direct edit, rejection, or source replacement updates the canonical
  // field after the old approval was recorded. The old approval remains in
  // the audit trail, but it cannot attest to the newer current value.
  const fieldUpdatedAt = field?.updatedAt || field?.updated_at;
  if (fieldUpdatedAt && new Date(approval.created_at) < new Date(fieldUpdatedAt)) return null;
  return approval;
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
  const approval = approvalEvidence(field, approvals);
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
      verified_by: field?.verifiedBy || field?.verified_by || approval?.actor_email || null,
      verified_role: field?.verifiedRole || field?.verified_role || approval?.actor_role || null,
      verified_at: field?.verifiedAt || field?.verified_at || approval?.created_at || null,
    },
    provenance: fieldProvenance(field, approval),
    approvals: approvals.map(approval => ({
      action: approval.action,
      actor_role: approval.actor_role || null,
      approved_at: approval.created_at || null,
      is_manual: approval.is_manual !== false,
    })),
  };
}

function buildDigitalAssetReadiness({ fields, requiredFields, conflicts, approvals, room }) {
  const approvalsFor = field => approvals.filter(approval =>
    approval?.field_id && approval.field_id === (field?.fieldId || field?.field_id || field?.id),
  );
  const serialized = fields.map(field => serializeField(
    field,
    approvalsFor(field),
  ));
  const byCategory = category => serialized.filter(field => field.category === category);
  const required = requiredFields.map(requiredField => {
    const field = backingFieldFor(requiredField);
    return serializeField(field, approvalsFor(field));
  });
  const requiredApprovalFields = required.filter(field =>
    field.category === 'approvals' || String(field.field_key || '').startsWith('approval.'),
  );
  const approvalResults = requiredApprovalFields.map(field => ({
    field_key: field.field_key,
    label: field.label,
    satisfied: latestApprovalForField(field, approvals)?.action === 'approved',
  }));
  const blockingFields = required.filter(field =>
    field.current_state !== 'confirmed' && field.current_state !== NON_APPLICABLE,
  );
  const unresolvedConflicts = conflicts.filter(conflict => conflict?.status === 'unresolved');
  const provenanceGaps = required
    .filter(field => field.current_state === 'confirmed')
    .filter(field => {
      const backingField = backingFieldFor(field, fields);
      return !provenanceIsIntact(backingField, approvalsFor(backingField));
    })
    .map(field => ({
      field_key: field.field_key,
      label: field.label,
      requirement: 'document or file provenance, or an approved manual confirmation',
      source: field.provenance.source_document_id
        || field.provenance.source_file_hash
        || field.provenance.source_type
        || 'none',
    }));
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
      gaps: provenanceGaps,
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
        fields: requiredFields.map(requiredField => {
          const field = backingFieldFor(requiredField, fields);
          return serializeField(
            field,
            approvals.filter(approval => approval.field_id === (field.fieldId || field.field_id || field.id)),
          );
        }),
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
    .concat(approvals.map(approval => approval?.created_at).filter(Boolean))
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