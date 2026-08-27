'use strict';

const crypto = require('crypto');

const PACKAGE_SCHEMA = 'kontra.digital-asset-preparation-package';
const PACKAGE_VERSION = '1.0.0';

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  return Object.keys(value).sort().reduce((result, key) => {
    result[key] = stable(value[key]);
    return result;
  }, {});
}

function hashPackage(value) {
  return crypto.createHash('sha256')
    .update(JSON.stringify(stable(value)))
    .digest('hex');
}

function canonicalFieldsFromSnapshot(snapshot) {
  const record = snapshot?.created_from?.transaction_record || {};
  return Array.isArray(record.canonical_fields)
    ? record.canonical_fields
    : (Array.isArray(record.fields) ? record.fields : []);
}

const PREPARATION_FIELD_MATCHERS = {
  issuer: ['issuer', 'issuer_name', 'issuer.entity', 'sponsor'],
  legal_entity: ['legal_entity', 'legal.entity', 'ownership.entity', 'entity_name'],
  jurisdiction: ['jurisdiction', 'legal.jurisdiction', 'transaction.jurisdiction'],
  underlying_asset: ['underlying_asset', 'asset.name', 'asset.description', 'property_name'],
  ownership_evidence: ['ownership_evidence', 'ownership.proof', 'ownership.title'],
  security_offering_structure: ['security_offering_structure', 'offering.structure', 'token.structure', 'security_type'],
  governing_documents: ['governing_documents', 'legal.governing_documents', 'offering.documents'],
  investor_restrictions: ['investor_restrictions', 'offering.investor_restrictions', 'investor.restrictions'],
  settlement_method: ['settlement_method', 'settlement.mode', 'transaction.settlement_method'],
};

function normalized(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_');
}

function findPreparationField(fields, candidates) {
  const candidateSet = new Set(candidates.map(normalized));
  return fields.find(field => {
    const values = [
      field?.field_key,
      field?.definition_key,
      field?.label,
      field?.field_id,
    ].map(normalized);
    return values.some(value => candidateSet.has(value));
  }) || null;
}

function preparationField(fieldKey, sourceField) {
  if (!sourceField) {
    return {
      field_key: fieldKey,
      value: null,
      status: 'not_recorded',
      source_field_key: null,
      provenance: null,
    };
  }
  return {
    field_key: fieldKey,
    value: clone(sourceField.value),
    status: sourceField.current_state || 'recorded',
    source_field_key: sourceField.field_key || sourceField.definition_key || null,
    provenance: clone(sourceField.provenance || null),
  };
}

function buildPreparationFields(fields) {
  return Object.fromEntries(
    Object.entries(PREPARATION_FIELD_MATCHERS).map(([fieldKey, candidates]) => [
      fieldKey,
      preparationField(fieldKey, findPreparationField(fields, candidates)),
    ]),
  );
}

function buildBlockerStatus(snapshot) {
  const readiness = snapshot?.digital_asset_readiness || {};
  const exceptions = readiness.exceptions || {};
  const approvals = readiness.approvals || {};
  const provenance = readiness.provenance || {};
  const lists = {
    incomplete_required_fields: Array.isArray(exceptions.incomplete_required_fields)
      ? exceptions.incomplete_required_fields
      : [],
    unresolved_conflicts: Array.isArray(exceptions.unresolved_conflicts)
      ? exceptions.unresolved_conflicts
      : [],
    missing_approvals: Array.isArray(approvals.missing) ? approvals.missing : [],
    provenance_gaps: Array.isArray(provenance.gaps) ? provenance.gaps : [],
  };
  return {
    blocking_count: Object.values(lists).reduce((count, list) => count + list.length, 0),
    resolved: Object.values(lists).every(list => list.length === 0),
    ...clone(lists),
    recorded_exceptions: clone(snapshot?.created_from?.exceptions || []),
  };
}

function buildDigitalAssetPreparationPackage({
  propertyId,
  snapshotRow,
  generatedAt = new Date().toISOString(),
} = {}) {
  if (!snapshotRow?.id || !snapshotRow.snapshot) {
    throw new Error('A persisted readiness snapshot is required.');
  }
  const snapshot = clone(snapshotRow.snapshot);
  const fields = canonicalFieldsFromSnapshot(snapshot);
  const readiness = snapshot.digital_asset_readiness || {};
  const recordedReadiness = snapshot.created_from?.readiness || {};
  const provenance = readiness.provenance || {};
  const approvals = readiness.approvals || {};
  const sourceSnapshot = {
    id: snapshotRow.id,
    version: snapshotRow.version,
    snapshot_hash: snapshotRow.snapshot_hash || snapshot.snapshot_hash || null,
    eligibility_status: snapshotRow.eligibility_status,
    recorded_at: snapshotRow.created_at || null,
    source_state_at: snapshotRow.source_state_at || snapshot.source_state_at || null,
  };
  const frozenCore = {
    source_snapshot: sourceSnapshot,
    canonical_fields: clone(fields),
    eligibility_status: snapshotRow.eligibility_status,
    eligible: readiness.eligible === true,
    status: readiness.status || null,
    snapshot_timestamp: snapshotRow.created_at || null,
    readiness: {
      confirmed_count: recordedReadiness.confirmed_count ?? 0,
      required_count: recordedReadiness.required_count ?? 0,
      awaiting_count: recordedReadiness.awaiting_count ?? 0,
      missing_count: recordedReadiness.missing_count ?? 0,
    },
    provenance_evidence: {
      intact: provenance.intact === true,
      gap_count: Array.isArray(provenance.gaps) ? provenance.gaps.length : 0,
      evidence_entry_count: Array.isArray(snapshot.created_from?.provenance_manifest)
        ? snapshot.created_from.provenance_manifest.length
        : 0,
      manifest: clone(snapshot.created_from?.provenance_manifest || []),
    },
    blockers_exceptions: buildBlockerStatus(snapshot),
    approvals: {
      satisfied: approvals.satisfied === true,
      missing_count: Array.isArray(approvals.missing) ? approvals.missing.length : 0,
      event_count: Array.isArray(snapshot.created_from?.approvals)
        ? snapshot.created_from.approvals.length
        : 0,
      manifest: clone(snapshot.created_from?.approvals || []),
    },
    settlement_mode: snapshot.created_from?.settlement_mode
      || readiness.settlement_method?.mode
      || null,
  };
  const packageHash = hashPackage(frozenCore);
  const missingPreparationFields = Object.values(buildPreparationFields(fields))
    .filter(field => field.status === 'not_recorded')
    .map(field => field.field_key);

  return {
    schema: PACKAGE_SCHEMA,
    package_version: PACKAGE_VERSION,
    package_type: 'digital_asset_preparation',
    package_hash: packageHash,
    package_status: missingPreparationFields.length > 0 ? 'needs_information' : 'inputs_captured',
    generated_at: generatedAt,
    source_snapshot: sourceSnapshot,
    frozen_readiness: frozenCore,
    preparation_fields: buildPreparationFields(fields),
    human_summary: {
      title: 'Digital Asset Preparation Package',
      headline: `Prepared from eligible readiness snapshot v${snapshotRow.version}`,
      readiness: `${frozenCore.readiness.confirmed_count} of ${frozenCore.readiness.required_count} canonical fields confirmed`,
      provenance: frozenCore.provenance_evidence.intact
        ? 'Provenance intact'
        : `${frozenCore.provenance_evidence.gap_count} provenance gaps recorded`,
      blockers: frozenCore.blockers_exceptions.resolved
        ? 'No unresolved blockers or exceptions'
        : `${frozenCore.blockers_exceptions.blocking_count} unresolved blocker or exception items`,
      approvals: frozenCore.approvals.satisfied
        ? 'Required approvals satisfied'
        : `${frozenCore.approvals.missing_count} required approvals missing`,
      missing_preparation_fields: missingPreparationFields,
      disclosure: 'Provider-neutral preparation data only. Kontra does not issue, sell, recommend, custody, perform KYC/AML, transfer, trade, or settle digital assets.',
    },
    // Keep the complete persisted snapshot projection inside the artifact. This
    // is intentionally a deep copy: package reads never consult live room state.
    frozen_snapshot: snapshot,
  };
}

function presentStoredDigitalAssetPackage(row) {
  if (!row) return null;
  return {
    id: row.id,
    property_id: row.property_id,
    source_snapshot_id: row.source_snapshot_id,
    source_snapshot_version: row.source_snapshot_version,
    source_snapshot_hash: row.source_snapshot_hash,
    package_hash: row.package_hash,
    created_by: row.created_by,
    created_at: row.created_at,
    package: clone(row.package || {}),
  };
}

function digitalAssetPackagesUnavailable(error) {
  const message = String(error?.message || '');
  return error?.code === '42P01'
    || error?.code === 'PGRST205'
    || /digital_asset_preparation_packages.*(?:does not exist|schema cache|not found)/i.test(message)
    || /(?:relation|table).*digital_asset_preparation_packages/i.test(message);
}

module.exports = {
  PACKAGE_SCHEMA,
  PACKAGE_VERSION,
  PREPARATION_FIELD_MATCHERS,
  buildDigitalAssetPreparationPackage,
  presentStoredDigitalAssetPackage,
  digitalAssetPackagesUnavailable,
  hashPackage,
};