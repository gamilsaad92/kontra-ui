'use strict';

const { selectActiveDocumentVersions } = require('./documentVersions');

const DOCUMENT_RECEIVED_STATUSES = new Set([
  'uploaded',
  'processing',
  'retrying',
  'analyzing',
  'analyzed',
  'complete',
  'completed',
  'approved',
  'ai_complete',
  'received',
  'extracted',
]);

const DOCUMENT_REVIEW_STATUSES = new Set([
  'needs_review',
  'under_review',
  'review',
  'pending_review',
]);

const DOCUMENT_PROCESSING_STATUSES = new Set([
  'uploaded',
  'processing',
  'retrying',
  'analyzing',
]);

function normalizedDocumentText(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ');
}

function normalizedDocumentStatus(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
}

function documentIdentityValues(document, fields) {
  return fields
    .map(field => normalizedDocumentText(document?.[field]))
    .filter(Boolean);
}

function documentRequirementMatchesAnalysis(requirement, analysis) {
  if (!requirement || !analysis) return false;

  const requirementIds = documentIdentityValues(requirement, [
    'id',
    'document_id',
    'documentId',
    'section',
    'category',
    'sourceSuggestionId',
  ]);
  const analysisIds = documentIdentityValues(analysis, [
    'id',
    'document_id',
    'documentId',
    'section',
    'category',
  ]);
  if (requirementIds.some(value => analysisIds.includes(value))) return true;

  const requirementLabels = documentIdentityValues(requirement, [
    'label',
    'name',
    'document_type',
    'documentType',
  ]);
  const analysisLabels = [
    ...documentIdentityValues(analysis, [
      'filename',
      'document_type',
      'documentType',
    ]),
    ...documentIdentityValues(analysis.analysis, [
      'document_type',
      'documentType',
      'title',
      'documentTitle',
    ]),
  ];
  return requirementLabels.some(label =>
    analysisLabels.some(candidate =>
      label === candidate
        || (label.length > 2 && candidate.includes(label))
        || (candidate.length > 2 && label.includes(candidate)),
    )
  );
}

function analysisNeedsReview(analysis) {
  if (!analysis) return false;
  const processingStatus = normalizedDocumentStatus(analysis.processing_status);
  const reviewStatus = normalizedDocumentStatus(
    analysis.review_status || analysis.document_status || analysis.status,
  );
  return analysis.analysis?.pending === true
    || DOCUMENT_PROCESSING_STATUSES.has(processingStatus)
    || processingStatus === 'failed'
    || DOCUMENT_REVIEW_STATUSES.has(reviewStatus)
    || analysis.analysis?.needs_review === true
    || analysis.analysis?.needsReview === true;
}

function projectDocumentRequirement(requirement, activeAnalyses = []) {
  const requirementStatus = normalizedDocumentStatus(requirement?.status);
  const matchedAnalysis = activeAnalyses.find(analysis =>
    documentRequirementMatchesAnalysis(requirement, analysis)
  ) || null;
  const received = requirement?.uploaded === true
    || requirement?.uploaded === 'true'
    || DOCUMENT_RECEIVED_STATUSES.has(requirementStatus)
    || DOCUMENT_REVIEW_STATUSES.has(requirementStatus)
    || !!matchedAnalysis;
  const notApplicable = ['not_applicable', 'na', 'n_a'].includes(requirementStatus)
    || requirement?.notApplicable === true;

  if (notApplicable) {
    return {
      status: 'not_applicable',
      received: false,
      needsReview: false,
      analysis: null,
    };
  }

  if (!received) {
    return {
      status: 'missing',
      received: false,
      needsReview: false,
      analysis: null,
    };
  }

  const needsReview = DOCUMENT_REVIEW_STATUSES.has(requirementStatus)
    || analysisNeedsReview(matchedAnalysis);
  return {
    status: needsReview ? 'needs_review' : 'received',
    received: true,
    needsReview,
    analysis: matchedAnalysis,
  };
}

/**
 * The coordinator and AI must make document-status decisions from this
 * projection, not from independent template or checklist heuristics.
 *
 * `analyses` may contain historical rows; only the active version for each
 * section is allowed to satisfy a current checklist requirement.
 */
function projectDocumentChecklist(checklist = [], analyses = []) {
  const activeAnalyses = selectActiveDocumentVersions(analyses);
  const activeDocumentStates = activeAnalyses.map(analysis => ({
    ...analysis,
    documentState: analysisNeedsReview(analysis) ? 'needs_review' : 'received',
  }));
  const items = (Array.isArray(checklist) ? checklist : []).map(item => {
    const state = projectDocumentRequirement(item, activeAnalyses);
    return {
      ...item,
      documentState: state.status,
      documentReceived: state.received,
      documentNeedsReview: state.needsReview,
    };
  });
  const missingDocuments = items
    .filter(item => item.required && item.documentState === 'missing')
    .slice(0, 30)
    .map(item => ({
      id: item.id || item.document_id || item.documentId || null,
      label: item.label || item.name || item.id || 'Required document',
      section: item.section || item.category || null,
    }));

  return {
    activeAnalyses,
    activeDocumentStates,
    items,
    missingDocuments,
  };
}

module.exports = {
  DOCUMENT_RECEIVED_STATUSES,
  DOCUMENT_REVIEW_STATUSES,
  normalizedDocumentText,
  normalizedDocumentStatus,
  documentRequirementMatchesAnalysis,
  analysisNeedsReview,
  projectDocumentRequirement,
  projectDocumentChecklist,
};