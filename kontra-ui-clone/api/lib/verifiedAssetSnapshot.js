'use strict';

const crypto = require('crypto');

const SNAPSHOT_SCHEMA = 'kontra.verified-asset';
const SNAPSHOT_VERSION = '1.1.0';
const VERIFIED_ASSET_SCHEMA = 'kontra.verified-asset-state';
const VERIFIED_ASSET_VERSION = '1.0.0';
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

function normalizedIdentity(value) {
  return value === null || value === undefined
    ? ''
    : String(value).trim().toLowerCase();
}

function comparableValue(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value).trim();
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

function historyMatchesField(field, event) {
  const fieldId = field?.fieldId || field?.field_id || field?.id;
  const eventFieldId = event?.field_id || event?.fieldId;
  if (fieldId && eventFieldId) return normalizedIdentity(fieldId) === normalizedIdentity(eventFieldId);
  const identities = [
    field?.key,
    field?.field_key,
    field?.persistedKey,
    field?.fieldKey,
    field?.definitionKey,
    field?.definition_key,
    field?.label,
    field?.display_label,
  ].filter(Boolean).map(normalizedIdentity);
  return [
    event?.field_key,
    event?.fieldKey,
    event?.definition_key,
    event?.definitionKey,
    event?.label,
    event?.display_label,
  ].filter(Boolean).some(value => identities.includes(normalizedIdentity(value)));
}

function historyValueMatchesField(field, event) {
  const eventValue = event?.new_value ?? event?.value ?? null;
  if (!meaningful(eventValue)) return true;
  return comparableValue(eventValue) === comparableValue(fieldValue(field));
}

function latestHistoryEvidence(field, confirmationHistory = []) {
  const events = (Array.isArray(confirmationHistory) ? confirmationHistory : [])
    .filter(event => historyMatchesField(field, event))
    .sort((a, b) => new Date(a.created_at || a.createdAt || 0) - new Date(b.created_at || b.createdAt || 0));
  let evidence = null;
  for (const event of events) {
    const eventType = normalizedIdentity(event?.event_type || event?.eventType);
    const newStatus = normalizedIdentity(event?.new_status || event?.newStatus);
    const hasActor = Boolean(event?.actor_email || event?.actorEmail || event?.actor_role || event?.actorRole);
    const hasTimestamp = Boolean(event?.created_at || event?.createdAt);
    const hasDocumentEvidence = Boolean(
      event?.source_doc_id
      || event?.sourceDocId
      || event?.source_file_hash
      || event?.sourceFileHash
      || event?.metadata?.source_doc_id
      || event?.metadata?.source_file_hash,
    );
    const isConfirmedStatus = CONFIRMED.has(newStatus);
    const isInvalidating = new Set([
      'manual_edit',
      'source_changed',
      'conflict',
      'marked_not_applicable',
    ]).has(eventType);

    if (isInvalidating) {
      // A current confirmed manual edit is itself valid review evidence only
      // when its value and confirmed status match the canonical row.
      if (
        eventType === 'manual_edit'
        && isConfirmedStatus
        && hasActor
        && hasTimestamp
        && historyValueMatchesField(field, event)
      ) {
        evidence = event;
      } else {
        evidence = null;
      }
      continue;
    }

    if (
      ['extracted', 'confirmed'].includes(eventType)
      && meaningful(event?.new_value)
      && !historyValueMatchesField(field, event)
    ) {
      // A newer event for a different value cannot leave an older
      // confirmation attached to the current canonical field.
      evidence = null;
      continue;
    }

    if (
      eventType === 'confirmed'
      && (isConfirmedStatus || !newStatus)
      && hasActor
      && hasTimestamp
      && historyValueMatchesField(field, event)
    ) {
      evidence = event;
      continue;
    }

    if (
      eventType === 'extracted'
      && hasDocumentEvidence
      && historyValueMatchesField(field, event)
    ) {
      evidence = event;
    }
  }
  return evidence;
}

function latestApprovalForField(field, approvals = []) {
  const fieldId = field?.fieldId || field?.field_id || field?.id;
  if (!fieldId) return null;
  return (Array.isArray(approvals) ? approvals : [])
    .filter(approval => approval?.field_id === fieldId)
    .sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0))
    .at(-1) || null;
}

function fieldProvenance(field, approval = null, historyEvidence = null) {
  const historySourceDocumentId = historyEvidence?.source_doc_id
    || historyEvidence?.sourceDocId
    || historyEvidence?.metadata?.source_doc_id
    || null;
  const historySourceFileHash = historyEvidence?.source_file_hash
    || historyEvidence?.sourceFileHash
    || historyEvidence?.metadata?.source_file_hash
    || null;
  return {
    source_document_id: field?.sourceDocId || field?.source_doc_id || approval?.source_doc_id || historySourceDocumentId,
    source_document_version: field?.sourceDocVersion || field?.source_doc_version || null,
    source_file_hash: field?.sourceFileHash || field?.source_file_hash || approval?.source_file_hash || historySourceFileHash,
    source_page: field?.sourcePage ?? field?.source_page ?? historyEvidence?.source_page ?? null,
    source_excerpt: field?.sourceExcerpt || field?.source_excerpt || historyEvidence?.source_excerpt || null,
    extracted_at: field?.extractionTimestamp || field?.extraction_timestamp || historyEvidence?.created_at || null,
    extracted_by: field?.extractedBy || field?.extracted_by || null,
    source_type: field?.sourceType || field?.source_type
      || (approval ? (approval.is_manual !== false ? 'manual_confirmation' : 'provider_confirmation') : null)
      || (historyEvidence
        ? (historySourceDocumentId || historySourceFileHash ? 'document_history' : 'manual_confirmation_history')
        : null),
  };
}

function provenanceIsIntact(field, approvals = [], confirmationHistory = []) {
  const approval = approvalEvidence(field, approvals);
  const historyEvidence = latestHistoryEvidence(field, confirmationHistory);
  const source = fieldProvenance(field, approval, historyEvidence);
  return Boolean(
    source.source_document_id
    || source.source_file_hash
    || (source.source_type === 'manual' && (field?.verifiedBy || field?.verified_by))
    || (
      approval?.action === 'approved'
      && approval?.is_manual !== false
      && (approval.actor_email || approval.actor_role)
      && approval.created_at
    )
    || (
      historyEvidence
      && (
        historyEvidence.event_type === 'extracted'
        || historyEvidence.eventType === 'extracted'
        || historyEvidence.event_type === 'confirmed'
        || historyEvidence.eventType === 'confirmed'
        || historyEvidence.event_type === 'manual_edit'
        || historyEvidence.eventType === 'manual_edit'
      )
      && (historyEvidence.actor_email || historyEvidence.actorEmail || historyEvidence.actor_role || historyEvidence.actorRole)
      && (historyEvidence.created_at || historyEvidence.createdAt)
    )
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

function latestExtractionEvidence(field, confirmationHistory = []) {
  return (Array.isArray(confirmationHistory) ? confirmationHistory : [])
    .filter(event =>
      historyMatchesField(field, event)
      && normalizedIdentity(event?.event_type || event?.eventType) === 'extracted',
    )
    .sort((a, b) => new Date(a.created_at || a.createdAt || 0) - new Date(b.created_at || b.createdAt || 0))
    .at(-1) || null;
}

function conflictMatchesField(field, conflict) {
  const fieldId = field?.fieldId || field?.field_id || field?.id;
  const conflictFieldId = conflict?.field_id || conflict?.fieldId;
  if (fieldId && conflictFieldId) {
    return normalizedIdentity(fieldId) === normalizedIdentity(conflictFieldId);
  }
  const identities = [
    field?.key,
    field?.field_key,
    field?.definitionKey,
    field?.definition_key,
    field?.label,
    field?.display_label,
  ].filter(Boolean).map(normalizedIdentity);
  return [
    conflict?.field_key,
    conflict?.fieldKey,
    conflict?.display_label,
  ].filter(Boolean).some(value => identities.includes(normalizedIdentity(value)));
}

function serializeConflict(conflict) {
  return {
    id: conflict?.id || null,
    field_id: conflict?.field_id || conflict?.fieldId || null,
    field_key: conflict?.field_key || conflict?.fieldKey || null,
    label: conflict?.display_label || conflict?.label || conflict?.field_key || 'Transaction Record exception',
    status: conflict?.status || 'unresolved',
    canonical_value: conflict?.canonical_value ?? null,
    conflicting_value: conflict?.conflicting_value ?? null,
    canonical_source_doc_id: conflict?.canonical_source_doc_id || null,
    conflicting_source_doc_id: conflict?.conflicting_source_doc_id || null,
    canonical_source_page: conflict?.canonical_source_page ?? null,
    conflicting_source_page: conflict?.conflicting_source_page ?? null,
    canonical_source_excerpt: conflict?.canonical_source_excerpt || null,
    conflicting_source_excerpt: conflict?.conflicting_source_excerpt || null,
    resolution_value: conflict?.resolution_value ?? null,
    resolution_note: conflict?.resolution_note || null,
    resolved_by: conflict?.resolved_by || null,
    resolved_at: conflict?.resolved_at || null,
    created_at: conflict?.created_at || null,
    updated_at: conflict?.updated_at || null,
  };
}

function serializeHistoryException(event) {
  return {
    type: normalizedIdentity(event?.event_type || event?.eventType) || 'history_exception',
    field_id: event?.field_id || event?.fieldId || null,
    field_key: event?.field_key || event?.fieldKey || null,
    status: event?.new_status || event?.newStatus || null,
    prior_value: event?.prior_value ?? null,
    new_value: event?.new_value ?? null,
    prior_status: event?.prior_status || null,
    new_status: event?.new_status || null,
    source_document_id: event?.source_doc_id || event?.sourceDocId || null,
    source_page: event?.source_page ?? event?.sourcePage ?? null,
    source_excerpt: event?.source_excerpt || event?.sourceExcerpt || null,
    metadata: event?.metadata || null,
    created_at: event?.created_at || event?.createdAt || null,
  };
}

function fieldEvidenceLineage(field, approvals = [], confirmationHistory = [], conflicts = []) {
  const approval = approvalEvidence(field, approvals);
  const historyEvidence = latestHistoryEvidence(field, confirmationHistory);
  const extraction = latestExtractionEvidence(field, confirmationHistory);
  const source = fieldProvenance(field, approval, historyEvidence);
  const currentValue = fieldValue(field);
  const extractedValue = extraction?.new_value
    ?? extraction?.value
    ?? (source.source_document_id || source.source_file_hash ? currentValue : null);
  const status = field?.status || 'missing';

  return {
    source_document: {
      id: source.source_document_id,
      version: source.source_document_version,
      file_hash: source.source_file_hash,
      page: source.source_page,
      excerpt: source.source_excerpt,
    },
    extracted: {
      value: extractedValue,
      at: extraction?.created_at || extraction?.createdAt || field?.extractionTimestamp || field?.extraction_timestamp || null,
      by: field?.extractedBy || field?.extracted_by || extraction?.actor_email || extraction?.actorEmail || null,
    },
    human_confirmation: {
      confirmed: CONFIRMED.has(status),
      actor: field?.verifiedBy || field?.verified_by || historyEvidence?.actor_email || historyEvidence?.actorEmail || null,
      actor_role: field?.verifiedRole || field?.verified_role || historyEvidence?.actor_role || historyEvidence?.actorRole || null,
      at: field?.verifiedAt || field?.verified_at || historyEvidence?.created_at || historyEvidence?.createdAt || null,
    },
    approvals: approvals.map(item => ({
      id: item?.id || null,
      action: item?.action || null,
      actor_email: item?.actor_email || null,
      actor_role: item?.actor_role || null,
      is_manual: item?.is_manual !== false,
      prior_value: item?.prior_value ?? null,
      new_value: item?.new_value ?? null,
      source_document_id: item?.source_doc_id || null,
      source_file_hash: item?.source_file_hash || null,
      note: item?.note || null,
      approved_at: item?.created_at || null,
    })),
    exception_history: [
      ...confirmationHistory
        .filter(event =>
          historyMatchesField(field, event)
          && ['conflict', 'source_changed'].includes(
            normalizedIdentity(event?.event_type || event?.eventType),
          ),
        )
        .map(serializeHistoryException),
      ...conflicts
        .filter(conflict => conflictMatchesField(field, conflict))
        .map(serializeConflict),
    ],
    final_canonical: {
      value: currentValue,
      state: status,
      updated_at: field?.updatedAt || field?.updated_at || null,
    },
  };
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

function serializeField(field, approvals = [], confirmationHistory = [], conflicts = []) {
  const status = field?.status || 'missing';
  const confirmed = CONFIRMED.has(status);
  const approval = approvalEvidence(field, approvals);
  const historyEvidence = latestHistoryEvidence(field, confirmationHistory);
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
      verified_by: field?.verifiedBy || field?.verified_by || approval?.actor_email || historyEvidence?.actor_email || null,
      verified_role: field?.verifiedRole || field?.verified_role || approval?.actor_role || historyEvidence?.actor_role || null,
      verified_at: field?.verifiedAt || field?.verified_at || approval?.created_at || historyEvidence?.created_at || null,
    },
    provenance: fieldProvenance(field, approval, historyEvidence),
    approvals: approvals.map(approval => ({
        id: approval.id || null,
      action: approval.action,
        actor_email: approval.actor_email || null,
      actor_role: approval.actor_role || null,
      approved_at: approval.created_at || null,
      is_manual: approval.is_manual !== false,
        prior_value: approval.prior_value ?? null,
        new_value: approval.new_value ?? null,
        source_document_id: approval.source_doc_id || null,
        source_file_hash: approval.source_file_hash || null,
        note: approval.note || null,
    })),
    evidence_lineage: fieldEvidenceLineage(field, approvals, confirmationHistory, conflicts),
  };
}

function serializeCanonicalField(field, approvals = [], confirmationHistory = [], conflicts = []) {
  return {
    ...serializeField(field, approvals, confirmationHistory, conflicts),
    // The handoff projection intentionally redacts values that are not
    // confirmed. Snapshot inspection must preserve the exact canonical value
    // that existed when the snapshot was recorded, regardless of state.
    value: fieldValue(field),
  };
}

function buildDigitalAssetReadiness({
  fields,
  requiredFields,
  conflicts,
  approvals,
  confirmationHistory = [],
  room,
}) {
  const approvalsFor = field => approvals.filter(approval =>
    approval?.field_id && approval.field_id === (field?.fieldId || field?.field_id || field?.id),
  );
  const historyFor = field => confirmationHistory.filter(event => historyMatchesField(field, event));
  const conflictsFor = field => conflicts.filter(conflict => conflictMatchesField(field, conflict));
  const serialized = fields.map(field => serializeField(
    field,
    approvalsFor(field),
    historyFor(field),
    conflictsFor(field),
  ));
  const byCategory = category => serialized.filter(field => field.category === category);
  const required = requiredFields.map(requiredField => {
    const field = backingFieldFor(requiredField, fields);
    return serializeField(field, approvalsFor(field), historyFor(field), conflictsFor(field));
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
      return !provenanceIsIntact(backingField, approvalsFor(backingField), historyFor(backingField));
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
  const selectFields = predicate => serialized.filter(predicate);
  const assetFields = selectFields(field =>
    field.category === 'asset_identity'
    || /underlying[_ .-]?asset|property|asset[_ .-]?name/i.test(`${field.field_key} ${field.label}`),
  );
  const ownerRightsFields = selectFields(field =>
    ['parties', 'beneficial_ownership'].includes(field.category)
    || /\b(?:legal owner|owner|ownership|rights?|title)\b/i.test(`${field.field_key} ${field.label}`),
  );
  const jurisdictionFields = selectFields(field =>
    /jurisdiction|governing[_ .-]?law|legal[_ .-]?geography/i.test(`${field.field_key} ${field.label}`),
  );
  const governingDocumentFields = selectFields(field =>
    field.category === 'legal'
    && /document|agreement|deed|title|opinion|governing/i.test(`${field.field_key} ${field.label}`),
  );
  const restrictionFields = selectFields(field =>
    /restriction|encumbrance|limitation|transfer|participation|investor/i.test(`${field.field_key} ${field.label}`),
  );
  const futureIssuanceField = serialized.find(field =>
    /(?:future|external|issuance|reference)[_ .-]*(?:issuance|external|reference|id)/i.test(
      `${field.field_key} ${field.label}`,
    ),
  ) || null;
  const unresolvedExceptions = [
    ...blockingFields.map(field => ({
      type: 'incomplete_required_field',
      field_key: field.field_key,
      label: field.label,
      state: field.current_state,
      evidence_lineage: field.evidence_lineage,
    })),
    ...unresolvedConflicts.map(conflict => ({
      type: 'unresolved_conflict',
      ...serializeConflict(conflict),
    })),
    ...missingApprovals.map(approval => ({
      type: 'missing_approval',
      ...approval,
    })),
    ...provenanceGaps.map(gap => ({
      type: 'provenance_gap',
      ...gap,
    })),
  ];
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
    verification_status: {
      status: blockingFields.length || unresolvedConflicts.length || missingApprovals.length || provenanceGaps.length
        ? 'verification_incomplete'
        : 'verified_for_external_review',
      eligible: blockingFields.length === 0
        && unresolvedConflicts.length === 0
        && missingApprovals.length === 0
        && provenanceGaps.length === 0
        && required.length > 0,
      confirmed_fact_count: required.filter(field => field.current_state === 'confirmed').length,
      required_fact_count: required.length,
    },
    canonical_facts: serialized.filter(field =>
      field.current_state === 'confirmed' && meaningful(field.value),
    ),
    asset: {
      underlying_asset: assetFields,
      legal_owner_rights: ownerRightsFields,
      jurisdiction: jurisdictionFields,
      governing_documents: governingDocumentFields,
      restrictions: restrictionFields,
    },
    unresolved_exceptions: unresolvedExceptions,
    settlement_mode: room?.settlement_mode || null,
    future_external_issuance_reference_id: futureIssuanceField
      && futureIssuanceField.current_state === 'confirmed'
      && futureIssuanceField.value !== null
      && futureIssuanceField.value !== ''
      ? {
        value: futureIssuanceField.value,
        evidence_lineage: futureIssuanceField.evidence_lineage,
      }
      : null,
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

function buildVerifiedAssetState({
  propertyId,
  recordState = {},
  readiness = {},
  fields = [],
} = {}) {
  const canonicalFacts = Array.isArray(readiness.canonical_facts)
    ? readiness.canonical_facts
    : fields
      .filter(field => CONFIRMED.has(field?.status || ''))
      .filter(field => meaningful(fieldValue(field)));
  return {
    schema: VERIFIED_ASSET_SCHEMA,
    schema_version: VERIFIED_ASSET_VERSION,
    asset_id: propertyId || null,
    status: readiness.status || 'preparation_incomplete',
    verification_status: readiness.verification_status || null,
    canonical_facts: canonicalFacts,
    approvals: readiness.approvals || { required: [], satisfied: false, missing: [] },
    provenance: readiness.provenance || { intact: false, confirmed_field_count: 0, gaps: [] },
    unresolved_exceptions: readiness.unresolved_exceptions || [],
    source: {
      transaction_record_schema: recordState.schemaKey || null,
      confirmed_fact_count: recordState.confirmedCount || 0,
      required_fact_count: recordState.requiredCount || 0,
    },
    disclosure: 'Kontra coordinates and prepares facts for external review. This state is not legal, regulatory, investment, issuance, custody, KYC, or settlement approval.',
  };
}

function buildVerifiedAssetSnapshot({
  propertyId,
  room = {},
  recordState = {},
  conflicts = [],
  approvals = [],
  confirmationHistory = [],
  sourceStateAt = null,
} = {}) {
  const fields = Array.isArray(recordState.fields) ? recordState.fields : [];
  const requiredFields = Array.isArray(recordState.requiredFields) ? recordState.requiredFields : [];
  const digitalAssetReadiness = buildDigitalAssetReadiness({
    fields,
    requiredFields,
    conflicts,
    approvals,
    confirmationHistory,
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
            confirmationHistory.filter(event => historyMatchesField(field, event)),
            conflicts.filter(conflict => conflictMatchesField(field, conflict)),
          );
        }),
        canonical_fields: fields.map(field => serializeCanonicalField(
          field,
          approvals.filter(approval => approval.field_id === (field.fieldId || field.field_id || field.id)),
          confirmationHistory.filter(event => historyMatchesField(field, event)),
          conflicts.filter(conflict => conflictMatchesField(field, conflict)),
        )),
      },
      provenance_manifest: fields.map(field => ({
        field_key: fieldKey(field),
        provenance: fieldProvenance(
          field,
          approvalEvidence(field, approvals.filter(approval =>
            approval.field_id === (field.fieldId || field.field_id || field.id),
          )),
          latestHistoryEvidence(field, confirmationHistory),
        ),
      })),
      confirmation_history: confirmationHistory.map(event => ({
        field_id: event.field_id || event.fieldId || null,
        field_key: event.field_key || event.fieldKey || null,
        event_type: event.event_type || event.eventType || null,
        actor_email: event.actor_email || event.actorEmail || null,
        actor_role: event.actor_role || event.actorRole || null,
        new_status: event.new_status || event.newStatus || null,
        created_at: event.created_at || event.createdAt || null,
        source_doc_id: event.source_doc_id || event.sourceDocId || null,
        source_page: event.source_page || event.sourcePage || null,
        source_excerpt: event.source_excerpt || event.sourceExcerpt || null,
        metadata: event.metadata || null,
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
    verified_asset: buildVerifiedAssetState({
      propertyId,
      recordState,
      readiness: digitalAssetReadiness,
      fields,
    }),
    disclosure: 'Kontra coordinates and prepares information for external review. This snapshot is not legal, regulatory, investment, issuance, custody, KYC, or settlement approval.',
  };
  const sourceFields = [...fields, ...requiredFields];
  const sourceTimes = sourceFields
    .map(field => field?.updatedAt || field?.updated_at)
    .filter(Boolean)
    .concat(approvals.map(approval => approval?.created_at).filter(Boolean))
    .concat(confirmationHistory.map(event => event?.created_at || event?.createdAt).filter(Boolean))
    .concat(conflicts.map(conflict => conflict?.updated_at || conflict?.updatedAt || conflict?.created_at).filter(Boolean))
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
  VERIFIED_ASSET_SCHEMA,
  VERIFIED_ASSET_VERSION,
  buildVerifiedAssetSnapshot,
  buildVerifiedAssetState,
  hashSnapshot,
  provenanceIsIntact,
};