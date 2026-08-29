/**
 * Cross-document verification engine.
 *
 * Verification results are stored as a regular deal_analyses record instead
 * of requiring a new table. That keeps this usable for rooms whose production
 * database has not received the newer pipeline migrations yet.
 */
const { supabase } = require('../db');

const VERIFICATION_SECTION = 'cross_document_verification';
const AMOUNT_KEY = /amount|consideration|price|proceeds|valuation|value|revenue|ebitda|income|equity|deposit|financing|purchase/i;
const AMOUNT_PATTERN = /\$\s*([\d,]+(?:\.\d+)?)\s*(million|mm|billion|bn|thousand|k)?/gi;

function humanizeSection(section) {
  return String(section || 'document')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

function numericValue(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string') return null;
  const parsed = Number(value.replace(/[$,\s]/g, ''));
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

function extractFacts(document) {
  const analysis = document.analysis || {};
  const facts = [];
  const metrics = analysis.metrics && typeof analysis.metrics === 'object'
    ? analysis.metrics
    : {};

  for (const [key, rawValue] of Object.entries(metrics)) {
    if (!AMOUNT_KEY.test(key)) continue;
    const value = numericValue(rawValue);
    if (value == null || value <= 0) continue;
    facts.push({ key: `metric:${key.toLowerCase()}`, label: humanizeSection(key), value });
  }

  // Older or lightweight document analyzers may only include the amount in
  // their summary. Use that as a fallback when no comparable metric exists.
  if (facts.length === 0 && typeof analysis.summary === 'string') {
    for (const match of analysis.summary.matchAll(AMOUNT_PATTERN)) {
      const amount = scaleAmount(Number(match[1].replace(/,/g, '')), match[2]);
      if (Number.isFinite(amount) && amount > 0) {
        facts.push({ key: 'summary:amount', label: 'Amount', value: amount });
      }
    }
  }

  return facts;
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

function buildChecks(documents, runAt) {
  const factGroups = new Map();
  for (const document of documents) {
    for (const fact of extractFacts(document)) {
      if (!factGroups.has(fact.key)) factGroups.set(fact.key, []);
      factGroups.get(fact.key).push({
        ...fact,
        section: document.section,
        label: humanizeSection(document.section),
      });
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
        id: `amount:${factKey}:${baseline.section}:${candidate.section}`,
        type: 'amount_consistency',
        status: matches ? 'verified' : 'discrepancy',
        ...(matches ? {} : { severity: 'warning' }),
        description: matches
          ? `${baseline.label} and ${candidate.label} report the same amount: ${formatAmount(baseline.value)}.`
          : `${baseline.label} reports ${formatAmount(baseline.value)} while ${candidate.label} reports ${formatAmount(candidate.value)}.`,
        doc_section_a: baseline.section,
        doc_section_b: candidate.section,
        value_a: baseline.value,
        value_b: candidate.value,
        delta_pct: deltaPct,
        run_at: runAt,
      });
    }
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

async function getVerificationState(propertyId) {
  const rows = await loadVerificationRows(propertyId);
  const latest = rows[0]?.analysis || {};
  const checks = Array.isArray(latest.checks) ? latest.checks : [];
  return {
    status: latest.status || (checks.length ? 'complete' : 'pending'),
    summary: latest.summary || summarizeChecks(checks),
    // The UI renders each verification run as an object containing `checks`.
    // Returning the checks array directly makes a pending check look like a
    // run with zero checks (and produces the misleading "Run #1 · 0 checks").
    runs: rows[0] ? [latest] : [],
    run_at: latest.run_at || rows[0]?.created_at || null,
  };
}

async function runVerification(propertyId, packId = null) {
  let { data: documents, error: documentError } = await supabase
    .from('deal_analyses')
    .select('id, section, analysis, created_at, is_active, superseded_at')
    .eq('property_id', propertyId)
    .neq('section', VERIFICATION_SECTION)
    .order('created_at', { ascending: true });
  if (documentError && /is_active|superseded_at|superseded_by|schema cache|column .* does not exist/i.test(documentError.message || '')) {
    ({ data: documents, error: documentError } = await supabase
      .from('deal_analyses')
      .select('id, section, analysis, created_at')
      .eq('property_id', propertyId)
      .neq('section', VERIFICATION_SECTION)
      .order('created_at', { ascending: true }));
  }
  if (documentError) throw documentError;

  const comparableDocuments = latestDocuments(documents);
  const runAt = new Date().toISOString();
  const checks = buildChecks(comparableDocuments, runAt);
  const summary = summarizeChecks(checks);
  const result = {
    propertyId,
    packId,
    status: checks.some(check => check.status === 'verified' || check.status === 'discrepancy')
      ? 'complete'
      : 'pending',
    run_at: runAt,
    summary,
    checks,
    documents_considered: comparableDocuments.map(document => document.section),
  };

  const { error: deleteError } = await supabase
    .from('deal_analyses')
    .delete()
    .eq('property_id', propertyId)
    .eq('section', VERIFICATION_SECTION);
  if (deleteError) throw deleteError;

  const { error: insertError } = await supabase
    .from('deal_analyses')
    .insert({
      property_id: propertyId,
      section: VERIFICATION_SECTION,
      filename: 'cross-document-verification.json',
      analysis: result,
      uploaded_by_role: 'verification_engine',
    });
  if (insertError) throw insertError;

  return result;
}

module.exports = {
  VERIFICATION_SECTION,
  getVerificationState,
  runVerification,
  latestDocuments,
};