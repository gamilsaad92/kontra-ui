'use strict';

const crypto = require('crypto');

const PACKAGE_SCHEMA = 'kontra.digital-asset-preparation-package';
const PACKAGE_VERSION = '1.0.0';

const PREPARATION_FIELD_DEFINITIONS = {
  issuer: {
    label: 'Issuer',
    guidance: 'Enter the organization that sponsors or would issue the prepared structure.',
    description: 'The organization sponsoring or issuing the prepared asset.',
    input_type: 'text',
    required: true,
    source_matchers: ['issuer', 'issuer_name', 'issuer.entity', 'sponsor'],
  },
  jurisdiction: {
    label: 'Jurisdiction',
    guidance: 'Choose the closest proposed legal or regulatory framework. Add the specific state, country, or counsel note when needed.',
    description: 'The governing jurisdiction to be reviewed by qualified counsel.',
    input_type: 'choice_with_detail',
    required: true,
    detail_label: 'Specific jurisdiction or counsel note',
    detail_placeholder: 'For example: Texas, United States',
    choices: [
      { value: 'us_reg_d', label: 'United States — Regulation D (counsel to confirm)' },
      { value: 'uae_adgm', label: 'UAE — ADGM / DFSA' },
      { value: 'eu_mica', label: 'European Union — MiCA' },
      { value: 'sg_mas', label: 'Singapore — MAS' },
      { value: 'uk_fca', label: 'United Kingdom — FCA' },
      { value: 'other', label: 'Other / not listed' },
    ],
    source_matchers: ['jurisdiction', 'legal.jurisdiction', 'transaction.jurisdiction'],
  },
  legal_entity: {
    label: 'Legal Entity',
    guidance: 'Enter the registered entity that owns, sponsors, or controls the underlying asset.',
    description: 'The legal entity that owns or sponsors the underlying asset.',
    input_type: 'text',
    required: true,
    source_matchers: ['legal_entity', 'legal.entity', 'ownership.entity', 'entity_name'],
  },
  underlying_asset: {
    label: 'Underlying Asset',
    guidance: 'Describe the property, claim, receivable, or other asset represented by this package.',
    description: 'The asset or interest represented by this preparation package.',
    input_type: 'textarea',
    required: true,
    source_matchers: ['underlying_asset', 'asset.name', 'asset.description', 'property_name'],
  },
  settlement_method: {
    label: 'Settlement Method',
    guidance: 'Choose the intended provider-neutral way value or ownership would be settled; this does not execute settlement.',
    description: 'The provider-neutral settlement method to be confirmed externally.',
    input_type: 'choice_with_detail',
    required: true,
    detail_label: 'Additional settlement note',
    detail_placeholder: 'Add a short note only if you chose Other',
    choices: [
      { value: 'traditional', label: 'Traditional institutional settlement' },
      { value: 'provider_review', label: 'Settlement method to be confirmed by provider' },
      { value: 'other', label: 'Other / not listed' },
    ],
    source_matchers: ['settlement_method', 'settlement.mode', 'transaction.settlement_method'],
  },
  ownership_evidence: {
    label: 'Ownership Evidence',
    guidance: 'Name the evidence that supports ownership or control, such as a deed, title record, or executed closing document.',
    description: 'Evidence supporting the ownership or control of the underlying asset.',
    input_type: 'textarea',
    required: true,
    source_matchers: ['ownership_evidence', 'ownership.proof', 'ownership.title'],
  },
  governing_documents: {
    label: 'Governing Documents',
    guidance: 'List the agreements or other documents that would govern the proposed structure and need professional review.',
    description: 'Documents that will govern the proposed structure.',
    input_type: 'textarea',
    required: true,
    source_matchers: ['governing_documents', 'legal.governing_documents', 'offering.documents'],
  },
  investor_restrictions: {
    label: 'Investor Restrictions',
    guidance: 'Select every known restriction. If none are known yet, choose “No restrictions identified” rather than leaving this blank.',
    description: 'Known investor, transfer, or participation restrictions for review.',
    input_type: 'multi_choice_with_detail',
    required: true,
    detail_label: 'Additional restriction detail',
    detail_placeholder: 'Add context for Other or explain the selected restrictions',
    choices: [
      { value: 'none_identified', label: 'No restrictions identified yet' },
      { value: 'qualified_investors', label: 'Qualified investors or purchasers' },
      { value: 'transfer_restrictions', label: 'Transfer restrictions apply' },
      { value: 'jurisdictional_restrictions', label: 'Jurisdictional restrictions apply' },
      { value: 'other', label: 'Other restriction' },
    ],
    source_matchers: ['investor_restrictions', 'offering.investor_restrictions', 'investor.restrictions'],
  },
  security_offering_structure: {
    label: 'Security Offering Structure',
    guidance: 'Choose the closest provider-neutral structure under review. This records preparation intent, not a legal classification.',
    description: 'The proposed provider-neutral security or participation structure.',
    input_type: 'choice_with_detail',
    required: true,
    detail_label: 'Structure detail',
    detail_placeholder: 'Add a short description only if you chose Other',
    choices: [
      { value: 'provider_neutral_participation', label: 'Provider-neutral participation interest' },
      { value: 'equity_interest', label: 'Equity interest' },
      { value: 'debt_interest', label: 'Debt interest' },
      { value: 'revenue_or_cash_flow_interest', label: 'Revenue or cash-flow interest' },
      { value: 'other', label: 'Other / not listed' },
    ],
    source_matchers: ['security_offering_structure', 'offering.structure', 'token.structure'],
  },
};

const REQUIRED_PREPARATION_FIELDS = Object.freeze(
  Object.entries(PREPARATION_FIELD_DEFINITIONS)
    .filter(([, definition]) => definition.required)
    .map(([key]) => key),
);

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

const PREPARATION_FIELD_MATCHERS = Object.freeze(
  Object.fromEntries(Object.entries(PREPARATION_FIELD_DEFINITIONS)
    .map(([key, definition]) => [key, definition.source_matchers || []])),
);

function normalized(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_');
}

function findPreparationField(fields, candidates) {
  const candidateSet = new Set(candidates.map(normalized));
  return fields.find(field => {
    const values = [
      field?.field_key,
      field?.definition_key,
      field?.field_id,
      field?.key,
      field?.persisted_key,
      field?.definition_key,
      field?.persistedKey,
      field?.definitionKey,
    ].map(normalized);
    return values.some(value => candidateSet.has(value));
  }) || null;
}

function sourceFieldValue(sourceField) {
  if (!sourceField || typeof sourceField !== 'object') return null;
  return sourceField.value ?? sourceField.value_text ?? sourceField.current_value ?? null;
}

function isTrustedSourceField(sourceField) {
  if (!sourceField || typeof sourceField !== 'object') return false;
  const status = normalized(sourceField.current_state || sourceField.status || sourceField.state);
  return sourceField.confirmation?.confirmed === true
    || ['confirmed', 'verified', 'approved'].includes(status);
}

function choiceForValue(definition, value) {
  const text = normalized(value);
  return (definition.choices || []).find(choice =>
    normalized(choice.value) === text || normalized(choice.label) === text,
  ) || null;
}

function normalizeChoiceWithDetail(value, definition, { strict = false } = {}) {
  if (value == null || (typeof value === 'string' && !value.trim())) return null;
  const raw = typeof value === 'object' && !Array.isArray(value)
    ? value
    : { choice: value, detail: '' };
  const selected = choiceForValue(definition, raw.choice);
  if (!selected) {
    if (typeof value === 'string' && value.trim()) {
      return { choice: 'other', detail: value.trim() };
    }
    throw new Error('Choose one of the supported options.');
  }
  const detail = String(raw.detail || raw.details || '').trim();
  if (selected.value === 'other' && strict && !detail) {
    throw new Error('Add a short detail when choosing Other.');
  }
  return { choice: selected.value, detail };
}

function normalizeMultiChoiceWithDetail(value, definition, { strict = false } = {}) {
  if (value == null || (typeof value === 'string' && !value.trim())) return null;
  if (typeof value === 'string') {
    const selected = choiceForValue(definition, value);
    return selected
      ? { choices: [selected.value], detail: '' }
      : { choices: ['other'], detail: value.trim() };
  }
  const raw = typeof value === 'object' && !Array.isArray(value)
    ? value
    : { choices: Array.isArray(value) ? value : [value], detail: '' };
  const rawChoices = Array.isArray(raw.choices) ? raw.choices : [];
  const choices = Array.from(new Set(rawChoices.map(choiceValue => {
    const selected = choiceForValue(definition, choiceValue);
    if (!selected) throw new Error('Choose only supported restriction options.');
    return selected.value;
  })));
  const detail = String(raw.detail || raw.details || '').trim();
  if (choices.includes('other') && strict && !detail) {
    throw new Error('Add a short detail when choosing Other.');
  }
  return choices.length > 0 ? { choices, detail } : null;
}

function normalizePreparationValueForField(fieldKey, value, options = {}) {
  const definition = PREPARATION_FIELD_DEFINITIONS[fieldKey] || {};
  if (definition.input_type === 'choice_with_detail') {
    return normalizeChoiceWithDetail(value, definition, options);
  }
  if (definition.input_type === 'multi_choice_with_detail') {
    return normalizeMultiChoiceWithDetail(value, definition, options);
  }
  if (value == null) return null;
  if (Array.isArray(value)) {
    const values = value.map(item => String(item ?? '').trim()).filter(Boolean);
    return values.length > 0 ? values : null;
  }
  if (typeof value === 'object') return clone(value);
  const text = String(value).trim();
  return text || null;
}

function hasPreparationValue(value) {
  if (Array.isArray(value)) return value.some(hasPreparationValue);
  if (value && typeof value === 'object') {
    if (value.choice) return value.choice !== 'other' || hasPreparationValue(value.detail);
    if (Array.isArray(value.choices)) {
      return value.choices.length > 0
        && (!value.choices.includes('other') || hasPreparationValue(value.detail));
    }
    return Object.keys(value).length > 0;
  }
  return String(value ?? '').trim().length > 0;
}

function preparationField(fieldKey, sourceField, inheritedValue = null) {
  const definition = PREPARATION_FIELD_DEFINITIONS[fieldKey] || {};
  const inherited = hasPreparationValue(inheritedValue);
  return {
    field_key: fieldKey,
    label: definition.label || fieldKey,
    description: definition.description || '',
    guidance: definition.guidance || definition.description || '',
    input_type: definition.input_type || 'text',
    choices: clone(definition.choices || []),
    detail_label: definition.detail_label || null,
    detail_placeholder: definition.detail_placeholder || null,
    value: inherited ? clone(inheritedValue) : null,
    status: inherited ? 'recorded' : 'not_recorded',
    origin: inherited ? 'inherited_source' : 'preparation_input',
    inherited,
    editable: true,
    required: definition.required === true,
    source_field_key: sourceField?.field_key || sourceField?.definition_key || sourceField?.key || null,
    source_provenance: clone(sourceField?.provenance || null),
    inherited_from: inherited
      ? {
        kind: sourceField?.source_kind || 'transaction_record',
        field_key: sourceField?.field_key || sourceField?.definition_key || sourceField?.key || null,
      }
      : null,
  };
}

function buildPreparationFields(fields, preparationValues = {}, {
  existingFields = {},
  explicitKeys = [],
  sourceContext = {},
} = {}) {
  const explicitKeySet = new Set(
    explicitKeys.length > 0 ? explicitKeys : Object.keys(preparationValues),
  );
  return Object.fromEntries(
    Object.entries(PREPARATION_FIELD_MATCHERS).map(([fieldKey, candidates]) => [
      fieldKey,
      (() => {
        const sourceField = findPreparationField(fields, candidates);
        const existingField = existingFields?.[fieldKey];
        const explicit = explicitKeySet.has(fieldKey);
        let value = null;
        let inheritedValue = null;
        let inheritedSource = sourceField;
        if (explicit) {
          value = normalizePreparationValueForField(fieldKey, preparationValues[fieldKey]);
        } else if (existingField && Object.prototype.hasOwnProperty.call(existingField, 'value')
          && hasPreparationValue(existingField.value)) {
          value = normalizePreparationValueForField(fieldKey, existingField.value);
        } else {
          const sourceValue = isTrustedSourceField(sourceField) ? sourceFieldValue(sourceField) : null;
          if (sourceValue != null) {
            inheritedValue = normalizePreparationValueForField(fieldKey, sourceValue);
          } else if (fieldKey === 'settlement_method' && sourceContext.settlement_mode) {
            inheritedValue = normalizePreparationValueForField(fieldKey, sourceContext.settlement_mode);
            inheritedSource = {
              source_kind: 'transaction_record_context',
              field_key: 'created_from.settlement_mode',
            };
          }
          value = inheritedValue;
        }
        const field = preparationField(fieldKey, value ? inheritedSource : null, value);
        if (!explicit && existingField && hasPreparationValue(existingField.value)) {
          field.origin = existingField.origin || 'preparation_input';
          field.inherited = existingField.inherited === true;
          field.inherited_from = clone(existingField.inherited_from || null);
          field.source_field_key = existingField.source_field_key || field.source_field_key;
          field.source_provenance = clone(existingField.source_provenance || field.source_provenance);
        }
        if (explicit && hasPreparationValue(value)) {
          field.origin = 'preparation_input';
          field.inherited = false;
          field.inherited_from = null;
        }
        return field;
      })(),
    ]),
  );
}

function extractPreparationValues(packagePayload) {
  return Object.fromEntries(
    Object.entries(packagePayload?.preparation_fields || {}).map(([key, field]) => [
      key,
      field?.value,
    ]),
  );
}

function preparationStatus(preparationFields, sourceSnapshot = {}) {
  const missingKeys = REQUIRED_PREPARATION_FIELDS.filter(key =>
    !hasPreparationValue(preparationFields?.[key]?.value),
  );
  const missingNames = missingKeys.map(key =>
    PREPARATION_FIELD_DEFINITIONS[key]?.label || key,
  );
  const sourceEligible = sourceSnapshot?.eligibility_status === 'eligible'
    && sourceSnapshot?.eligible === true;
  return {
    status: sourceEligible && missingKeys.length === 0
      ? 'ready_for_provider_review'
      : 'needs_information',
    missingKeys,
    missingNames,
  };
}

function buildPackageHashInput(packagePayload) {
  return {
    source_snapshot: packagePayload.source_snapshot,
    frozen_readiness: packagePayload.frozen_readiness,
    preparation_fields: packagePayload.preparation_fields,
  };
}

function updateDigitalAssetPreparationPackage({
  packagePayload,
  preparationValues = {},
  revision = 1,
  explicitKeys = [],
} = {}) {
  if (!packagePayload || typeof packagePayload !== 'object') {
    throw new Error('A stored Digital Asset Preparation Package is required.');
  }
  const next = clone(packagePayload);
  const canonicalFields = next.frozen_readiness?.canonical_fields
    || canonicalFieldsFromSnapshot(next.frozen_snapshot);
  const preparationFields = buildPreparationFields(canonicalFields, preparationValues, {
    existingFields: next.preparation_fields || {},
    explicitKeys,
    sourceContext: { settlement_mode: next.frozen_readiness?.settlement_mode },
  });
  const state = preparationStatus(preparationFields, {
    eligibility_status: next.source_snapshot?.eligibility_status,
    eligible: next.frozen_readiness?.eligible === true,
  });
  next.package_revision = revision;
  next.preparation_fields = preparationFields;
  next.package_status = state.status;
  next.package_hash = hashPackage(buildPackageHashInput(next));
  next.human_summary = {
    ...(next.human_summary || {}),
    missing_preparation_fields: state.missingKeys,
    missing_preparation_field_names: state.missingNames,
    preparation_status: state.status,
  };
  return next;
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
  const preparationFields = buildPreparationFields(fields, {}, {
    sourceContext: { settlement_mode: sourceSnapshot.settlement_mode || frozenCore.settlement_mode },
  });
  const preparationState = preparationStatus(preparationFields, {
    eligibility_status: snapshotRow.eligibility_status,
    eligible: readiness.eligible === true,
  });
  const packageHash = hashPackage(frozenCore);

  return {
    schema: PACKAGE_SCHEMA,
    package_version: PACKAGE_VERSION,
    package_type: 'digital_asset_preparation',
    package_revision: 0,
    package_hash: packageHash,
    package_status: preparationState.status,
    generated_at: generatedAt,
    source_snapshot: sourceSnapshot,
    frozen_readiness: frozenCore,
    preparation_fields: preparationFields,
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
      missing_preparation_fields: preparationState.missingKeys,
      missing_preparation_field_names: preparationState.missingNames,
      disclosure: 'Provider-neutral preparation data only. Kontra does not issue, sell, recommend, custody, perform KYC/AML, transfer, trade, or settle digital assets.',
    },
    // Keep the complete persisted snapshot projection inside the artifact. This
    // is intentionally a deep copy: package reads never consult live room state.
    frozen_snapshot: snapshot,
  };
}

function presentStoredDigitalAssetPackage(row) {
  if (!row) return null;
  const packagePayload = clone(row.package || {});
  const revision = Number(row.revision ?? packagePayload.package_revision ?? 0);
  if (revision === 0) {
    const canonicalFields = packagePayload.frozen_readiness?.canonical_fields
      || canonicalFieldsFromSnapshot(packagePayload.frozen_snapshot);
    const existingFields = Object.fromEntries(
      Object.entries(packagePayload.preparation_fields || {})
        .filter(([, field]) => hasPreparationValue(field?.value)),
    );
    packagePayload.preparation_fields = buildPreparationFields(canonicalFields, {}, {
      existingFields,
      sourceContext: { settlement_mode: packagePayload.frozen_readiness?.settlement_mode },
    });
    const state = preparationStatus(packagePayload.preparation_fields, {
      eligibility_status: packagePayload.source_snapshot?.eligibility_status,
      eligible: packagePayload.frozen_readiness?.eligible === true,
    });
    packagePayload.human_summary = {
      ...(packagePayload.human_summary || {}),
      missing_preparation_fields: state.missingKeys,
      missing_preparation_field_names: state.missingNames,
      preparation_status: state.status,
    };
    packagePayload.package_status = state.status;
  }
  return {
    id: row.id,
    property_id: row.property_id,
    source_snapshot_id: row.source_snapshot_id,
    source_snapshot_version: row.source_snapshot_version,
    source_snapshot_hash: row.source_snapshot_hash,
    package_hash: row.package_hash,
    created_by: row.created_by,
    created_at: row.created_at,
    revision,
    revision_id: row.revision_id || null,
    package: packagePayload,
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
  PREPARATION_FIELD_DEFINITIONS,
  REQUIRED_PREPARATION_FIELDS,
  PREPARATION_FIELD_MATCHERS,
  buildDigitalAssetPreparationPackage,
  buildPackageHashInput,
  buildPreparationFields,
  extractPreparationValues,
  normalizePreparationValueForField,
  hasPreparationValue,
  preparationStatus,
  updateDigitalAssetPreparationPackage,
  presentStoredDigitalAssetPackage,
  digitalAssetPackagesUnavailable,
  hashPackage,
};