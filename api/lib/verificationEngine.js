/**
 * Cross-document verification engine.
 *
 * Verification results are stored as a regular deal_analyses record instead
 * of requiring a new table. That keeps this usable for rooms whose production
 * database has not received the newer pipeline migrations yet.
 */
const crypto = require('crypto');
const { supabase } = require('../db');
const {
  inferSemanticDefinition,
  isSemanticallyValidValue,
} = require('./semanticFieldTaxonomy');

const VERIFICATION_SECTION = 'cross_document_verification';
const NUMBER_PATTERN = /[$€£]?\s*([\d,]+(?:\.\d+)?)\s*(million|mm|billion|bn|thousand|k)?/gi;
const PERCENT_PATTERN = /([\d,]+(?:\.\d+)?)\s*%/gi;
const GENERIC_FACT_WORDS = new Set(['amount', 'value', 'total', 'number', 'balance', 'variance', 'metric', 'result']);
const THRESHOLD_WORDS = /\b(trigger|threshold|limit|maximum|max|min(?:imum)?|cap|must\s+not\s+exceed|at\s+least|no\s+more\s+than|no\s+less\s+than)\b/i;
const ACTUAL_WORDS = /\b(actual|current|reported|observed|measured|as\s+of|is|was|were)\b/i;
const SEMANTIC_ALIASES = [
  { key: 'capital.commitment', pattern: /\b(?:total\s+)?(?:loan\s+)?commitment\b|\bcommitted\s+(?:amount|balance)\b/i, type: 'amount' },
  { key: 'financial.noi', pattern: /\b(?:net\s+operating\s+income|noi)\b/i, type: 'amount' },
  { key: 'financial.cash_variance', pattern: /\bcash(?:\s+flow)?\s+variance\b|\bvariance\s+in\s+cash\b/i, type: 'amount' },
  { key: 'financial.cash_balance', pattern: /\bcash\s+balance\b|\bavailable\s+cash\b/i, type: 'amount' },
  { key: 'financial.proceeds', pattern: /\b(?:insurance|loss|net)?\s*proceeds\b/i, type: 'amount' },
  { key: 'financial.revenue', pattern: /\b(?:gross\s+)?revenue\b|\bsales\b/i, type: 'amount' },
  { key: 'financial.ebitda', pattern: /\bebitda\b/i, type: 'amount' },
  { key: 'financial.equity', pattern: /\b(?:owner|borrower|investor)?\s*equity\b/i, type: 'amount' },
  { key: 'financial.repair_costs', pattern: /\b(?:repair|restoration)\s+(?:cost|costs|amount|estimate)\b|\btotal\s+repair\b/i, type: 'amount' },
  { key: 'transaction.purchase_price', pattern: /\b(?:purchase|sale)\s+price\b|\bconsideration\b/i, type: 'amount' },
  { key: 'transaction.value', pattern: /\btransaction\s+value\b|\bdeal\s+value\b|\bvaluation\b/i, type: 'amount' },
  { key: 'covenant.delinquency_rate', pattern: /\bdelinquen(?:cy|t)\b/i, type: 'percent', relationship: 'delinquency_rate' },
  { key: 'covenant.occupancy_rate', pattern: /\boccupancy\b/i, type: 'percent', relationship: 'occupancy_rate' },
  { key: 'covenant.ltv', pattern: /\b(?:loan[\s-]*to[\s-]*value|ltv)\b/i, type: 'percent', relationship: 'ltv' },
  { key: 'covenant.dscr', pattern: /\b(?:debt[\s-]*service[\s-]*coverage|dscr)\b/i, type: 'ratio', relationship: 'dscr' },
];

function humanizeSection(section) {
  return String(section || 'document')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

function numericValue(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string') return null;
  const match = value.match(/-?\s*[\d,]+(?:\.\d+)?/);
  if (!match) return null;
  const parsed = Number(match[0].replace(/[$,\s]/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
}

function scaleAmount(value, unit) {
  const multiplier = {
    k: 1e3, thousand: 1e3,
    mm: 1e6, million: 1e6,
    mil: 1e6,
    bn: 1e9, billion: 1e9,
  }[String(unit || '').toLowerCase()] || 1;
  return value * multiplier;
}

function normalizedText(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ');
}

function factContext(key, rawValue) {
  if (rawValue && typeof rawValue === 'object') {
    return normalizedText([
      rawValue.key,
      rawValue.label,
      rawValue.name,
      rawValue.semantic_key,
      rawValue.semanticKey,
      key,
    ].filter(Boolean).join(' '));
  }
  return normalizedText(`${key} ${rawValue || ''}`);
}

function inferFactDefinition(key, rawValue, explicitLabel = '') {
  const semanticDefinition = inferSemanticDefinition(key, rawValue, explicitLabel);
  if (semanticDefinition) return semanticDefinition;
  const context = normalizedText(`${key} ${explicitLabel} ${rawValue && typeof rawValue === 'object'
    ? [rawValue.label, rawValue.name, rawValue.semantic_key, rawValue.semanticKey].filter(Boolean).join(' ')
    : ''}`);
  const alias = SEMANTIC_ALIASES.find(item => item.pattern.test(context));
  if (alias) {
    const role = THRESHOLD_WORDS.test(context)
      ? 'threshold'
      : ACTUAL_WORDS.test(context) ? 'actual' : 'value';
    return {
      semanticKey: alias.key,
      comparisonKey: alias.relationship || alias.key,
      valueType: alias.type,
      relationship: alias.relationship || null,
      role,
    };
  }

  const slug = normalizedText(key).replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  const label = normalizedText(explicitLabel);
  const fallbackKey = slug || label.replace(/[^a-z0-9]+/g, '_');
  if (!fallbackKey || GENERIC_FACT_WORDS.has(fallbackKey)) return null;
  const percent = /%|percent|percentage|rate|ratio|ltv|dscr/.test(context);
  return {
    semanticKey: `metric:${fallbackKey}`,
    comparisonKey: `metric:${fallbackKey}`,
    valueType: percent ? (/ratio|dscr/.test(context) ? 'ratio' : 'percent') : 'amount',
    relationship: null,
    role: THRESHOLD_WORDS.test(context) ? 'threshold' : 'value',
  };
}

function extractNumeric(rawValue, context = '') {
  const value = rawValue && typeof rawValue === 'object'
    ? (rawValue.value ?? rawValue.amount ?? rawValue.number ?? rawValue.numeric_value)
    : rawValue;
  const unit = rawValue && typeof rawValue === 'object' ? rawValue.unit : null;
  if (typeof value === 'number' && Number.isFinite(value)) {
    return { value, unit: unit || (/percent|percentage|rate|%/.test(context) ? '%' : null) };
  }
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  const match = trimmed.match(/-?\s*([\d,]+(?:\.\d+)?)\s*(million|mm|billion|bn|thousand|k)?/i);
  if (!match) return null;
  const parsed = Number(match[1].replace(/,/g, ''));
  if (!Number.isFinite(parsed)) return null;
  const parsedUnit = unit || (/%|percent|percentage|rate/.test(context) ? '%' : match[2] || null);
  return {
    value: parsedUnit === '%' ? parsed : scaleAmount(parsed, parsedUnit),
    unit: parsedUnit === '%' ? '%' : 'currency',
  };
}

function sourceExcerptFor(document, rawValue, fallback = null) {
  return (rawValue && typeof rawValue === 'object' && (
    rawValue.source_excerpt || rawValue.sourceExcerpt || rawValue.excerpt
  )) || document.analysis?.source_excerpt || fallback || null;
}

function sourcePageFor(document, rawValue) {
  return (rawValue && typeof rawValue === 'object'
    ? (rawValue.source_page ?? rawValue.sourcePage ?? rawValue.page)
    : null) || document.analysis?.source_page || null;
}

function makeFact(document, key, rawValue, explicitLabel = '', fallbackExcerpt = null) {
  const definition = inferFactDefinition(key, rawValue, explicitLabel);
  if (!definition) return null;
  // Periods and references are Transaction Record metadata. They are typed by
  // the shared taxonomy for record conflict handling, but are not numeric facts
  // that belong in cross-document amount/rate verification.
  if (!['amount', 'percent', 'ratio'].includes(definition.valueType)) return null;
  if (!isSemanticallyValidValue(rawValue, definition)) return null;
  const numeric = extractNumeric(rawValue, `${key} ${explicitLabel}`);
  if (!numeric || numeric.value < 0) return null;
  return {
    key: definition.semanticKey,
    semantic_key: definition.semanticKey,
    comparison_key: definition.comparisonKey,
    value_type: definition.valueType,
    unit: numeric.unit,
    role: definition.role,
    relationship: definition.relationship,
    value: numeric.value,
    raw_value: rawValue && typeof rawValue === 'object'
      ? (rawValue.display_value ?? rawValue.value ?? rawValue.amount ?? rawValue.number)
      : rawValue,
    source_doc_id: document.id || null,
    source_section: document.section,
    source_filename: document.filename || null,
    source_page: sourcePageFor(document, rawValue),
    source_excerpt: sourceExcerptFor(document, rawValue, fallbackExcerpt),
  };
}

function extractSummaryFacts(document, summary) {
  const facts = [];
  const summaryText = String(summary || '');
  for (const match of summaryText.matchAll(PERCENT_PATTERN)) {
    const start = Math.max(0, match.index - 100);
    const context = summaryText.slice(start, match.index + match[0].length);
    if (!SEMANTIC_ALIASES.some(item => item.pattern.test(context))) continue;
    const fact = makeFact(document, context, {
      value: Number(match[1].replace(/,/g, '')),
      unit: '%',
      source_excerpt: summaryText.slice(start, Math.min(summaryText.length, match.index + match[0].length + 80)).trim(),
    }, context);
    if (fact) facts.push(fact);
  }
  for (const match of summaryText.matchAll(NUMBER_PATTERN)) {
    const before = summaryText.slice(Math.max(0, match.index - 100), match.index);
    // Dollar mentions without a semantic label are evidence, but not a
    // comparable fact. Keeping them out of groups prevents "$25m" in a
    // commitment document from becoming NOI, proceeds, or cash variance.
    if (!/[$€£]/.test(match[0]) || !SEMANTIC_ALIASES.some(item => item.pattern.test(before))) continue;
    const fact = makeFact(document, before, `${match[1]} ${match[2] || ''}`, before);
    if (fact) facts.push(fact);
  }
  return facts;
}

function extractFacts(document) {
  const analysis = document.analysis || {};
  const facts = [];
  const metrics = analysis.metrics && typeof analysis.metrics === 'object'
    ? analysis.metrics
    : {};

  for (const [key, rawValue] of Object.entries(metrics)) {
    const fact = makeFact(document, key, rawValue, rawValue?.label || rawValue?.name || '');
    if (fact) facts.push({ ...fact, label: humanizeSection(rawValue?.label || key) });
  }

  const structuredFacts = Array.isArray(analysis.normalized_facts)
    ? analysis.normalized_facts
    : Array.isArray(analysis.facts) ? analysis.facts : [];
  for (const rawFact of structuredFacts) {
    const key = rawFact?.semantic_key || rawFact?.semanticKey || rawFact?.key || rawFact?.label;
    const fact = makeFact(document, key, rawFact, rawFact?.label || rawFact?.name || '');
    if (fact) facts.push({ ...fact, label: rawFact.label || humanizeSection(key) });
  }

  if (facts.length === 0 && typeof analysis.summary === 'string') {
    facts.push(...extractSummaryFacts(document, analysis.summary));
  }

  return facts.filter((fact, index, all) =>
    index === all.findIndex(other =>
      other.comparison_key === fact.comparison_key
      && other.role === fact.role
      && other.source_section === fact.source_section
      && other.value === fact.value
    )
  );
}

function latestDocuments(rows) {
  const bySection = new Map();
  for (const row of rows || []) {
    if (!row?.section || row.section === VERIFICATION_SECTION) continue;
    if (row.is_active === false || row.superseded_at) continue;
    const existing = bySection.get(row.section);
    if (!existing || new Date(row.created_at || 0) > new Date(existing.created_at || 0)) {
      bySection.set(row.section, row);
    }
  }
  return [...bySection.values()];
}

function formatAmount(value) {
  return `$${Math.round(value).toLocaleString('en-US')}`;
}

function formatFactValue(fact) {
  if (fact.value_type === 'percent') return `${Number(fact.value).toFixed(2).replace(/\.?0+$/, '')}%`;
  if (fact.value_type === 'ratio') return Number(fact.value).toFixed(2);
  return formatAmount(fact.value);
}

function evidencePayload(fact) {
  return {
    document_id: fact.source_doc_id,
    section: fact.source_section,
    filename: fact.source_filename,
    page: fact.source_page,
    excerpt: fact.source_excerpt,
    semantic_key: fact.semantic_key,
    value_type: fact.value_type,
    unit: fact.unit,
    role: fact.role,
  };
}

function buildChecks(documents, runAt) {
  const factGroups = new Map();
  const relationshipGroups = new Map();
  for (const document of documents) {
    for (const fact of extractFacts(document)) {
      const enriched = { ...fact, section: document.section, label: humanizeSection(document.section) };
      if (fact.role === 'threshold' || fact.relationship) {
        const relationKey = `${fact.relationship || fact.comparison_key}:${fact.value_type}`;
        if (!relationshipGroups.has(relationKey)) relationshipGroups.set(relationKey, []);
        relationshipGroups.get(relationKey).push(enriched);
      }
      if (fact.role === 'threshold' || fact.role === 'actual') continue;
      const groupKey = `${fact.comparison_key}:${fact.value_type}:${fact.unit || 'none'}`;
      if (!factGroups.has(groupKey)) factGroups.set(groupKey, []);
      factGroups.get(groupKey).push(enriched);
    }
  }

  const checks = [];
  for (const [factKey, facts] of factGroups.entries()) {
    const uniqueSections = new Set(facts.map(fact => fact.section));
    if (uniqueSections.size < 2) continue;

    // Compare each later document to the first document reporting this fact.
    // This produces a useful audit trail while avoiding duplicate pair rows.
    const baseline = facts[0];
    for (const candidate of facts.slice(1)) {
      const deltaPct = baseline.value === 0
        ? 0
        : Math.abs(candidate.value - baseline.value) / Math.abs(baseline.value) * 100;
      const matches = deltaPct <= 1;
      checks.push({
        id: `fact:${factKey}:${baseline.section}:${candidate.section}`,
        type: 'fact_consistency',
        status: matches ? 'verified' : 'discrepancy',
        ...(matches ? {} : { severity: 'warning' }),
        description: matches
          ? `${baseline.label} and ${candidate.label} report the same ${baseline.semantic_key}: ${formatFactValue(baseline)}.`
          : `${baseline.label} reports ${formatFactValue(baseline)} for ${baseline.semantic_key} while ${candidate.label} reports ${formatFactValue(candidate)}.`,
        doc_section_a: baseline.section,
        doc_section_b: candidate.section,
        value_a: baseline.value,
        value_b: candidate.value,
        delta_pct: deltaPct,
        fact_key: baseline.semantic_key,
        semantic_key: baseline.semantic_key,
        value_type: baseline.value_type,
        unit: baseline.unit,
        evidence_a: evidencePayload(baseline),
        evidence_b: evidencePayload(candidate),
        source_page_a: baseline.source_page,
        source_page_b: candidate.source_page,
        source_excerpt_a: baseline.source_excerpt,
        source_excerpt_b: candidate.source_excerpt,
        run_at: runAt,
      });
    }
  }

  for (const [relationKey, facts] of relationshipGroups.entries()) {
    const thresholds = facts.filter(fact => fact.role === 'threshold');
    const actuals = facts.filter(fact => fact.role === 'actual' || fact.role === 'value');
    if (!thresholds.length || !actuals.length) continue;
    const threshold = thresholds[0];
    const actual = actuals.find(candidate => candidate.section !== threshold.section) || actuals[0];
    const higherIsWorse = threshold.relationship === 'delinquency_rate'
      || threshold.relationship === 'ltv'
      || /max|limit|threshold|trigger|cap|no\s+more/i.test(threshold.source_excerpt || '');
    const breached = higherIsWorse ? actual.value > threshold.value : actual.value < threshold.value;
    checks.push({
      id: `threshold:${relationKey}:${threshold.section}:${actual.section}`,
      type: 'threshold_relationship',
      status: breached ? 'discrepancy' : 'verified',
      ...(breached ? { severity: 'warning' } : {}),
      description: breached
        ? `${actual.label} reports ${formatFactValue(actual)} against the ${threshold.label} threshold of ${formatFactValue(threshold)} for ${threshold.relationship || threshold.semantic_key}.`
        : `${actual.label} reports ${formatFactValue(actual)}, within the ${threshold.label} threshold of ${formatFactValue(threshold)} for ${threshold.relationship || threshold.semantic_key}.`,
      doc_section_a: threshold.section,
      doc_section_b: actual.section,
      value_a: threshold.value,
      value_b: actual.value,
      threshold_value: threshold.value,
      actual_value: actual.value,
      fact_key: threshold.semantic_key,
      semantic_key: threshold.relationship || threshold.semantic_key,
      relationship: threshold.relationship || null,
      value_type: threshold.value_type,
      unit: threshold.unit,
      evidence_a: evidencePayload(threshold),
      evidence_b: evidencePayload(actual),
      source_page_a: threshold.source_page,
      source_page_b: actual.source_page,
      source_excerpt_a: threshold.source_excerpt,
      source_excerpt_b: actual.source_excerpt,
      run_at: runAt,
    });
  }

  if (checks.length === 0 && documents.length > 0) {
    const firstDocument = documents[0];
    const hasComparablePair = documents.length >= 2;
    checks.push({
      id: hasComparablePair ? 'documents:comparable-facts' : 'documents:awaiting-comparison',
      type: 'document_consistency',
      status: 'pending_review',
      description: hasComparablePair
        ? 'Multiple documents are uploaded, but they do not yet contain a shared structured amount to compare.'
        : 'One document is uploaded. Cross-document checks will run again automatically when another related document is added.',
      doc_section_a: firstDocument.section,
      ...(hasComparablePair ? { doc_section_b: documents[1].section } : {}),
      run_at: runAt,
    });
  }

  return checks;
}

function summarizeChecks(checks) {
  return checks.reduce((summary, check) => {
    if (check.status === 'verified') summary.verified += 1;
    else if (check.status === 'discrepancy') summary.discrepancies += 1;
    else summary.pending += 1;
    return summary;
  }, { verified: 0, discrepancies: 0, pending: 0 });
}

function verificationSourceSignature(documents = []) {
  const source = (documents || []).map(document => ({
    id: document.id || null,
    section: document.section || null,
    created_at: document.created_at || null,
    source_hash: document.source_hash || null,
    analysis: document.analysis || {},
  }));
  return crypto.createHash('sha256').update(JSON.stringify(source)).digest('hex');
}

function buildVerificationResult(propertyId, packId, comparableDocuments, runAt = new Date().toISOString()) {
  const checks = buildChecks(comparableDocuments, runAt);
  const summary = summarizeChecks(checks);
  return {
    propertyId,
    packId,
    status: checks.some(check => check.status === 'verified' || check.status === 'discrepancy')
      ? 'complete'
      : 'pending',
    run_at: runAt,
    source_signature: verificationSourceSignature(comparableDocuments),
    summary,
    checks,
    normalized_facts: comparableDocuments.flatMap(extractFacts),
    documents_considered: comparableDocuments.map(document => document.section),
  };
}

async function loadVerificationRows(propertyId) {
  const { data, error } = await supabase
    .from('deal_analyses')
    .select('id, analysis, created_at')
    .eq('property_id', propertyId)
    .eq('section', VERIFICATION_SECTION)
    .order('created_at', { ascending: false })
    .limit(1);
  if (error) throw error;
  return data || [];
}

async function loadComparableDocuments(propertyId) {
  let { data: documents, error: documentError } = await supabase
    .from('deal_analyses')
    .select('id, section, analysis, created_at, source_hash, is_active, superseded_at')
    .eq('property_id', propertyId)
    .neq('section', VERIFICATION_SECTION)
    .order('created_at', { ascending: true });
  if (documentError && /source_hash|is_active|superseded_at|superseded_by|schema cache|column .* does not exist/i.test(documentError.message || '')) {
    ({ data: documents, error: documentError } = await supabase
      .from('deal_analyses')
      .select('id, section, analysis, created_at')
      .eq('property_id', propertyId)
      .neq('section', VERIFICATION_SECTION)
      .order('created_at', { ascending: true }));
  }
  if (documentError) throw documentError;
  return latestDocuments(documents || []);
}

async function persistVerificationResult(result) {
  const { error } = await supabase
    .from('deal_analyses')
    .insert({
      property_id: result.propertyId,
      section: VERIFICATION_SECTION,
      filename: 'cross-document-verification.json',
      analysis: result,
      uploaded_by_role: 'verification_engine',
    });
  if (error) throw error;
  return result;
}

function verificationStateFromAnalysis(analysis, createdAt = null) {
  const latest = analysis || {};
  const checks = Array.isArray(latest.checks) ? latest.checks : [];
  return {
    status: latest.status || (checks.length ? 'complete' : 'pending'),
    summary: latest.summary || summarizeChecks(checks),
    // The UI renders each verification run as an object containing `checks`.
    // Returning the checks array directly makes a pending check look like a
    // run with zero checks (and produces the misleading "Run #1 · 0 checks").
    runs: analysis ? [latest] : [],
    run_at: latest.run_at || createdAt || null,
  };
}

async function getVerificationState(propertyId) {
  const [rows, comparableDocuments] = await Promise.all([
    loadVerificationRows(propertyId),
    loadComparableDocuments(propertyId),
  ]);
  const latestRow = rows[0] || null;
  const latest = latestRow?.analysis || null;
  const current = buildVerificationResult(
    propertyId,
    latest?.packId || null,
    comparableDocuments,
  );

  // Existing rooms may have a verification row created before semantic
  // reconciliation or before a document replacement. Recompute from the
  // active evidence projection on hydration. Only write when the source
  // signature changed so ordinary refreshes do not create duplicate runs.
  if (!latest || latest.source_signature !== current.source_signature) {
    if (comparableDocuments.length > 0) {
      await persistVerificationResult(current);
    }
    return verificationStateFromAnalysis(
      comparableDocuments.length > 0 ? current : null,
      latestRow?.created_at || null,
    );
  }
  return verificationStateFromAnalysis(latest, latestRow?.created_at || null);
}

async function runVerification(propertyId, packId = null) {
  const comparableDocuments = await loadComparableDocuments(propertyId);
  const result = buildVerificationResult(propertyId, packId, comparableDocuments);
  await persistVerificationResult(result);
  return result;
}

module.exports = {
  VERIFICATION_SECTION,
  getVerificationState,
  runVerification,
  latestDocuments,
  verificationSourceSignature,
  buildVerificationResult,
  extractFacts,
  buildChecks,
  inferFactDefinition,
};