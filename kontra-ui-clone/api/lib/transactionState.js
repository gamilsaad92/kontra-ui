'use strict';

const crypto = require('crypto');
const { supabase } = require('../db');
const { resolvePackIdFromRoom, logEvent } = require('./dealRoomHelpers');
const { emit } = require('./eventBus');
const {
  listTasksForRoom,
  evaluateDealRoomForTasks,
  evaluateReadinessTasks,
} = require('./taskEngine');
const {
  canonicalizeTransactionRecordKey,
} = require('./transactionRecordCanonicalization');
const {
  extractFacts,
  inferFactDefinition,
  getVerificationState,
} = require('./verificationEngine');
const {
  compareComparableValues,
  normalizeComparableValue,
} = require('./semanticFieldTaxonomy');
const {
  buildTokenizationGuidance,
} = require('./tokenizationGuidance');
const { selectActiveDocumentVersions } = require('./documentVersions');

// Existing rooms may have document-level discrepancy metadata but no
// transaction_record_conflicts row because they predate the durable conflict
// table. Reconcile those stored findings on hydration so reopening a room is
// enough to restore its blocking state. This is deliberately deterministic and
// never calls an LLM.
const recordNormalizeAt = new Map();
const MONEY_PATTERN = /\$\s*([\d,]+(?:\.\d+)?)/g;
const REPAIR_CONTEXT = /repair|contractor|invoice|restoration|loss\s+proceeds|hazard/i;

function parseAmount(value) {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) return value;
  const raw = value && typeof value === 'object'
    ? (value.value ?? value.amount ?? value.number ?? value.numeric_value)
    : value;
  if (typeof raw !== 'string') return null;
  const match = raw.trim().match(/^\(?\s*[$€£]?\s*([\d,]+(?:\.\d+)?)\s*(million|mm|billion|bn|thousand|k|m|b)?\s*(?:dollars?|usd)?\s*\)?$/i);
  if (!match) return null;
  const base = Number(match[1].replace(/,/g, ''));
  const multiplier = {
    k: 1e3, thousand: 1e3, mm: 1e6, m: 1e6, million: 1e6,
    b: 1e9, bn: 1e9, billion: 1e9,
  }[String(match[2] || '').toLowerCase()] || 1;
  const amount = base * multiplier;
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

function latestEvidenceTimestamp(candidates = []) {
  return (Array.isArray(candidates) ? candidates : [])
    .map(candidate => candidate?.document?.created_at || candidate?.created_at)
    .filter(Boolean)
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0] || null;
}

function shouldPreserveResolvedConflict({
  resolvedConflicts = [],
  fieldKey,
  latestEvidenceAt = null,
} = {}) {
  const resolved = (Array.isArray(resolvedConflicts) ? resolvedConflicts : [])
    .filter(conflict =>
      conflict?.status === 'resolved'
      && conflict?.field_key === fieldKey
      && conflict?.resolved_at
    )
    .sort((a, b) => new Date(b.resolved_at).getTime() - new Date(a.resolved_at).getTime())[0];
  if (!resolved) return false;

  // A resolution applies to the evidence that existed when it was made. A
  // genuinely newer source is allowed to reopen the field for review, but the
  // same source pair must not be resurrected by the read-after-write path.
  if (!latestEvidenceAt) return true;
  return new Date(resolved.resolved_at).getTime() >= new Date(latestEvidenceAt).getTime();
}

function storedDocumentAmounts(document) {
  const analysis = document?.analysis && typeof document.analysis === 'object'
    ? document.analysis
    : {};
  const context = `${document?.section || ''} ${document?.filename || ''} ${JSON.stringify(analysis)}`;
  if (!REPAIR_CONTEXT.test(context)) return [];
  const values = [];
  const walk = (node, path = '') => {
    if (!node || typeof node !== 'object') return;
    for (const [key, raw] of Object.entries(node)) {
      const nextPath = `${path}.${key}`;
      const keyText = `${key} ${nextPath}`;
      if (/(repair|restoration).*(cost|amount|estimate|total)|(?:invoice|contractor).*(amount|total|cost)|(?:total|estimated).*(repair|cost)/i.test(keyText)) {
        const amount = parseAmount(raw);
        if (amount) values.push({ amount, excerpt: `${key}: ${String(raw).slice(0, 180)}` });
      }
      if (raw && typeof raw === 'object') walk(raw, nextPath);
    }
  };
  walk(analysis);
  // Old analyses often only retain a prose discrepancy/summary. Monetary
  // strings in repair-related documents are still safe candidates.
  if (!values.length) {
    const serialized = JSON.stringify(analysis);
    for (const match of serialized.matchAll(MONEY_PATTERN)) {
      const start = Math.max(0, match.index - 140);
      const end = Math.min(serialized.length, match.index + match[0].length + 140);
      const nearbyContext = serialized.slice(start, end);
      // A repair-related document can also mention policy limits, reserves,
      // deductibles, or proceeds. Those are different facts and must never be
      // promoted into a repair-cost candidate merely because they contain $.
      if (!/(repair|restoration|contractor|invoice|estimated\s+(?:repair|cost)|total\s+(?:repair|cost))/i.test(nearbyContext)) continue;
      if (/(policy|coverage|liability)\s*[_ -]*(?:limit|maximum)|limit\s*[_ -]*of\s*[_ -]*(?:coverage|liability)/i.test(nearbyContext)) continue;
      const amount = Number(match[1].replace(/,/g, ''));
      if (amount > 0) values.push({ amount, excerpt: nearbyContext.slice(0, 280) });
    }
  }
  return [...new Map(values.map(item => [item.amount, item])).values()];
}

async function reconcileStoredDocumentConflicts(propertyId) {
  if (!propertyId) return;
  try {
    const [
      { data: initialDocuments, error: initialDocumentsError },
      { data: fields, error: fieldsError },
      { data: openConflicts, error: openConflictsError },
    ] = await Promise.all([
      supabase.from('deal_analyses')
        .select('id, section, filename, analysis, created_at, is_active, superseded_at')
        .eq('property_id', propertyId)
        .order('created_at', { ascending: true }),
      supabase.from('transaction_record_fields')
        .select('id, field_key, display_label, value_text, status, source_doc_id, source_page, source_excerpt, conflict_candidates, verified_by, updated_at')
        .eq('property_id', propertyId),
      supabase.from('transaction_record_conflicts')
        .select('id, field_id, field_key, display_label, canonical_value, conflicting_value, canonical_source_doc_id, conflicting_source_doc_id, status')
        .eq('property_id', propertyId)
        .eq('status', 'unresolved'),
    ]);
    let documents = initialDocuments;
    let documentsError = initialDocumentsError;
    if (documentsError && /column|schema cache/i.test(documentsError.message || '')) {
      const legacyDocuments = await supabase.from('deal_analyses')
        .select('id, section, filename, analysis, created_at')
        .eq('property_id', propertyId)
        .order('created_at', { ascending: true });
      documents = legacyDocuments.data;
      documentsError = legacyDocuments.error;
    }
    if (documentsError) throw documentsError;
    if (fieldsError) throw fieldsError;
    if (openConflictsError && !/relation|schema cache|column/i.test(openConflictsError.message || '')) {
      throw openConflictsError;
    }
    const sourceDocuments = selectActiveDocumentVersions(documents || []);
    for (const conflict of openConflicts || []) {
      if (isConflictSupportedByActiveEvidence(conflict, documents || [])) continue;
      const resolvedAt = new Date().toISOString();
      const { error: resolveError } = await supabase.from('transaction_record_conflicts').update({
        status: 'resolved',
        resolved_at: resolvedAt,
        resolution_note: 'Removed from live state because its sources are superseded or semantically unrelated.',
        updated_at: resolvedAt,
      }).eq('id', conflict.id).eq('property_id', propertyId);
      if (resolveError && !/relation|schema cache|column/i.test(resolveError.message || '')) {
        throw resolveError;
      }

      // A stale conflict row often left its field in the conflicting state.
      // Repair that projection at the same boundary so readiness and Review
      // Record cannot continue to block on a retired comparison.
      const field = (fields || []).find(candidate =>
        (conflict.field_id && candidate.id === conflict.field_id)
          || (candidate.field_key && candidate.field_key === conflict.field_key)
      );
      if (field && ['conflict', 'conflicting'].includes(String(field.status || '').toLowerCase())) {
        const { error: fieldError } = await supabase.from('transaction_record_fields')
          .update({
            status: field.verified_by ? 'verified' : 'extracted',
            updated_at: resolvedAt,
          })
          .eq('id', field.id)
          .eq('property_id', propertyId);
        if (fieldError && !/relation|schema cache|column/i.test(fieldError.message || '')) {
          throw fieldError;
        }
      }
    }

    // Older rooms can have only a field-level conflict status. Materialize one
    // durable row so every live blocker has the same provenance and Review
    // Discrepancy destination as newer rooms.
    const openFieldKeys = new Set((openConflicts || []).map(conflict => conflict.field_key).filter(Boolean));
    const activeDocumentIds = new Set(sourceDocuments.map(document => document.id).filter(Boolean));
    for (const field of fields || []) {
      const rawStatus = String(field.status || '').toLowerCase();
      if (!['conflict', 'conflicting', 'source_changed'].includes(rawStatus)) continue;
      if (field.source_doc_id && !activeDocumentIds.has(field.source_doc_id)) {
        const { error: staleFieldError } = await supabase.from('transaction_record_fields')
          .update({
            value_text: null,
            status: 'missing',
            source_doc_id: null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', field.id)
          .eq('property_id', propertyId);
        if (staleFieldError && !/relation|schema cache|column/i.test(staleFieldError.message || '')) {
          throw staleFieldError;
        }
        continue;
      }
      if (openFieldKeys.has(field.field_key)) continue;
      const candidate = Array.isArray(field.conflict_candidates) ? field.conflict_candidates[0] : null;
      const semantic = inferFactDefinition(field.field_key, null, field.display_label || '');
      const candidateComparison = compareComparableValues(
        normalizeComparableValue(field.value_text, semantic),
        normalizeComparableValue(candidate?.value ?? candidate?.value_text, semantic),
        semantic,
      );
      if (candidate && (candidateComparison.equivalent || !candidateComparison.comparable)) {
        const { error: compatibleFieldError } = await supabase.from('transaction_record_fields')
          .update({
            status: field.verified_by ? 'verified' : 'extracted',
            conflict_candidates: [],
            updated_at: new Date().toISOString(),
          })
          .eq('id', field.id)
          .eq('property_id', propertyId);
        if (compatibleFieldError && !/relation|schema cache|column/i.test(compatibleFieldError.message || '')) {
          throw compatibleFieldError;
        }
        continue;
      }
      const { error: backfillError } = await supabase.from('transaction_record_conflicts').insert({
        property_id: propertyId,
        field_id: field.id || null,
        field_key: field.field_key,
        display_label: field.display_label || field.field_key || 'Transaction Record field',
        canonical_value: field.value_text || null,
        conflicting_value: candidate?.value ?? candidate?.value_text
          ?? (rawStatus === 'source_changed' ? 'A newer source requires review' : null),
        canonical_source_doc_id: field.source_doc_id || null,
        conflicting_source_doc_id: candidate?.source_doc_id || candidate?.sourceDocId || null,
        canonical_source_page: field.source_page || null,
        conflicting_source_page: candidate?.source_page || candidate?.sourcePage || null,
        canonical_source_excerpt: field.source_excerpt || null,
        conflicting_source_excerpt: candidate?.source_excerpt || candidate?.sourceExcerpt || null,
        status: 'unresolved',
        updated_at: new Date().toISOString(),
      });
      if (backfillError && !/relation|schema cache|column/i.test(backfillError.message || '')) {
        throw backfillError;
      }
    }
    const candidates = sourceDocuments.flatMap(document =>
      storedDocumentAmounts(document).map(value => ({ ...value, document }))
    );
    // The verification engine is the durable source for older rooms: it may
    // have recognized a discrepancy from document summaries/metrics even when
    // those values are not present under repair-specific JSON keys.
    const verification = (documents || [])
      .filter(document => document.section === 'cross_document_verification')
      .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))[0];
    const sourceBySection = new Map(sourceDocuments.map(document => [document.section, document]));
    for (const check of verification?.analysis?.checks || []) {
      if (check?.status !== 'discrepancy') continue;
       const checkContext = `${check.id || ''} ${check.description || ''} ${check.doc_section_a || ''} ${check.doc_section_b || ''}`;
       const isRepairCheck = REPAIR_CONTEXT.test(
         checkContext
      );
      if (!isRepairCheck) continue;
       // Threshold/actual checks are valid verification relationships, but
       // they are not same-field repair-cost discrepancies. In particular,
       // policy limits must remain distinct from repair costs.
       if (/\b(?:policy|coverage|liability)\s+limit\b|\blimit\s+of\s+(?:coverage|liability)\b/i.test(checkContext)) continue;
      const valueA = parseAmount(check.value_a);
      const valueB = parseAmount(check.value_b);
      if (!valueA || !valueB || valueA === valueB) continue;
      const documentA = sourceBySection.get(check.doc_section_a) || {
        id: null, section: check.doc_section_a, filename: check.doc_section_a,
      };
      const documentB = sourceBySection.get(check.doc_section_b) || {
        id: null, section: check.doc_section_b, filename: check.doc_section_b,
      };
      candidates.push(
        { amount: valueA, excerpt: check.description || null, document: documentA },
        { amount: valueB, excerpt: check.description || null, document: documentB },
      );
    }
    if (candidates.length < 2) return;
    // Only evidence that can actually produce this field may reopen a resolved
    // conflict. An unrelated document uploaded later (for example a title
    // report) must not resurrect an already resolved repair-cost discrepancy.
    const latestEvidenceAt = latestEvidenceTimestamp(candidates);

    // Hazard-loss rooms can contain other insurance/adjuster amounts. When
    // both explicit repair evidence sections exist, never let an unrelated
    // dollar mention become the Transaction Record conflict.
    const repairSections = new Set(['contractor_documentation', 'repair_invoices']);
    const focusedCandidates = candidates.filter(item => repairSections.has(item.document?.section));
    const candidatePool = focusedCandidates.length >= 2
      ? focusedCandidates.sort((a, b) => {
        const rank = item => item.document?.section === 'contractor_documentation' ? 0 : 1;
        return rank(a) - rank(b);
      })
      : candidates;
    const repairFields = (fields || [])
      .filter(item => /repair[_ .-]?cost/i.test(item.field_key || '') || /repair costs/i.test(item.display_label || ''))
      .sort((a, b) => {
        const rank = item => item.field_key === 'transaction.repair_costs' ? 0 : item.field_key === 'financial.repair_costs' ? 1 : 2;
        return rank(a) - rank(b);
      });
    const field = repairFields[0] || null;
    const canonicalKey = field?.field_key || 'transaction.repair_costs';
    const canonicalAmount = parseAmount(field?.value_text) || candidatePool[0].amount;
    const canonicalCandidate = candidatePool.find(item => item.amount === canonicalAmount) || candidatePool[0];
    const different = candidatePool.find(item => item.amount !== canonicalAmount);
    if (!different) return;
    const canonicalSource = focusedCandidates.length >= 2
      ? (candidatePool.find(item =>
        item.amount === canonicalAmount && item.document?.section === 'contractor_documentation'
      ) || canonicalCandidate)
      : canonicalCandidate;
    const conflictingSource = focusedCandidates.length >= 2
      ? (candidatePool.find(item =>
        item.amount !== canonicalAmount && item.document?.section === 'repair_invoices'
      ) || different)
      : different;

    let fieldId = field?.id || null;
    if (!fieldId) {
      const { data: created, error } = await supabase.from('transaction_record_fields').insert({
        property_id: propertyId,
        field_key: canonicalKey,
        field_category: 'financial',
        display_label: 'Repair Costs',
        value_text: `$${Math.round(canonicalAmount).toLocaleString('en-US')}`,
        status: 'extracted',
        extracted_by: 'document_backfill',
        source_doc_id: canonicalCandidate.document.id,
        source_excerpt: canonicalCandidate.excerpt,
      }).select('id').single();
      if (error) throw error;
      fieldId = created?.id || null;
    }
    const { data: openConflict, error: conflictLookupError } = await supabase
      .from('transaction_record_conflicts')
      .select('id, field_key, status, resolved_at')
      .eq('property_id', propertyId)
      .ilike('display_label', 'Repair Costs')
      .order('updated_at', { ascending: false });
    if (conflictLookupError) {
      if (/relation|schema cache|column/i.test(conflictLookupError.message || '')) return;
      throw conflictLookupError;
    }
    if (shouldPreserveResolvedConflict({
      resolvedConflicts: openConflict || [],
      fieldKey: canonicalKey,
      latestEvidenceAt,
    })) return;
    const unresolvedConflict = (openConflict || []).find(conflict =>
      conflict.status === 'unresolved' && conflict.field_key === canonicalKey
    );
    const payload = {
      property_id: propertyId,
      field_id: fieldId,
      field_key: canonicalKey,
      display_label: field?.display_label || 'Repair Costs',
      canonical_value: field?.value_text || `$${Math.round(canonicalAmount).toLocaleString('en-US')}`,
      conflicting_value: `$${Math.round(different.amount).toLocaleString('en-US')}`,
       canonical_source_doc_id: canonicalSource.document.id || field?.source_doc_id || null,
       conflicting_source_doc_id: conflictingSource.document.id,
      canonical_source_page: field?.source_page || null,
      conflicting_source_page: null,
       canonical_source_excerpt: canonicalSource.excerpt,
       conflicting_source_excerpt: conflictingSource.excerpt,
      status: 'unresolved',
      updated_at: new Date().toISOString(),
    };
    const query = unresolvedConflict?.id
      ? supabase.from('transaction_record_conflicts').update(payload).eq('id', unresolvedConflict.id)
      : supabase.from('transaction_record_conflicts').insert(payload);
    const { error: saveError } = await query;
    if (saveError) throw saveError;
  } catch (error) {
    // Conflict migration rollout must not make every room unreadable.
    if (!/relation|schema cache|column/i.test(error.message || '')) {
      console.warn('[transaction-state] stored conflict reconciliation failed:', error.message);
    }
  }
}

let requirements = null;
function getRequirements() {
  if (!requirements) {
    requirements = require('../../shared/transaction_record_requirements.json');
  }
  return requirements;
}

async function resolveSchemaKey(room, resolvedPackId = null) {
  const generatedProposal = generatedProposalFromRoom(room);
  if (looksLikeGeneratedRoom(room, generatedProposal)) return 'generated_ai';
  const allRequirements = getRequirements();
  let schemaKey = resolvedPackId || resolvePackIdFromRoom(room);
  // Older generated hazard rooms may have lost their proposal JSON and may
  // only retain a structural custom pack. Do not reinterpret those rooms as
  // CRE just because the pack's generic transactionType is "lending"; their
  // persisted canonical rows are the authoritative generated definition.
  const roomText = [
    room?.property_name,
    room?.workflow_pack_id,
    room?.metadata_values?.workspace_name,
    room?.metadata_values?.transaction_description,
    room?.transaction_context?.description,
  ].filter(Boolean).join(' ').toLowerCase();
  if (/\bhazard\s+loss\b|\bcasualty\b|\binsurance\s+proceeds?\b/.test(roomText)) {
    return 'generated_ai';
  }
  if (!allRequirements[schemaKey] && String(schemaKey).startsWith('ws_')) {
    try {
      const { data } = await supabase
        .from('custom_workflow_packs')
        .select('config')
        .eq('id', schemaKey)
        .maybeSingle();
      const transactionType = data?.config?.transactionType;
      if (allRequirements[transactionType]) schemaKey = transactionType;
    } catch (error) {
      console.warn('[transaction-state] custom pack schema lookup failed:', error.message);
    }
  }
  return allRequirements[schemaKey] ? schemaKey : 'generic';
}

const CONFIRMED_RECORD_STATUSES = new Set(['verified', 'confirmed', 'source_changed']);
const AWAITING_RECORD_STATUSES = new Set(['extracted', 'needs_review', 'awaiting', 'awaiting_confirmation']);
const CONFLICT_RECORD_STATUSES = new Set(['conflicting', 'conflict']);
const EMPTY_RECORD_VALUES = new Set(['', 'n/a', 'na', 'not applicable', 'not_applicable', 'unknown']);

function hasMeaningfulRecordValue(field) {
  const value = String(field?.value_text || field?.value_json || field?.value || '').trim().toLowerCase();
  return !EMPTY_RECORD_VALUES.has(value) && field?.status !== 'not_applicable';
}

function normalizeRecordLabel(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ');
}

function generatedProposalFromRoom(room) {
  return room?.generated_proposal
    || room?.metadata_values?.generated_proposal
    || room?.transaction_context?.generated_proposal
    || null;
}

function normalizeRecordCategory(value, key = '', label = '') {
  const raw = String(value || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  const keyCategory = String(key || '').split('.')[0].toLowerCase();
  const category = raw || keyCategory || 'transaction';
  // Once a field has a canonical key, its namespace is authoritative. This
  // prevents a generated `hazard` category from moving canonical insurance
  // or repair fields into Transaction Terms.
  if (['transaction', 'asset', 'parties', 'ownership', 'financial', 'legal', 'approvals'].includes(keyCategory)) {
    return keyCategory === 'asset' ? 'asset_identity'
      : keyCategory === 'ownership' ? 'beneficial_ownership'
        : keyCategory;
  }
  if (['transaction', 'transaction_extra', 'terms', 'deal_terms', 'hazard', 'incident', 'loss', 'event', 'timeline'].includes(category)) return 'transaction';
  if (['asset', 'asset_identity', 'property', 'company', 'identity'].includes(category)) return 'asset_identity';
  if (['party', 'parties', 'counterparties'].includes(category)) return 'parties';
  if (['ownership', 'beneficial_ownership', 'cap_table'].includes(category)) return 'beneficial_ownership';
  if (['finance', 'financial', 'financials', 'economics', 'insurance', 'coverage', 'repairs', 'repair'].includes(category)) return 'financial';
  if (['legal', 'diligence', 'regulatory', 'document', 'documents', 'evidence'].includes(category)) return 'legal';
  if (['approval', 'approvals', 'signoff'].includes(category)) return 'approvals';
  const text = `${key} ${label}`.toLowerCase();
  if (/(repair|cost|amount|financial|insurance|coverage|proceeds|valuation)/.test(text)) return 'financial';
  if (/(incident|date|loss|event|deadline|closing|completion)/.test(text)) return 'transaction';
  return keyCategory || category;
}

function looksLikeGeneratedRoom(room, proposal = null) {
  return room?.workflow_pack_id === 'generated_ai'
    || room?.base_pack === 'generated_ai'
    || room?.transaction_type === 'generated_ai'
    || Array.isArray(proposal?.transaction_record_fields);
}

async function normalizeStoredTransactionRecord(propertyId, room, recordFields, schemaKey, proposal) {
  const fields = Array.isArray(recordFields) ? recordFields.map(field => ({ ...field })) : [];
  const now = Date.now();
  if (!propertyId || now - (recordNormalizeAt.get(propertyId) || 0) < 15000) return fields;
  recordNormalizeAt.set(propertyId, now);

  const definitions = Array.isArray(proposal?.transaction_record_fields)
    ? proposal.transaction_record_fields : [];
  const definitionByCanonicalKey = new Map();
  for (const definition of definitions) {
    const key = canonicalizeTransactionRecordKey(definition?.key, schemaKey);
    if (key && !definitionByCanonicalKey.has(key)) definitionByCanonicalKey.set(key, definition);
  }
  // Label matching remains a compatibility fallback for old rows that have no
  // usable key/definition metadata. It is deliberately not the primary join.
  const definitionByLabel = new Map();
  for (const definition of definitions) {
    const label = normalizeRecordLabel(definition.label || definition.display_label || definition.key);
    if (!label || definitionByLabel.has(label)) continue;
    definitionByLabel.set(label, definition);
  }
  const groups = new Map();
  for (const field of fields) {
    const originalKey = field.field_key;
    const canonicalKey = canonicalizeTransactionRecordKey(originalKey, schemaKey) || originalKey;
    const definition = looksLikeGeneratedRoom(room, proposal)
      ? definitionByCanonicalKey.get(canonicalKey)
        || definitionByCanonicalKey.get(canonicalizeTransactionRecordKey(field.definition_key, schemaKey))
        || definitionByLabel.get(normalizeRecordLabel(field.display_label))
      : null;
    field.field_key = canonicalKey;
    if (definition?.key) field.definition_key = definition.key;
    if (definition && field.is_required == null) field.is_required = definition.required !== false;
    if (definition?.label) field.display_label = definition.label;
    field.field_category = normalizeRecordCategory(
      definition?.category || field.field_category,
      canonicalKey,
      field.display_label,
    );
    if (!groups.has(canonicalKey)) groups.set(canonicalKey, []);
    groups.get(canonicalKey).push({ field, originalKey });
  }

  const canonical = [];
  const deleteWrites = [];
  const updateWrites = [];
  for (const [key, group] of groups) {
    group.sort((a, b) => {
      const rankDelta = recordStatusRank(b.field) - recordStatusRank(a.field);
      if (rankDelta) return rankDelta;
      if ((a.field.field_key === key) !== (b.field.field_key === key)) {
        return a.field.field_key === key ? -1 : 1;
      }
      return new Date(b.field.updated_at || b.field.created_at || 0)
        - new Date(a.field.updated_at || a.field.created_at || 0);
    });
    const winner = group[0].field;
    const generatedDefinition = looksLikeGeneratedRoom(room, proposal)
      ? definitionByCanonicalKey.get(key)
      : null;
    // An extracted row may outrank an empty generated row. Carry the
    // generated definition metadata onto that value so requiredness,
    // category, provenance identity, and confirmation all remain attached to
    // the same canonical winner.
    if (generatedDefinition?.key) winner.definition_key = generatedDefinition.key;
    if (generatedDefinition && winner.is_required == null) {
      winner.is_required = generatedDefinition.required !== false;
    }
    if (generatedDefinition?.label) winner.display_label = generatedDefinition.label;
    if (generatedDefinition?.category) {
      winner.field_category = normalizeRecordCategory(
        generatedDefinition.category,
        key,
        generatedDefinition.label,
      );
    }
    canonical.push(winner);
    const original = recordFields.find(field => field.id === winner.id);
    for (const duplicate of group.slice(1)) {
      if (duplicate.field.id) {
        deleteWrites.push(supabase.from('transaction_record_fields')
          .delete().eq('id', duplicate.field.id).eq('property_id', propertyId));
      }
    }
    if (winner.id && original && (
      winner.field_key !== original.field_key
      || winner.definition_key !== original.definition_key
      || winner.field_category !== original.field_category
      || winner.display_label !== original.display_label
      || winner.is_required !== original.is_required
    )) {
      updateWrites.push(supabase.from('transaction_record_fields').update({
        field_key: winner.field_key,
        definition_key: winner.definition_key || null,
        field_category: winner.field_category || String(key).split('.')[0] || 'transaction',
        display_label: winner.display_label || key,
        is_required: winner.is_required !== false,
        updated_at: new Date().toISOString(),
      }).eq('id', winner.id).eq('property_id', propertyId));
    }
  }
  if (deleteWrites.length) {
    const results = await Promise.all(deleteWrites);
    const failed = results.find(result => result.error);
    if (failed?.error && !/column|schema cache|relation/i.test(failed.error.message || '')) {
      console.warn('[transaction-state] record normalization write failed:', failed.error.message);
    }
  }
  if (updateWrites.length) {
    const results = await Promise.all(updateWrites);
    const failed = results.find(result => result.error);
    if (failed?.error && !/column|schema cache|relation/i.test(failed.error.message || '')) {
      console.warn('[transaction-state] record normalization update failed:', failed.error.message);
    }
  }
  return canonical;
}

async function reconcileConfirmedFieldHistory(propertyId) {
  if (!propertyId) return;
  try {
    const [
      { data: history, error: historyError },
      { data: fields, error: fieldsError },
      { data: activity, error: activityError },
    ] = await Promise.all([
      supabase.from('transaction_record_history')
        .select('field_id, event_type, new_value, new_status, metadata, created_at')
        .eq('property_id', propertyId)
        .order('created_at', { ascending: true }),
      supabase.from('transaction_record_fields')
        .select('id, value_text, status, updated_at')
        .eq('property_id', propertyId),
      supabase.from('deal_events')
        .select('event_type, description, metadata, created_at')
        .eq('property_id', propertyId)
        .in('event_type', ['field_verified', 'transaction_record_verified'])
        .order('created_at', { ascending: true }),
    ]);
    if (historyError || fieldsError) {
      const message = historyError?.message || fieldsError?.message || '';
      if (!/relation|schema cache|column/i.test(message)) console.warn('[transaction-state] confirmation history lookup failed:', message);
      return;
    }
    const fieldsById = new Map((fields || []).map(field => [field.id, field]));
    const latestByField = new Map();
    for (const event of history || []) {
      if (event?.field_id) latestByField.set(event.field_id, event);
    }
    // Very old rooms only recorded the confirmation in the activity stream.
    // Recover the same persisted row when the event carries an ID/key, or when
    // its description names exactly one field label.
    for (const event of activityError ? [] : (activity || [])) {
      const metadata = event?.metadata && typeof event.metadata === 'object' ? event.metadata : {};
      const metadataId = metadata.field_id || metadata.fieldId;
      const metadataKey = metadata.field_key || metadata.fieldKey;
      const description = normalizeRecordLabel(event?.description);
      const match = metadataId
        ? fieldsById.get(metadataId)
        : (fields || []).find(field =>
          (metadataKey && field.field_key === metadataKey)
            || (description && description.includes(`${normalizeRecordLabel(field.display_label)} was confirmed`))
        );
      const prior = match ? latestByField.get(match.id) : null;
      if (match && (!prior || new Date(event.created_at || 0).getTime() >= new Date(prior.created_at || 0).getTime())) {
        latestByField.set(match.id, {
          field_id: match.id,
          event_type: 'confirmed',
          new_value: metadata.new_value ?? metadata.value ?? match.value_text,
          new_status: 'verified',
          created_at: event.created_at,
        });
      }
    }
    for (const [fieldId, event] of latestByField) {
      const field = fieldsById.get(fieldId);
      const status = String(field?.status || '').toLowerCase();
      const historyStatus = String(event?.new_status || '').toLowerCase();
      if (
        !field
        || event.event_type !== 'confirmed'
        || event?.metadata?.verification_kind === 'manual_provenance_approval'
        || !['verified', 'confirmed'].includes(historyStatus)
      ) continue;
      // A newer source conflict is intentionally not repaired from old
      // history; it needs the coordinator's current decision.
      if (['conflicting', 'conflict', 'source_changed'].includes(status)) continue;
      const value = event.new_value == null ? field.value_text : String(event.new_value).slice(0, 2000);
      const fieldUpdatedAt = new Date(field.updated_at || 0).getTime();
      const eventCreatedAt = new Date(event.created_at || 0).getTime();
      if (
        fieldUpdatedAt >= eventCreatedAt
        && String(field.value_text ?? field.value_json ?? '') === String(value ?? '')
        && ['verified', 'confirmed'].includes(status)
      ) continue;
      const { error } = await supabase.from('transaction_record_fields')
        .update({
          value_text: value,
          status: 'verified',
          verified_at: event.created_at || new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', fieldId)
        .eq('property_id', propertyId);
      if (error && !/relation|schema cache|column/i.test(error.message || '')) throw error;
    }
  } catch (error) {
    if (!/relation|schema cache|column/i.test(error.message || '')) {
      console.warn('[transaction-state] confirmed field history reconciliation failed:', error.message);
    }
  }
}

function normalizeTransactionConflicts(conflicts) {
  return (Array.isArray(conflicts) ? conflicts : [])
    .filter(conflict => String(conflict?.status || 'unresolved').toLowerCase() === 'unresolved')
    .map(conflict => ({
      id: conflict.id || null,
      propertyId: conflict.property_id || null,
      fieldId: conflict.field_id || null,
      fieldKey: conflict.field_key || null,
      label: conflict.display_label || conflict.field_key || 'Transaction Record field',
      canonicalValue: conflict.canonical_value ?? null,
      conflictingValue: conflict.conflicting_value ?? null,
      canonicalSourceDocId: conflict.canonical_source_doc_id || null,
      conflictingSourceDocId: conflict.conflicting_source_doc_id || null,
      canonicalSourcePage: conflict.canonical_source_page || null,
      conflictingSourcePage: conflict.conflicting_source_page || null,
      canonicalSourceExcerpt: conflict.canonical_source_excerpt || null,
      conflictingSourceExcerpt: conflict.conflicting_source_excerpt || null,
      status: 'unresolved',
      createdAt: conflict.created_at || null,
      updatedAt: conflict.updated_at || conflict.created_at || null,
    }));
}

function isConflictSupportedByActiveEvidence(conflict, documents = []) {
  const activeDocuments = selectActiveDocumentVersions(documents || []);
  const activeIds = new Set(activeDocuments.map(document => document.id).filter(Boolean));
  const sourceIds = [
    conflict?.canonical_source_doc_id,
    conflict?.conflicting_source_doc_id,
  ].filter(Boolean);
  // A conflict whose evidence was replaced is historical, not a live blocker.
  if (sourceIds.some(id => !activeIds.has(id))) return false;

  const semantic = inferFactDefinition(
    conflict?.field_key || '',
    null,
    conflict?.display_label || '',
  );
  const conflictComparison = compareComparableValues(
    normalizeComparableValue(conflict?.canonical_value, semantic),
    normalizeComparableValue(conflict?.conflicting_value, semantic),
    semantic,
  );
  // A generic document reference, or two compatible values from different
  // metadata dimensions (for example monthly versus July 2026), is not a
  // live Transaction Record discrepancy.
  if (conflictComparison.equivalent || !conflictComparison.comparable) return false;
  if (!sourceIds.length) return true;
  if (!semantic || String(semantic.semanticKey || '').startsWith('metric:')) return true;
  const referencedDocuments = activeDocuments.filter(document => sourceIds.includes(document.id));
  const referencedFacts = referencedDocuments.flatMap(document => extractFacts(document));
  // Lightweight/legacy analyses may not retain structured metrics. Do not
  // discard a conflict merely because its evidence cannot be re-extracted.
  if (!referencedFacts.length) return true;
  const matchingFacts = referencedFacts.filter(fact =>
    fact.semantic_key === semantic.semanticKey
  );
  // If active documents contain structured facts but none belong to the
  // conflict's semantic key, the persisted row is an unrelated comparison.
  if (!matchingFacts.length) return false;

  const thresholdFacts = matchingFacts.filter(fact =>
    fact.relationship === semantic.relationship
    && ['threshold', 'actual'].includes(fact.role)
  );
  // A policy threshold and a reported actual are a relationship check, not a
  // same-field Transaction Record conflict. The verification snapshot keeps
  // that finding visible without blocking the canonical record.
  if (semantic.relationship && thresholdFacts.length >= 2) return false;

  const values = matchingFacts
    .map(fact => fact.value)
    .filter(value => Number.isFinite(value));
  if (values.length >= 2) {
    const first = values[0];
    return values.some(value => Math.abs(value - first) > Math.max(0.01, Math.abs(first) * 0.0001));
  }
  return true;
}

function recordStatusRank(field) {
  const status = String(field?.status || '').toLowerCase();
  if (CONFLICT_RECORD_STATUSES.has(status)) return 5;
  if (CONFIRMED_RECORD_STATUSES.has(status)) return 4;
  if (AWAITING_RECORD_STATUSES.has(status)) return 3;
  if (hasMeaningfulRecordValue(field)) return 2;
  if (status === 'not_applicable') return 1;
  return 0;
}

/**
 * Resolve one authoritative state for every canonical Transaction Record key.
 * Older rooms can contain aliases or legacy "confirmed" rows, while newer
 * extraction writes canonical keys and uses "verified".
 */
function computeTransactionRecordState(recordFields, schemaKey, requiredKeysOverride = null, conflicts = []) {
  const allRequirements = getRequirements();
  const requiredDefinitions = requiredKeysOverride || allRequirements[schemaKey] || [];
  const requiredKeys = [...new Set(requiredDefinitions.map(field =>
    typeof field === 'string' ? field : field?.key
  ).filter(Boolean))];
  const canonicalKey = field => canonicalizeTransactionRecordKey(field, schemaKey);
  const byKey = new Map();

  for (const field of recordFields || []) {
    const key = canonicalKey(field?.field_key);
    if (!key) continue;
    const current = byKey.get(key);
    const isCanonical = field.field_key === key;
    const currentIsCanonical = current?.field?.field_key === key;
    const rank = recordStatusRank(field);
    // A verified value wins over a stale extracted alias row. A canonical row
    // wins over an alias when both rows have the same state.
    if (!current || rank > current.rank || (rank === current.rank && isCanonical && !currentIsCanonical)) {
      byKey.set(key, { field, rank });
    }
  }

  const fields = [...byKey.entries()].map(([key, entry]) => {
    const field = entry.field;
    const rawStatus = String(field.status || '').toLowerCase();
    const status = CONFLICT_RECORD_STATUSES.has(rawStatus)
      ? 'conflict'
      : CONFIRMED_RECORD_STATUSES.has(rawStatus)
        ? 'confirmed'
        : AWAITING_RECORD_STATUSES.has(rawStatus)
          ? 'awaiting'
          : rawStatus === 'not_applicable'
            ? 'not_applicable'
             : hasMeaningfulRecordValue(field)
               ? 'awaiting'
              : 'missing';
    return {
      key,
      fieldId: field.id || null,
      persistedKey: field.field_key || key,
      definitionKey: field.definition_key || key,
      category: normalizeRecordCategory(
        field.field_category,
        field.field_key || key,
        field.display_label,
      ),
      label: field.display_label || key,
      value: field.value_text || field.value_json || null,
      status,
      rawStatus: rawStatus || null,
      attention: rawStatus === 'source_changed' ? 'source_changed' : null,
      required: requiredKeys.includes(key),
      isRequired: field.is_required !== false,
      sourceType: field.source_type || null,
      sourceDocId: field.source_doc_id || null,
      sourceDocVersion: field.source_doc_version || null,
      sourceFileHash: field.source_file_hash || null,
      sourcePage: field.source_page || null,
      sourceExcerpt: field.source_excerpt || null,
      extractionTimestamp: field.extraction_timestamp || null,
      verifiedBy: field.verified_by || null,
      verifiedRole: field.verified_role || null,
      verifiedAt: field.verified_at || null,
      source_document: field.source_document || field.source_file || field.source_doc_id || null,
      source_file: field.source_file || null,
      confidence: field.confidence ?? null,
      conflictCandidates: Array.isArray(field.conflict_candidates) ? field.conflict_candidates : [],
      updatedAt: field.updated_at || field.created_at || null,
    };
  });

  const fieldByKey = new Map(fields.map(field => [field.key, field]));
  const requiredLabelByKey = new Map(requiredDefinitions
    .filter(field => field && typeof field === 'object' && field.key && field.label)
    .map(field => [canonicalKey(field.key), normalizeRecordLabel(field.label)]));
  const fieldByLabel = new Map();
  for (const field of fields) {
    const label = normalizeRecordLabel(field.label);
    if (!label || fieldByLabel.has(label)) {
      if (label) fieldByLabel.set(label, null);
      continue;
    }
    fieldByLabel.set(label, field);
  }
  const notApplicableKeys = new Set(fields
    .filter(field => field.status === 'not_applicable')
    .map(field => field.key));
  const activeRequiredKeys = requiredKeys.filter(key => !notApplicableKeys.has(key));
  const requiredFields = activeRequiredKeys.map(key => {
    const label = requiredLabelByKey.get(canonicalKey(key));
    const matchedByLabel = label ? fieldByLabel.get(label) : null;
    const matched = fieldByKey.get(key) || matchedByLabel;
    if (matched) {
      return {
        ...matched,
        definitionKey: matched.definition_key || key,
        required: true,
        isRequired: matched.is_required !== false,
      };
    }
    return {
      key,
      definitionKey: key,
      fieldId: null,
      persistedKey: key,
      category: String(key).split('.')[0] || 'transaction',
      label: requiredDefinitions.find(field =>
        (typeof field === 'object' ? field?.key : field) === key
      )?.label || key,
      value: null,
      status: 'missing',
      rawStatus: null,
      attention: null,
      required: true,
      isRequired: true,
      sourceType: null,
      conflictCandidates: [],
      updatedAt: null,
    };
  });
  const count = (items, status) => items.filter(field => field.status === status).length;
  const confirmedCount = count(requiredFields, 'confirmed');
  const awaitingRequiredCount = count(requiredFields, 'awaiting');
  const missingRequiredCount = count(requiredFields, 'missing');

  const unresolvedConflicts = normalizeTransactionConflicts(conflicts);
  const conflictKeys = new Set(unresolvedConflicts.map(conflict => conflict.fieldKey).filter(Boolean));
  // Some legacy rooms persisted the field as conflicting but never created the
  // durable conflict row. Preserve that live blocker so Review Record and
  // Review Discrepancy cannot disagree after hydration.
  for (const field of fields) {
    if (!['conflict', 'conflicting', 'source_changed'].includes(field.rawStatus)) continue;
    if (conflictKeys.has(field.key)) continue;
    unresolvedConflicts.push({
      id: `field-conflict:${field.fieldId || field.key}`,
      propertyId: null,
      fieldId: field.fieldId || null,
      fieldKey: field.key,
      label: field.label,
      canonicalValue: field.value,
      conflictingValue: field.conflictCandidates?.[0]?.value
        || field.conflictCandidates?.[0]?.value_text
        || (field.rawStatus === 'source_changed' ? 'A newer source requires review' : null),
      canonicalSourceDocId: field.sourceDocId || null,
      conflictingSourceDocId: field.conflictCandidates?.[0]?.source_doc_id
        || field.conflictCandidates?.[0]?.sourceDocId
        || null,
      canonicalSourcePage: field.sourcePage || null,
      conflictingSourcePage: field.conflictCandidates?.[0]?.source_page || null,
      canonicalSourceExcerpt: field.sourceExcerpt || null,
      conflictingSourceExcerpt: field.conflictCandidates?.[0]?.source_excerpt || null,
      status: 'unresolved',
      legacyFieldOnly: true,
      createdAt: field.updatedAt || null,
      updatedAt: field.updatedAt || null,
    });
    conflictKeys.add(field.key);
  }
  return {
    schemaKey,
    fields,
    requiredFields,
    requiredCount: requiredFields.length,
    confirmedCount,
    awaitingCount: count(fields, 'awaiting'),
    awaitingRequiredCount,
    awaitingOptionalCount: Math.max(0, count(fields, 'awaiting') - awaitingRequiredCount),
    missingCount: count(fields, 'missing'),
    missingRequiredCount,
    conflictCount: fields.filter(field => field.status === 'conflict' || field.attention === 'source_changed').length
      + unresolvedConflicts.filter(conflict => !fields.some(field =>
        field.key === conflict.fieldKey && (field.status === 'conflict' || field.attention === 'source_changed')
      )).length,
    conflictRequiredCount: requiredFields.filter(field =>
      field.status === 'conflict' || field.attention === 'source_changed'
    ).length + unresolvedConflicts.filter(conflict =>
      requiredKeys.includes(conflict.fieldKey)
      && !requiredFields.some(field => field.key === conflict.fieldKey
        && (field.status === 'conflict' || field.attention === 'source_changed'))
    ).length,
    unresolvedConflicts,
    unresolvedConflictCount: unresolvedConflicts.length,
    unresolvedConflictKeys: [...conflictKeys],
    notApplicableCount: notApplicableKeys.size,
    activeRequiredKeys,
  };
}

function computeTransactionReadiness(room, recordFields, schemaKey, requiredKeysOverride = null, conflicts = []) {
  const recordState = computeTransactionRecordState(recordFields, schemaKey, requiredKeysOverride, conflicts);
  const populated = recordState.fields.filter(field =>
    field.status === 'confirmed' && hasMeaningfulRecordValue(field)
  );
  const confirmedCount = recordState.confirmedCount;
  const requiredCount = recordState.requiredCount;
  const overall = requiredCount > 0 ? Math.round((confirmedCount / requiredCount) * 100) : 0;
  const overallLabel = overall >= 80
    ? 'Closing Ready'
    : overall >= 55
      ? 'Needs Review'
      : overall === 0
        ? 'Getting Started'
        : 'Needs Attention';
  const tokenizationGuidance = buildTokenizationGuidance({
    recordState,
    recordFields,
    enabled: true,
  });
  const confirmedTokenizationInputs = tokenizationGuidance.known.filter(field =>
    ['verified', 'confirmed'].includes(field.status)
  ).length;
  const digitalAssetPercent = Math.min(
    100,
    Math.round((confirmedTokenizationInputs / tokenizationGuidance.inputCount) * 100),
  );
  const digitalAssetSufficient = tokenizationGuidance.complete;

  return {
    overall,
    overallLabel,
    confirmedCount,
    requiredCount,
    notApplicableCount: recordState.notApplicableCount,
    digitalAssetPercent,
    digitalAssetSufficient,
    digitalAssetConfirmedInputCount: confirmedTokenizationInputs,
    digitalAssetRequiredInputCount: tokenizationGuidance.inputCount,
    digitalAssetGapCount: tokenizationGuidance.gaps.length,
    populatedCount: populated.length,
    unresolvedConflictCount: recordState.unresolvedConflictCount,
    hasBlockingConflicts: recordState.unresolvedConflictCount > 0,
    approvalReady: recordState.unresolvedConflictCount === 0,
    fundReleaseReady: recordState.unresolvedConflictCount === 0,
    approvalBlockedReason: recordState.unresolvedConflictCount > 0
      ? 'Resolve all material Transaction Record conflicts before approval.'
      : null,
    fundReleaseBlockedReason: recordState.unresolvedConflictCount > 0
      ? 'Resolve all material Transaction Record conflicts before fund release.'
      : null,
    recordState,
    categories: [{ name: 'Structured Transaction Record', weight: 1, score: overall }],
  };
}

const HAZARD_LOSS_REPAIR_REQUIREMENTS = [
  'transaction.incident_date',
  'financial.insurance_proceeds',
  'financial.repair_costs',
];

function isImmediateLifecycleAdvance(stages, currentStage, requestedStage) {
  if (currentStage === requestedStage) return true;
  // Preserve the legacy settlement migration path documented by the advance
  // endpoint: older rooms at funded may still enter settlement.
  if (currentStage === 'funded' && requestedStage === 'settlement') return true;
  const orderedStages = Array.isArray(stages) ? stages : [];
  const currentIndex = orderedStages.findIndex(stage => stage?.key === currentStage);
  const requestedIndex = orderedStages.findIndex(stage => stage?.key === requestedStage);
  return currentIndex >= 0 && requestedIndex === currentIndex + 1;
}

function getHazardLossRepairGate(state) {
  const recordState = state?.recordState || state?.readiness?.recordState || {};
  const packId = state?.schemaKey || 'generic';
  const fields = [
    ...(Array.isArray(recordState.fields) ? recordState.fields : []),
    ...(Array.isArray(recordState.requiredFields) ? recordState.requiredFields : []),
    ...(Array.isArray(state?.recordFields) ? state.recordFields : []),
  ];
  const labels = {
    'transaction.incident_date': /incident\s*date/i,
    'financial.insurance_proceeds': /insurance\s*proceeds/i,
    'financial.repair_costs': /repair\s*costs?/i,
  };
  const unmetFields = HAZARD_LOSS_REPAIR_REQUIREMENTS.filter(key => {
    const field = fields.find(item => canonicalizeTransactionRecordKey(
      item?.key || item?.field_key || item?.persistedKey || item?.definitionKey,
      packId,
    ) === key) || fields.find(item => labels[key]?.test(
      String(item?.label || item?.display_label || ''),
    ));
    const status = String(field?.status || field?.rawStatus || '').toLowerCase();
    const value = field?.value ?? field?.value_text ?? field?.value_json;
    return !field || !['confirmed', 'verified'].includes(status) || !String(value ?? '').trim();
  });
  const unresolvedConflicts = Number(recordState.unresolvedConflictCount || 0);
  return {
    ok: unmetFields.length === 0 && unresolvedConflicts === 0,
    unmetFields,
    unresolvedConflicts,
  };
}

async function readTransactionState(propertyId) {
  // Hydration is also a verification boundary. A room can outlive the
  // verification row that was written before its active document set changed.
  // Rebuild that projection before reconciling durable Transaction Record
  // conflicts, while keeping a readable record state if verification is
  // temporarily unavailable during migration.
  try {
    await getVerificationState(propertyId);
  } catch (error) {
    if (!/relation|schema cache|column/i.test(error.message || '')) {
      console.warn('[transaction-state] verification hydration failed:', error.message);
    }
  }
  await reconcileStoredDocumentConflicts(propertyId);
  await reconcileConfirmedFieldHistory(propertyId);
  const roomQuery = supabase
    .from('deal_rooms')
    .select('id, property_id, property_name, deal_amount, closing_date, workflow_pack_id, base_pack, transaction_type, transaction_subtype, transaction_context, generated_proposal, deal_type, deal_stage, jurisdiction, metadata_values, checklist_items, settlement_mode, settlement_readiness_pct, settlement_mode_locked_at, sealed_at, completed_at')
    .eq('property_id', propertyId)
    .maybeSingle();
  const [{ data: initialRoom, error: initialRoomError }, fieldsResult, conflictsResult] = await Promise.all([
    roomQuery,
    supabase
      .from('transaction_record_fields')
       .select('id, field_key, definition_key, field_category, display_label, value_text, value_json, status, is_required, source_type, conflict_candidates, source_doc_id, source_doc_version, source_file_hash, source_page, source_excerpt, extraction_timestamp, verified_by, verified_role, verified_at, confidence, updated_at, created_at')
      .eq('property_id', propertyId),
    supabase
      .from('transaction_record_conflicts')
      .select('*')
      .eq('property_id', propertyId)
      .eq('status', 'unresolved')
      .order('updated_at', { ascending: false }),
  ]);
  let recordFields = fieldsResult.data;
  let fieldsError = fieldsResult.error;
  if (fieldsError && /column|schema cache/i.test(fieldsError.message || '')) {
    const legacyFields = await supabase
      .from('transaction_record_fields')
      .select('id, field_key, field_category, display_label, value_text, status, source_doc_id, source_page, source_excerpt, confidence, updated_at, created_at')
      .eq('property_id', propertyId);
    recordFields = legacyFields.data;
    fieldsError = legacyFields.error;
  }
  let room = initialRoom;
  let roomError = initialRoomError;
  if (roomError && /column|schema cache|base_pack|generated_proposal/i.test(roomError.message || '')) {
    const legacy = await supabase
      .from('deal_rooms')
      .select('id, property_id, property_name, deal_amount, closing_date, workflow_pack_id, deal_type, deal_stage, jurisdiction, metadata_values, checklist_items, settlement_mode, settlement_readiness_pct, settlement_mode_locked_at, sealed_at, completed_at')
      .eq('property_id', propertyId)
      .maybeSingle();
    room = legacy.data;
    roomError = legacy.error;
  }
  if (roomError) throw roomError;
  if (fieldsError) throw fieldsError;
  // Migration 023 is additive. Keep older template rooms readable while the
  // conflict table is being rolled out to an environment.
  const conflicts = conflictsResult?.error
    ? (/relation|schema cache|column/i.test(conflictsResult.error.message || '') ? [] : (() => { throw conflictsResult.error; })())
    : (conflictsResult?.data || []);
  const packId = resolvePackIdFromRoom(room);
  let schemaKey = await resolveSchemaKey(room, packId);
  const generatedProposal = generatedProposalFromRoom(room);
  // A legacy generated room may have lost its proposal JSON but still retain
  // its generated definition/category keys. Recover that identity from the
  // durable rows before selecting the required-field denominator.
  if (schemaKey !== 'generated_ai' && (
    looksLikeGeneratedRoom(room, generatedProposal)
    || (recordFields || []).some(field =>
      /^(hazard|insurance|repairs|repair|loss)\./i.test(
        `${field.definition_key || ''} ${field.field_key || ''}`,
      ))
  )) {
    schemaKey = 'generated_ai';
  }
  recordFields = await normalizeStoredTransactionRecord(
    propertyId, room, recordFields || [], schemaKey, generatedProposal,
  );
  const dynamicRequiredKeys = schemaKey === 'generated_ai'
     ? ((recordFields || []).some(field => field.definition_key)
       ? (recordFields || []).filter(field => field.is_required !== false).map(field => ({
         key: field.field_key,
         definitionKey: field.definition_key || field.field_key,
         label: field.display_label,
         category: field.field_category || String(field.field_key || '').split('.')[0] || 'transaction',
         required: field.is_required !== false,
       }))
       : (generatedProposal?.transaction_record_fields || [])
         .filter(field => field.required !== false)
         .map(field => ({
           key: field.key,
           label: field.label,
           category: field.category || field.field_category || String(field.key || '').split('.')[0] || 'transaction',
           required: field.required !== false,
         })))
    : null;
   const recordState = computeTransactionRecordState(recordFields || [], schemaKey, dynamicRequiredKeys, conflicts);
  return {
    room,
    recordFields: recordFields || [],
    schemaKey,
    packId,
    stage: room?.deal_stage || null,
    readiness: computeTransactionReadiness(room, recordFields || [], schemaKey, dynamicRequiredKeys, conflicts),
    conflicts: normalizeTransactionConflicts(conflicts),
    recordState,
  };
}

async function recalculateTransactionState(propertyId, options = {}) {
  const correlationId = options.correlationId || crypto.randomUUID();
  const before = options.before || await readTransactionState(propertyId);
  let createdTasks = [];
  let createdReadinessTasks = [];

  if (options.evaluateTasks !== false) {
    createdTasks = await evaluateDealRoomForTasks(propertyId, { correlationId });
    const currentTasks = await listTasksForRoom(propertyId);
    createdReadinessTasks = await evaluateReadinessTasks(propertyId, currentTasks, { correlationId });
  }

  const after = await readTransactionState(propertyId);
  const { clearCache } = require('./operationsManager');
  clearCache(propertyId);
  const payload = {
    propertyId,
    roomId: after.room?.id || null,
    packId: after.packId,
    stageKey: after.stage,
    readiness: after.readiness,
    beforeReadiness: before.readiness,
    createdTaskCount: createdTasks.length + createdReadinessTasks.length,
    correlationId,
    source: options.source || 'transaction_state',
  };
  emit('transaction_state.recalculated', payload, {
    correlationId,
    source: options.source || 'transaction_state',
    orgId: after.room?.org_id || null,
    actorId: options.actorId || null,
    actorType: options.actorType || null,
  });
  logEvent(
    propertyId,
    'transaction_state_recalculated',
    options.actorType || 'system',
    options.actorId || null,
    `Transaction state recalculated from ${options.source || 'transaction_state'}`,
    {
      correlationId,
      source: options.source || 'transaction_state',
      before: before.readiness,
      after: after.readiness,
      createdTaskCount: payload.createdTaskCount,
    },
  ).catch(() => {});
  return {
    ...payload,
    changed: before.readiness.overall !== after.readiness.overall
      || before.recordFields.length !== after.recordFields.length,
    state: after,
  };
}

module.exports = {
  getRequirements,
  resolveSchemaKey,
  computeTransactionReadiness,
  computeTransactionRecordState,
  isConflictSupportedByActiveEvidence,
  getHazardLossRepairGate,
  isImmediateLifecycleAdvance,
  reconcileStoredDocumentConflicts,
  reconcileConfirmedFieldHistory,
  hasMeaningfulRecordValue,
  shouldPreserveResolvedConflict,
  latestEvidenceTimestamp,
  readTransactionState,
  recalculateTransactionState,
};