'use strict';

const tokenizationRequirements = require('../../shared/transaction_record_requirements.json').tokenization || [];

const TOKENIZATION_INPUT_LABELS = {
  'transaction.type': 'Transaction type',
  'transaction.stage': 'Transaction stage',
  'transaction.closing_date': 'Target close date',
  'transaction.jurisdiction': 'Proposed jurisdiction',
  'transaction.target_raise': 'Target raise',
  'transaction.instrument_type': 'Token / instrument type',
  'asset.name': 'Underlying asset name',
  'asset.type': 'Asset type',
  'asset.ownership_entity': 'Ownership entity',
  'parties.issuer': 'Issuer',
  'parties.counsel': 'Legal counsel',
  'ownership.beneficial_owners': 'Beneficial owners',
  'ownership.cap_table': 'Existing cap table',
  'ownership.aml_kyc': 'AML / KYC status',
  'financial.asset_valuation': 'Asset valuation',
  'financial.use_of_proceeds': 'Use of proceeds',
  'legal.exemption': 'Legal exemption input',
  'legal.offering_docs': 'Offering documents status',
  'legal.legal_opinion': 'Legal opinion',
  'approval.legal': 'Legal counsel sign-off',
  'approval.compliance': 'Compliance review',
};

// These are factual aliases, not alternate regulatory conclusions. They let a
// tokenization question use the Transaction Record already collected by a
// CRE, business acquisition, or fundraising pack without treating the facts as
// more complete than they are.
const TOKENIZATION_INPUT_ALIASES = {
  'transaction.target_raise': ['financial.target_raise'],
  'transaction.instrument_type': ['financial.instrument', 'transaction.instrument'],
  'asset.name': ['asset.legal_name', 'asset.issuer'],
  'asset.ownership_entity': ['ownership.acquiring_entity'],
  'parties.issuer': ['asset.issuer'],
  'ownership.beneficial_owners': ['ownership.existing_owners', 'ownership.founders'],
  'ownership.cap_table': ['ownership.pre_money_cap_table'],
  'financial.asset_valuation': ['financial.pre_money_val', 'financial.deal_value', 'transaction.purchase_price'],
  'legal.exemption': ['legal.securities_exemption'],
};

const EMPTY_VALUES = new Set(['', 'n/a', 'na', 'not applicable', 'not_applicable', 'unknown']);

function isTokenizationQuestion(question) {
  return /\btokeniz\w*|\btokens?\b|\bdigital[- ]asset\w*|\bsecurity[- ]token\w*|\btoken[- ]offering\w*|\btoken[- ]issuance\w*|\brwa\b|\breal[- ]world asset\w*|\bfractionali\w*/i.test(String(question || ''));
}

function normalizeStateFields({ transactionContext = null, recordState = null, recordFields = [] } = {}) {
  const contextFields = transactionContext?.record?.state?.fields;
  const stateFields = Array.isArray(contextFields)
    ? contextFields
    : Array.isArray(recordState?.fields)
      ? recordState.fields
      : Array.isArray(recordFields)
        ? recordFields
        : [];

  return stateFields.map(field => ({
    key: field.key || field.field_key,
    label: field.label || field.display_label || field.key || field.field_key,
    value: field.value ?? field.value_text ?? field.value_json ?? null,
    status: String(field.status || '').toLowerCase(),
    attention: field.attention || null,
  })).filter(field => field.key);
}

function hasMeaningfulValue(field) {
  const value = String(field?.value ?? '').trim().toLowerCase();
  return value && !EMPTY_VALUES.has(value) && field?.status !== 'not_applicable';
}

function buildTokenizationGuidance({
  transactionContext = null,
  recordState = null,
  recordFields = [],
  enabled = null,
} = {}) {
  const transaction = transactionContext?.transaction || {};
  const contextEnabled = transaction.digitalAssetEnabled
    ?? transaction.tokenizationEnabled
    ?? transactionContext?.digitalAssetEnabled;
  const tokenizationEnabled = enabled == null ? !!contextEnabled : !!enabled;
  const fields = normalizeStateFields({ transactionContext, recordState, recordFields });
  const fieldsByKey = new Map();
  fields.forEach(field => {
    if (!fieldsByKey.has(field.key)) fieldsByKey.set(field.key, field);
  });

  const getField = key => {
    const candidateKeys = [key, ...(TOKENIZATION_INPUT_ALIASES[key] || [])];
    return candidateKeys
      .map(candidate => fieldsByKey.get(candidate))
      .find(Boolean) || null;
  };

  const known = [];
  const gaps = [];
  const conflicts = [];
  const awaiting = [];

  tokenizationRequirements.forEach(key => {
    const field = getField(key);
    const label = TOKENIZATION_INPUT_LABELS[key] || key;
    if (!field || !hasMeaningfulValue(field)) {
      gaps.push({
        key,
        label,
        reason: field?.status === 'not_applicable'
          ? 'Marked not applicable in the Transaction Record'
          : 'Not recorded in the Transaction Record',
        status: field?.status || 'missing',
      });
      return;
    }

    const isConflict = field.status === 'conflict'
      || field.status === 'conflicting'
      || field.status === 'source_changed'
      || field.attention === 'source_changed';
    const isAwaiting = ['awaiting', 'awaiting_confirmation', 'extracted', 'needs_review'].includes(field.status);
    known.push({ key, label, value: String(field.value), status: field.status || 'captured' });
    if (isConflict) {
      conflicts.push({ key, label, value: String(field.value), reason: 'Conflicting or changed source needs coordinator review' });
      gaps.push({ key, label, reason: 'Conflicting or changed source needs coordinator review', status: 'conflict' });
    } else if (isAwaiting) {
      awaiting.push({ key, label, value: String(field.value) });
      gaps.push({ key, label, reason: 'Captured but awaiting confirmation', status: 'awaiting' });
    }
  });

  return {
    optional: true,
    enabled: tokenizationEnabled,
    stateSource: 'transactionContext.record.state',
    transaction: {
      propertyName: transaction.propertyName || null,
      dealType: transaction.dealType || null,
      workflowPack: transaction.workflowPack || null,
      stage: transaction.stageLabel || transaction.stage || null,
      jurisdiction: transaction.jurisdiction || null,
      digitalAssetEnabled: tokenizationEnabled,
    },
    known,
    gaps,
    conflicts,
    awaiting,
    inputCount: tokenizationRequirements.length,
    capturedInputCount: known.length,
    complete: gaps.length === 0,
  };
}

function buildTokenizationPrompt(guidance) {
  return `TOKENIZATION / DIGITAL-ASSET QUESTION RULES:
Tokenization is optional. Kontra coordinates and prepares information for external professional or provider review; it does not issue, sell, recommend, custody, settle, approve, or determine legal/regulatory eligibility.

Answer in this order:
1. Transaction state first: use transaction_context.transaction and transaction_context.record.state / facts. Start with the specific values, statuses, conflicts, and stage actually present.
2. Tokenization-specific gaps second: use tokenization_guidance.gaps below. Say what is missing, awaiting confirmation, or needs coordinator/professional review. Do not turn a workspace gap into a legal conclusion.
3. Generic education last: only if useful, label it as general education and clearly separate it from this workspace's facts.

Never claim the workspace is "ready", "tokenization-ready", "issuance-ready", "compliant", "approved", "eligible", or "cleared" unless the user is explicitly asking about a non-tokenization status. For tokenization questions, describe preparation as incomplete, captured, awaiting review, or prepared for external review. Do not infer an exemption, security status, approval, investor suitability, or regulatory outcome.

tokenization_guidance:
${JSON.stringify(guidance, null, 2)}`;
}

function buildTokenizationAnswerPrefix(guidance) {
  const transaction = guidance?.transaction || {};
  const context = [
    transaction.propertyName && `workspace ${transaction.propertyName}`,
    transaction.dealType && `deal type ${transaction.dealType}`,
    transaction.stage && `stage ${transaction.stage}`,
    transaction.jurisdiction && `proposed jurisdiction ${transaction.jurisdiction}`,
    `digital-asset preparation ${transaction.digitalAssetEnabled ? 'enabled' : 'optional and not enabled'}`,
  ].filter(Boolean);
  const facts = (guidance?.known || []).slice(0, 5).map(item => {
    const status = item.status && !['confirmed', 'verified', 'captured'].includes(item.status)
      ? ` (${item.status})`
      : '';
    return `${item.label}: ${String(item.value).slice(0, 100)}${status}`;
  });
  const gaps = (guidance?.gaps || []).slice(0, 5).map(item => item.label);
  const gapSummary = guidance?.gaps?.length
    ? `${guidance.gaps.length} tokenization-specific input${guidance.gaps.length === 1 ? '' : 's'} still need to be captured, confirmed, or reviewed${gaps.length ? `, including ${gaps.join(', ')}` : ''}.`
    : 'All listed tokenization-specific inputs are captured; external professional and provider review still remains separate from this workspace.';

  return [
    `Transaction Record first: ${context.length ? context.join('; ') : 'no transaction identity or stage is currently recorded'}.`,
    facts.length ? `Recorded facts include ${facts.join('; ')}.` : 'No tokenization-specific facts are currently captured in the Transaction Record.',
    `Digital-asset preparation is optional. ${gapSummary}`,
  ].join(' ');
}

function buildFixtureTransactionContext(fixture) {
  const property = fixture?.property || {};
  const state = fixture?.record?.record_state || {};
  const fields = Array.isArray(state.fields) ? state.fields : (fixture?.record?.fields || []);
  return {
    transaction: {
      propertyId: property.property_id || property.id || null,
      propertyName: property.property_name || property.name || null,
      dealType: property.deal_type || property.workflow_pack_id || null,
      workflowPack: property.workflow_pack_id || fixture?.packId || null,
      stage: property.deal_stage || null,
      stageLabel: property.deal_stage || null,
      jurisdiction: property.jurisdiction || null,
      digitalAssetEnabled: property.metadata_values?.digital_asset_enabled === true
        || property.metadata_values?.digital_asset_enabled === 'true'
        || property.workflow_pack_id === 'tokenization',
    },
    record: {
      state: { schema: state.schema || fixture?.packId || null, fields },
      facts: fields.filter(hasMeaningfulValue),
    },
  };
}

module.exports = {
  TOKENIZATION_INPUT_LABELS,
  TOKENIZATION_INPUT_ALIASES,
  isTokenizationQuestion,
  buildTokenizationGuidance,
  buildTokenizationPrompt,
  buildTokenizationAnswerPrefix,
  buildFixtureTransactionContext,
};