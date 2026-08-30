'use strict';

const crypto = require('crypto');
const { semanticRecordKey } = require('./semanticFieldTaxonomy');

const SOURCE_TYPES = new Set([
  'authoritative',
  'uploaded',
  'transaction_description',
  'template',
  'ai_recommendation',
]);

const PROPOSAL_VERSION = '1';

function slug(value, fallback = 'item') {
  const result = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 64);
  return result || fallback;
}

function confidence(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(0, Math.min(1, numeric)) : 0.35;
}

function normalizeSource(source = {}) {
  const sourceType = String(source.source_type || source.sourceType || 'ai_recommendation').toLowerCase();
  return {
    source_type: SOURCE_TYPES.has(sourceType) ? sourceType : 'ai_recommendation',
    source_title: String(source.source_title || source.sourceTitle || '').trim().slice(0, 200) || null,
    source_url: source.source_url || source.sourceUrl || null,
    source_excerpt: String(source.source_excerpt || source.sourceExcerpt || '').trim().slice(0, 1000) || null,
  };
}

function extractTransactionContext(description = '') {
  const text = String(description || '').trim();
  const facts = [];
  const add = (key, label, value, confidenceValue = 0.9) => {
    if (value !== null && value !== undefined && String(value).trim()) {
      facts.push({ key, label, value: String(value).trim().slice(0, 500), confidence: confidenceValue });
    }
  };
  if (/freddie\s*mac/i.test(text)) add('organization.investor_or_agency', 'Investor / agency', 'Freddie Mac');
  if (/\bcbre\b/i.test(text)) add('organization.broker', 'Broker', 'CBRE');
  const units = text.match(/(\d[\d,]*)\s*[-\s]*(?:affected\s+)?units?\b/i);
  if (units) {
    const affected = /\baffected\s+units?\b/i.test(text);
    add(
      affected ? 'asset.units_affected' : 'asset.unit_count',
      affected ? 'Units affected' : 'Unit count',
      units[1].replace(/,/g, ''),
    );
  }
  // "Approximately $2.5M" is not borrower cash unless the sentence also
  // identifies an advance. Do not turn policy limits, repair estimates, or
  // other nearby amounts into borrower_funds_advanced.
  const advanced = text.match(/\bborrower(?:'s|s)?\b[^.;\n]{0,80}\b(?:advanced|advance|out\s+of\s+pocket)\b[^$0-9]{0,30}\$?\s*([\d,]+(?:\.\d+)?)\s*(m|million|k|thousand)?/i)
    || text.match(/\$?\s*([\d,]+(?:\.\d+)?)\s*(m|million|k|thousand)?\s+(?:in\s+)?(?:borrower(?:'s|s)?\s+)?funds?\s+(?:already\s+)?advanced\b/i);
  if (advanced) {
    const multiplier = /million/i.test(advanced[2] || '') || advanced[2]?.toLowerCase() === 'm' ? 1000000
      : /thousand/i.test(advanced[2] || '') || advanced[2]?.toLowerCase() === 'k' ? 1000 : 1;
    add('financial.borrower_funds_advanced', 'Borrower funds advanced', String(Number(advanced[1].replace(/,/g, '')) * multiplier));
  }
  if (/\bmultifamily\b/i.test(text)) add('transaction.property_type', 'Property type', 'Multifamily');
  if (/\b(hazard\s+loss|casualty)\b/i.test(text)) add('transaction.loss_type', 'Loss type', /casualty/i.test(text) ? 'Casualty / hazard loss' : 'Hazard loss');
  if (/\bfire\b/i.test(text)) add('transaction.loss_event', 'Loss event', 'Fire');
  if (/claim\s+(?:has\s+been\s+)?acknowledged|acknowledged\s+the\s+claim/i.test(text)) add('insurance.claim_status', 'Insurance claim status', 'Acknowledged');
  if (/proceeds.*(?:held|controlled).*servicer|servicer.*(?:held|controlled).*proceeds/i.test(text)) {
    add('insurance.proceeds_control', 'Insurance proceeds control', 'Held or controlled by servicer');
  }
  if (/repairs?\s+(?:are\s+)?(?:currently\s+)?underway|repairs?\s+in\s+progress/i.test(text)) add('repairs.status', 'Repair status', 'In progress');
  if (/reimbursement|additional repair proceeds|funds can be released/i.test(text)) {
    add('funding.request', 'Funding request', 'Reimbursement and/or additional repair proceeds');
  }
  return facts;
}

/**
 * Keep the generated transaction identity separate from the compatibility
 * workflow pack. A generic/custom request can be rendered with a structural
 * pack, but that must not relabel the user's actual transaction.
 */
function inferGeneratedTransactionIdentity({
  description = '',
  selectedType = '',
  generatedType = '',
  generatedLabel = '',
} = {}) {
  const selected = String(selectedType || '').trim().toLowerCase();
  const generated = String(generatedType || '').trim().toLowerCase();
  const text = String(description || '').toLowerCase();
  const isSellerOriented = /\b(marketed|listed|offered|sale|selling|seller|on behalf of the seller|seller[-\s]side)\b/.test(text);
  const isBuyerOriented = /\b(acquir(?:e|er|ing)|purchasing|purchase of|buyer[-\s]side|on behalf of the buyer)\b/.test(text);

  // An owner-selected type is authoritative. "other" deliberately leaves
  // room for the description to establish a more specific identity.
  if (selected && selected !== 'other') {
    return {
      type: selected,
      label: String(generatedLabel || selected).trim(),
      subtype: selected === 'cre_acquisition' && isSellerOriented && !isBuyerOriented
        ? 'Asset Sale'
        : null,
    };
  }

  const isLossReview = /\b(hazard\s+loss|casualty\s+loss|casualty)\b/.test(text)
    && /\b(insurance\s+proceeds?|proceeds?|claim)\b/.test(text)
    && /\b(repair|reimbursement|disburse(?:ment)?|release)\b/.test(text);
  if (isLossReview) {
    return {
      type: 'hazard_loss_proceeds_review',
      label: 'Hazard-Loss Insurance Proceeds Review',
      subtype: 'Insurance proceeds disbursement and repair review',
    };
  }

  return {
    type: generated || selected || 'other',
    label: String(generatedLabel || generated || selected || 'Custom Transaction').trim(),
    subtype: null,
  };
}

function contextFields(facts = []) {
  return facts.map(fact => ({
    key: fact.key,
    label: fact.label,
    value: fact.value,
    required: false,
    confidence: confidence(fact.confidence),
    rationale: 'Extracted from the creator-provided transaction description.',
    source_type: 'transaction_description',
  }));
}

function normalizeProposal(raw = {}, context = {}) {
  const transactionType = String(
    raw.transaction?.category
      || raw.transaction?.type
      || raw.transactionType
      || context.transactionType
      || 'other',
  ).trim().toLowerCase();
  const stages = (Array.isArray(raw.stages) ? raw.stages : []).map((stage, index) => ({
    key: slug(stage.key || stage.name, `stage_${index + 1}`),
    name: String(stage.name || stage.label || `Stage ${index + 1}`).trim().slice(0, 120),
    description: String(stage.description || '').trim().slice(0, 500),
    position: Number(stage.position) || index + 1,
    rationale: String(stage.rationale || '').trim().slice(0, 500),
    source_type: normalizeSource(stage).source_type,
  }));
  const participants = (Array.isArray(raw.participants) ? raw.participants : (raw.roles || [])).map((role, index) => ({
    role: slug(role.role || role.key || role.label, `role_${index + 1}`),
    label: String(role.label || role.name || role.key || `Participant ${index + 1}`).trim().slice(0, 120),
    required: role.required !== false,
    rationale: String(role.rationale || '').trim().slice(0, 500),
    source_type: normalizeSource(role).source_type,
  }));
  const requirements = (Array.isArray(raw.requirements) ? raw.requirements : (raw.documents || [])).map((item, index) => {
    const key = slug(item.key || item.id || item.label, `requirement_${index + 1}`);
    const source = normalizeSource(item);
    return {
      key,
      title: String(item.title || item.label || item.name || `Requirement ${index + 1}`).trim().slice(0, 160),
      description: String(item.description || '').trim().slice(0, 600),
      stage_key: slug(item.stage_key || item.stageKey || stages[0]?.key, stages[0]?.key || 'initial_review'),
      type: ['document', 'data', 'approval', 'task', 'confirmation'].includes(item.type) ? item.type : 'document',
      required: item.required !== false,
      responsible_role: slug(item.responsible_role || item.responsibleRole || item.assignedRole || item.assigned_to?.[0], 'coordinator'),
      rationale: String(item.rationale || '').trim().slice(0, 600),
      confidence: confidence(item.confidence),
      ...source,
    };
  });
  const modelTransactionRecordFields = (Array.isArray(raw.transaction_record_fields)
    ? raw.transaction_record_fields
    : []).map((field, index) => ({
    key: semanticRecordKey(
      String(field.key || field.field_key || `transaction.field_${index + 1}`).trim(),
      field.label || field.display_label || '',
    ) || String(field.key || field.field_key || `transaction.field_${index + 1}`).trim().slice(0, 120),
    label: String(field.label || field.display_label || field.key || `Transaction field ${index + 1}`).trim().slice(0, 160),
    category: String(field.category || field.field_category || String(field.key || '').split('.')[0] || 'transaction')
      .trim().toLowerCase().replace(/[^a-z0-9_]+/g, '_').slice(0, 80) || 'transaction',
    value: field.value ?? field.value_text ?? null,
    required: field.required !== false,
    confidence: confidence(field.confidence),
    rationale: String(field.rationale || '').trim().slice(0, 500),
    ...normalizeSource(field),
  }));
  const contextTransactionFields = contextFields(context.contextFacts || []);
  const transactionRecordFields = [...modelTransactionRecordFields];
  const modelFieldKeys = new Set(transactionRecordFields.map(field => field.key));
  for (const field of contextTransactionFields) {
    if (field.key === 'asset.unit_count' && transactionRecordFields.some(item =>
      /\bunit(?:s)?\b/i.test(`${item.key} ${item.label}`),
    )) continue;
    if (!modelFieldKeys.has(field.key)) transactionRecordFields.push(field);
  }
  const issues = (Array.isArray(raw.issues_to_confirm) ? raw.issues_to_confirm : (Array.isArray(raw.questions) ? raw.questions : []))
    .map(item => ({
      question: String(item.question || '').trim().slice(0, 500),
      reason: String(item.reason || '').trim().slice(0, 500),
    }))
    .filter(item => item.question);

  return {
    proposal_version: PROPOSAL_VERSION,
    transaction: {
      title: String(raw.transaction?.title || raw.name || context.transactionTitle || 'Untitled transaction').trim().slice(0, 200),
      category: transactionType,
      subtype: String(raw.transaction?.subtype || raw.transactionStructure || '').trim().slice(0, 120) || null,
      description: String(raw.transaction?.description || context.description || '').trim().slice(0, 4000),
      jurisdiction: {
        country: String(raw.transaction?.jurisdiction?.country || '').trim().slice(0, 80) || null,
        state: String(raw.transaction?.jurisdiction?.state || context.jurisdiction || '').trim().slice(0, 80) || null,
        locality: String(raw.transaction?.jurisdiction?.locality || '').trim().slice(0, 120) || null,
      },
      organizations: Array.isArray(raw.transaction?.organizations)
        ? raw.transaction.organizations.map(value => String(value).trim()).filter(Boolean).slice(0, 20)
        : [],
      financing_type: raw.transaction?.financing_type || raw.financing_type || null,
      investor_or_agency: raw.transaction?.investor_or_agency || raw.investor_or_agency || null,
      confidence: confidence(raw.transaction?.confidence ?? raw.confidence),
      context_facts: Array.isArray(raw.transaction?.context_facts)
        ? raw.transaction.context_facts.slice(0, 50)
        : (Array.isArray(context.contextFacts) ? context.contextFacts : []),
    },
    summary: String(raw.summary || '').trim().slice(0, 2000),
    stages,
    requirements,
    participants,
    issues_to_confirm: issues,
    transaction_record_fields: transactionRecordFields,
    research_sources: Array.isArray(raw.research_sources)
      ? raw.research_sources.map(normalizeSource).slice(0, 50)
      : [],
    legacy_config: {
      roles: Array.isArray(raw.roles) ? raw.roles : participants.map(participant => ({
        key: participant.role,
        label: participant.label,
        required: participant.required,
      })),
      documents: Array.isArray(raw.documents) ? raw.documents : requirements
        .filter(item => item.type === 'document')
        .map(item => ({
          id: item.key,
          label: item.title,
          required: item.required,
          ai: item.source_type === 'ai_recommendation',
          assignedRole: item.responsible_role,
        })),
      stages: stages.map(stage => ({ key: stage.key, label: stage.name })),
    },
  };
}

function validateProposal(proposal) {
  const errors = [];
  if (!proposal || typeof proposal !== 'object') errors.push('Proposal must be an object');
  if (!proposal?.transaction?.title) errors.push('Transaction title is required');
  if (!proposal?.transaction?.category) errors.push('Transaction category is required');
  if (!Array.isArray(proposal?.stages) || proposal.stages.length < 2) errors.push('At least two stages are required');
  if (!Array.isArray(proposal?.participants) || proposal.participants.length < 1) errors.push('At least one participant is required');
  const stageKeys = new Set();
  for (const stage of proposal?.stages || []) {
    if (!stage.key || !stage.name) errors.push('Every stage needs a key and name');
    if (stageKeys.has(stage.key)) errors.push(`Duplicate stage key: ${stage.key}`);
    stageKeys.add(stage.key);
  }
  const requirementKeys = new Set();
  const roleKeys = new Set((proposal?.participants || []).map(role => role.role));
  for (const item of proposal?.requirements || []) {
    if (!item.key || !item.title) errors.push('Every requirement needs a key and title');
    if (requirementKeys.has(item.key)) errors.push(`Duplicate requirement key: ${item.key}`);
    requirementKeys.add(item.key);
    if (!SOURCE_TYPES.has(item.source_type)) errors.push(`Invalid source type for ${item.key}`);
    if (!stageKeys.has(item.stage_key)) errors.push(`Requirement ${item.key} references an unknown stage`);
    if (!roleKeys.has(item.responsible_role) && item.responsible_role !== 'coordinator') {
      errors.push(`Requirement ${item.key} references an unknown responsible role`);
    }
    if (item.source_type === 'authoritative' && !item.source_title) {
      errors.push(`Authoritative requirement ${item.key} needs a source title`);
    }
    if (item.source_url && !/^https?:\/\//i.test(item.source_url)) {
      errors.push(`Invalid source URL for ${item.key}`);
    }
  }
  for (const field of proposal?.transaction_record_fields || []) {
    if (!field.key || !field.label) errors.push('Every Transaction Record field needs a key and label');
    if (!SOURCE_TYPES.has(field.source_type)) errors.push(`Invalid source type for ${field.key}`);
  }
  return { ok: errors.length === 0, errors: [...new Set(errors)].slice(0, 50) };
}

function buildLegacyProposal(raw, context = {}) {
  const contextFacts = Array.isArray(context.contextFacts)
    ? context.contextFacts
    : extractTransactionContext(context.description);
  return normalizeProposal({
    ...raw,
    transaction: {
      title: raw.name,
      category: raw.transactionType,
      subtype: raw.transactionStructure,
      description: context.description,
      confidence: raw.transactionValueConfidence === 'high' ? 0.8 : 0.55,
      context_facts: contextFacts,
    },
    summary: 'AI-generated starting point. Review every participant, stage, requirement, and assumption with qualified advisers.',
    participants: (raw.roles || []).map(role => ({
      role: role.key,
      label: role.label,
      required: role.required,
      rationale: 'Suggested from the transaction description.',
    })),
    requirements: (raw.documents || []).map(document => ({
      key: document.id,
      title: document.label,
      stage_key: raw.stages?.[0]?.key,
      type: 'document',
      required: document.required,
      responsible_role: document.assignedRole,
      source_type: 'ai_recommendation',
      rationale: 'Suggested from the transaction description; verify before relying on it.',
      confidence: document.required ? 0.65 : 0.45,
    })),
    issues_to_confirm: [
      { question: 'Which transaction facts or requirements are still uncertain?', reason: 'AI suggestions are not a substitute for transaction-specific professional review.' },
    ],
    transaction_record_fields: Array.isArray(raw.transaction_record_fields)
      ? raw.transaction_record_fields
      : contextFields(contextFacts),
  }, { ...context, contextFacts });
}

function createGenerationId() {
  return crypto.randomUUID();
}

module.exports = {
  PROPOSAL_VERSION,
  SOURCE_TYPES,
  extractTransactionContext,
  inferGeneratedTransactionIdentity,
  normalizeProposal,
  buildLegacyProposal,
  validateProposal,
  createGenerationId,
};