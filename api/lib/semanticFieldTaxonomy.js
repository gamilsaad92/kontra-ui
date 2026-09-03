'use strict';

const THRESHOLD_WORDS = /\b(trigger|threshold|limit|maximum|max|min(?:imum)?|cap|must\s+not\s+exceed|at\s+least|no\s+more\s+than|no\s+less\s+than)\b/i;
const ACTUAL_WORDS = /\b(actual|current|reported|observed|measured|as\s+of|is|was|were)\b/i;

// These identities describe facts, not document-specific labels. Keep the
// narrow fields before broader patterns so "servicing fee rate" never lands in
// the generic fee/amount bucket.
const SEMANTIC_FIELD_DEFINITIONS = [
  { key: 'financial.reporting_period', pattern: /\b(?:reporting|statement|coverage|period)\s+(?:period|covered|ending|ended|of)|\b(?:month|quarter|year)\s+ended\b|\b(?:monthly|quarterly|annually|annual)\b/i, type: 'period', recordKey: 'financial.reporting_period' },
  { key: 'financial.outstanding_principal', pattern: /\b(?:certified\s+)?outstanding\s+(?:loan\s+)?principal\b|\bprincipal\s+balance\b|\bunpaid\s+principal\s+balance\b|\bupb\b/i, type: 'amount', recordKey: 'financial.outstanding_principal' },
  { key: 'financial.servicing_fee_rate', pattern: /\bservicing[_\s-]+fee\b.{0,24}\b(?:rate|percentage|percent)\b|\b(?:rate|percentage|percent)\b.{0,24}\bservicing[_\s-]+fee\b|\bservicing[_\s-]+fee[_\s-]+rate\b/i, type: 'percent', recordKey: 'financial.servicing_fee_rate' },
  { key: 'financial.servicing_fee_rate', pattern: /\bservicing[_\s-]+fee\b.{0,24}%/i, type: 'percent', recordKey: 'financial.servicing_fee_rate' },
  { key: 'financial.servicing_fee_amount', pattern: /\bservicing[_\s-]+fee\b.{0,24}\b(?:amount|charge|paid|dollars?)\b|\b(?:amount|charge|paid|dollars?)\b.{0,24}\bservicing[_\s-]+fee\b|\bservicing[_\s-]+fee[_\s-]+amount\b/i, type: 'amount', recordKey: 'financial.servicing_fee_amount' },
  { key: 'financial.servicing_fee_amount', pattern: /\bservicing[_\s-]+fee\b/i, type: 'amount', recordKey: 'financial.servicing_fee_amount' },
  { key: 'transaction.loan_number', pattern: /\b(?:loan|servicing|mortgage)\s+(?:number|no\.?|id|identifier)\b|\bloan[_\s-]+number\b/i, type: 'reference', recordKey: 'transaction.loan_number' },
  { key: 'legal.document_reference', pattern: /\b(?:document|source|file)\s+(?:reference|number|no\.?|id|identifier)\b|\b(?:reference|references)\b/i, type: 'reference', recordKey: 'legal.document_reference', comparisonMode: 'none' },
  { key: 'capital.commitment', pattern: /\b(?:total\s+)?(?:loan\s+)?commitment\b|\bcommitted\s+(?:amount|balance)\b/i, type: 'amount', recordKey: 'financial.commitment' },
  { key: 'financial.policy_limit', pattern: /\b(?:insurance|policy|coverage)\s+(?:policy\s+)?limit\b|\blimit\s+of\s+(?:liability|coverage)\b/i, type: 'amount', recordKey: 'financial.policy_limit' },
  { key: 'financial.noi', pattern: /\b(?:net\s+operating\s+income|noi)\b/i, type: 'amount', recordKey: 'financial.noi' },
  { key: 'financial.cash_variance', pattern: /\bcash(?:\s+flow)?\s+variance\b|\bvariance\s+in\s+cash\b/i, type: 'amount', recordKey: 'financial.cash_variance' },
  { key: 'financial.cash_balance', pattern: /\bcash\s+balance\b|\bavailable\s+cash\b/i, type: 'amount', recordKey: 'financial.cash_balance' },
  { key: 'financial.proceeds', pattern: /\b(?:insurance|loss|net)?\s*proceeds\b/i, type: 'amount', recordKey: 'financial.proceeds' },
  { key: 'financial.revenue', pattern: /\b(?:gross\s+)?revenue\b|\bsales\b/i, type: 'amount', recordKey: 'financial.revenue' },
  { key: 'financial.ebitda', pattern: /\bebitda\b/i, type: 'amount', recordKey: 'financial.ebitda' },
  { key: 'financial.equity', pattern: /\b(?:owner|borrower|investor)?\s*equity\b/i, type: 'amount', recordKey: 'financial.equity' },
  { key: 'financial.repair_costs', pattern: /\b(?:repair|restoration)\s+(?:cost|costs|amount|estimate)\b|\btotal\s+repair\b/i, type: 'amount', recordKey: 'financial.repair_costs', comparisonKey: 'financial.repair_claim_amount' },
  { key: 'financial.claim_amount', pattern: /\b(?:insurance\s+)?claim\s+(?:amount|value)\b|\bamount\s+of\s+(?:the\s+)?claim\b|\btotal\s+claim\b/i, type: 'amount', recordKey: 'financial.claim_amount', comparisonKey: 'financial.repair_claim_amount' },
  { key: 'transaction.purchase_price', pattern: /\b(?:purchase|sale)\s+price\b|\bconsideration\b/i, type: 'amount', recordKey: 'transaction.purchase_price' },
  { key: 'transaction.value', pattern: /\btransaction\s+value\b|\bdeal\s+value\b|\bvaluation\b/i, type: 'amount', recordKey: 'transaction.value' },
  { key: 'transaction.loss_type', pattern: /\bloss\s+type\b|\bincident\s+type\b|\bevent\s+type\b/i, type: 'text', recordKey: 'transaction.loss_type', comparisonMode: 'hierarchical_text' },
  { key: 'covenant.delinquency_rate', pattern: /\bdelinquen(?:cy|t)\b/i, type: 'percent', recordKey: 'financial.delinquency_rate', relationship: 'delinquency_rate' },
  { key: 'covenant.occupancy_rate', pattern: /\boccupancy\b/i, type: 'percent', recordKey: 'financial.occupancy_rate', relationship: 'occupancy_rate' },
  { key: 'covenant.ltv', pattern: /\b(?:loan[\s-]*to[\s-]*value|ltv)\b/i, type: 'percent', recordKey: 'financial.ltv', relationship: 'ltv' },
  { key: 'covenant.dscr', pattern: /\b(?:debt[\s-]*service[\s-]*coverage|dscr)\b/i, type: 'ratio', recordKey: 'financial.dscr', relationship: 'dscr' },
];

function normalizedText(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ');
}

function contextFor(key, rawValue, explicitLabel = '') {
  const objectContext = rawValue && typeof rawValue === 'object'
    ? [rawValue.key, rawValue.label, rawValue.name, rawValue.semantic_key, rawValue.semanticKey]
    : [rawValue];
  return normalizedText([key, explicitLabel, ...objectContext].filter(Boolean).join(' '));
}

function inferSemanticDefinition(key, rawValue = null, explicitLabel = '') {
  const context = contextFor(key, rawValue, explicitLabel);
  const definition = SEMANTIC_FIELD_DEFINITIONS.find(item => item.pattern.test(context));
  if (!definition) return null;
  const role = THRESHOLD_WORDS.test(context)
    ? 'threshold'
    : ACTUAL_WORDS.test(context) ? 'actual' : 'value';
  return {
    semanticKey: definition.key,
    comparisonKey: definition.comparisonKey || definition.relationship || definition.key,
    valueType: definition.type,
    relationship: definition.relationship || null,
    role,
    recordKey: definition.recordKey || definition.key,
    comparisonMode: definition.comparisonMode || 'value',
  };
}

function numericParts(value) {
  const raw = value && typeof value === 'object'
    ? (value.value ?? value.amount ?? value.number ?? value.numeric_value)
    : value;
  const unit = value && typeof value === 'object' ? value.unit : null;
  if (typeof raw === 'number' && Number.isFinite(raw)) return { value: raw, unit };
  if (typeof raw !== 'string') return null;
  const match = raw.match(/-?\s*([\d,]+(?:\.\d+)?)\s*(million|mm|billion|bn|thousand|k)?/i);
  if (!match) return null;
  const amount = Number(match[1].replace(/,/g, ''));
  if (!Number.isFinite(amount)) return null;
  const multiplier = {
    k: 1e3, thousand: 1e3, mm: 1e6, million: 1e6, bn: 1e9, billion: 1e9,
  }[String(unit || match[2] || '').toLowerCase()] || 1;
  return { value: amount * multiplier, unit: unit || match[2] || null };
}

function amountParts(value) {
  const raw = value && typeof value === 'object'
    ? (value.value ?? value.amount ?? value.number ?? value.numeric_value)
    : value;
  if (typeof raw === 'number' && Number.isFinite(raw)) return { value: raw, unit: null };
  if (typeof raw !== 'string') return null;
  const text = raw.trim();
  // An amount field must contain an amount-shaped value. Do not pull years or
  // facility identifiers out of prose such as "RRF 2026-1 Residential..."
  // and compare that identifier with a principal balance.
  const match = text.match(/^\(?\s*[$€£]?\s*-?\d[\d,]*(?:\.\d+)?\s*(million|mm|billion|bn|thousand|k|m|b)?\s*(?:dollars?|usd)?\s*\)?$/i);
  if (!match) return null;
  const numberMatch = text.match(/-?\s*([\d,]+(?:\.\d+)?)/);
  if (!numberMatch) return null;
  const amount = Number(numberMatch[1].replace(/,/g, ''));
  if (!Number.isFinite(amount)) return null;
  const multiplier = {
    k: 1e3, thousand: 1e3, mm: 1e6, million: 1e6,
    m: 1e6, bn: 1e9, billion: 1e9, b: 1e9,
  }[String(match[1] || '').toLowerCase()] || 1;
  return { value: amount * multiplier, unit: match[1] || null };
}

function normalizePeriod(value) {
  const text = normalizedText(value);
  if (!text) return null;
  const frequency = text.match(/\b(monthly|quarterly|annual(?:ly)?|weekly|daily)\b/);
  const concrete = text.match(/\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+\d{4}\b|\b\d{4}[-/]\d{1,2}(?:[-/]\d{1,2})?\b|\bq[1-4]\s+\d{4}\b|\b\d{4}\b/i);
  return {
    frequency: frequency ? frequency[1].replace(/ly$/, '') : null,
    interval: concrete ? normalizedText(concrete[0]) : null,
  };
}

function normalizeHierarchicalText(value) {
  return normalizedText(value)
    .replace(/[^\da-z\s]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeComparableValue(value, definitionOrKey, explicitLabel = '') {
  const definition = typeof definitionOrKey === 'string'
    ? inferSemanticDefinition(definitionOrKey, value, explicitLabel)
    : definitionOrKey;
  const textValue = String(
    value && typeof value === 'object'
      ? (value.display_value ?? value.value ?? value.amount ?? value.number ?? '')
      : value ?? '',
  ).trim();
  if (definition?.valueType === 'period') {
    return { type: 'period', value: normalizePeriod(textValue) };
  }
  if (definition?.valueType === 'reference') {
    return { type: 'reference', value: normalizedText(textValue) };
  }
  if (definition?.comparisonMode === 'hierarchical_text') {
    return { type: 'hierarchical_text', value: normalizeHierarchicalText(textValue) };
  }
  const numeric = definition?.valueType === 'amount' ? amountParts(value) : numericParts(value);
  if (numeric && definition?.valueType === 'percent') {
    return { type: 'percent', value: numeric.value };
  }
  if (numeric && definition?.valueType === 'ratio') {
    return { type: 'ratio', value: numeric.value };
  }
  if (numeric && definition?.valueType === 'amount') {
    return { type: 'amount', value: numeric.value };
  }
  return { type: 'text', value: normalizedText(textValue) };
}

function compareComparableValues(left, right, definition) {
  const mode = definition?.comparisonMode || 'value';
  if (mode === 'none') return { comparable: false, equivalent: true };
  if (!left || !right || left.type !== right.type) {
    return { comparable: false, equivalent: true };
  }
  if (left.type === 'period') {
    const leftPeriod = left.value || {};
    const rightPeriod = right.value || {};
    // Frequency ("monthly") and covered interval ("July 2026") are different
    // metadata dimensions and therefore cannot contradict each other.
    if (leftPeriod.frequency && rightPeriod.interval && !leftPeriod.interval) {
      return { comparable: false, equivalent: true };
    }
    if (rightPeriod.frequency && leftPeriod.interval && !rightPeriod.interval) {
      return { comparable: false, equivalent: true };
    }
    return {
      comparable: true,
      equivalent: leftPeriod.frequency === rightPeriod.frequency
        && leftPeriod.interval === rightPeriod.interval,
    };
  }
  if (left.type === 'reference') {
    return { comparable: false, equivalent: true };
  }
  if (left.type === 'hierarchical_text') {
    const parentChild = (parent, child) => parent === 'hazard loss'
      && child.startsWith(`${parent} `)
      && child.length > parent.length;
    const equivalent = left.value === right.value
      || parentChild(left.value, right.value)
      || parentChild(right.value, left.value);
    return { comparable: true, equivalent };
  }
  if (left.type === 'text') {
    return { comparable: true, equivalent: left.value === right.value };
  }
  return {
    comparable: true,
    equivalent: Math.abs(left.value - right.value)
      <= Math.max(0.01, Math.abs(left.value) * 0.01),
  };
}

function isSemanticallyValidValue(value, definitionOrKey, explicitLabel = '') {
  const definition = typeof definitionOrKey === 'string'
    ? inferSemanticDefinition(definitionOrKey, value, explicitLabel)
    : definitionOrKey;
  if (!definition || definition.valueType !== 'amount') return true;
  return normalizeComparableValue(value, definition).type === 'amount';
}

function semanticRecordKey(rawKey, displayLabel = '') {
  return inferSemanticDefinition(rawKey, null, displayLabel)?.recordKey || null;
}

module.exports = {
  SEMANTIC_FIELD_DEFINITIONS,
  inferSemanticDefinition,
  normalizeComparableValue,
  compareComparableValues,
  isSemanticallyValidValue,
  semanticRecordKey,
  normalizedText,
};