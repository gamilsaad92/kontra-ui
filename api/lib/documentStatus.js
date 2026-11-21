'use strict';

const {
  selectActiveDocumentVersions,
  isSuccessfulDocumentVersion,
} = require('./documentVersions');
const {
  getDocumentClassification,
  matchesChecklistDocumentClassification,
  normalizeDocumentClassification,
} = require('./documentClassification');

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
  return normalizeDocumentClassification(value);
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
  const classification = getDocumentClassification(analysis);
  const classificationLabel = normalizeDocumentClassification(classification?.label);
  const classificationCandidates = Array.isArray(classification?.candidates)
    ? [...new Set(classification.candidates.map(normalizeDocumentClassification).filter(Boolean))]
    : [];
  const classificationNeedsReview = !classification
    || classification.ambiguous === true
    || !classificationLabel
    || ['ambiguous', 'other', 'unknown', 'unclassified', 'unclear'].includes(classificationLabel)
    || (classification.source === 'ai' && classification.validation_status !== 'validated')
    || classificationCandidates.length > 1
    || (classificationCandidates.length === 1 && classificationCandidates[0] !== classificationLabel);
  return analysis.analysis?.pending === true
    || DOCUMENT_PROCESSING_STATUSES.has(processingStatus)
    || processingStatus === 'failed'
    || !isSuccessfulDocumentVersion(analysis)
    || classificationNeedsReview
    || DOCUMENT_REVIEW_STATUSES.has(reviewStatus)
    || analysis.analysis?.needs_review === true
    || analysis.analysis?.needsReview === true;
}

function hasStoredNonAiChecklistReceipt(requirement, analysis) {
  if (requirement?.ai !== false || !isSuccessfulDocumentVersion(analysis)) return false;

  const requiredSection = normalizedDocumentText(
    requirement.section
      || requirement.id
      || requirement.document_id
      || requirement.documentId,
  );
  const uploadedSection = normalizedDocumentText(analysis.section);
  const storagePath = String(analysis.storage_path || analysis.storagePath || '').trim();
  return Boolean(requiredSection && uploadedSection === requiredSection && storagePath);
}

function checklistEvidenceForRequirement(requirement, analysis) {
  if (!isSuccessfulDocumentVersion(analysis)) return null;

  if (requirement?.ai === false) {
    return hasStoredNonAiChecklistReceipt(requirement, analysis)
      ? {
        evidenceType: 'upload_receipt',
        validationStatus: 'not_required',
        aiClassificationValidated: false,
      }
      : null;
  }

  if (!matchesChecklistDocumentClassification(requirement, analysis)) return null;
  const classification = getDocumentClassification(analysis);
  const aiClassificationValidated = classification?.source === 'ai'
    && classification.validation_status === 'validated';
  return {
    evidenceType: aiClassificationValidated ? 'ai_classification_match' : 'legacy_classification',
    validationStatus: aiClassificationValidated ? 'classification_validated' : 'legacy',
    aiClassificationValidated,
  };
}

function validationStatusForCandidate(analysis) {
  const status = normalizedDocumentStatus(
    analysis?.processing_status || analysis?.analysis?.processing_status,
  );
  if (status === 'failed') return 'failed';
  if (DOCUMENT_PROCESSING_STATUSES.has(status)) return 'processing';
  return 'unverified';
}

function activeDocumentEvidenceState(analysis, checklist = []) {
  const matchingRequirements = (Array.isArray(checklist) ? checklist : [])
    .filter(requirement => documentRequirementMatchesAnalysis(requirement, analysis));
  const evidence = matchingRequirements
    .map(requirement => checklistEvidenceForRequirement(requirement, analysis))
    .find(Boolean);
  const hasNonAiRequirement = matchingRequirements.some(requirement => requirement.ai === false);
  const hasAiRequirement = matchingRequirements.some(requirement => requirement.ai !== false);
  const classification = getDocumentClassification(analysis);
  const classificationIsValidated = isSuccessfulDocumentVersion(analysis)
    && classification?.source === 'ai'
    && classification.validation_status === 'validated'
    && classification.ambiguous !== true;
  const legacyClassification = isSuccessfulDocumentVersion(analysis)
    && classification?.source === 'legacy_ai';
  const classificationMismatch = !hasNonAiRequirement
    && hasAiRequirement
    && isSuccessfulDocumentVersion(analysis)
    && classificationIsValidated
    && !matchingRequirements.some(requirement =>
      requirement.ai !== false && matchesChecklistDocumentClassification(requirement, analysis)
    );

  if (evidence) {
    return {
      documentState: 'received',
      documentEvidenceType: evidence.evidenceType,
      documentValidationStatus: evidence.validationStatus,
      documentAiClassificationValidated: evidence.aiClassificationValidated === true,
    };
  }

  const documentState = matchingRequirements.length > 0 || analysisNeedsReview(analysis)
    ? 'needs_review'
    : 'received';
  const exposeClassification = !hasNonAiRequirement;
  let documentEvidenceType = 'unverified_upload';
  if (classificationMismatch) {
    documentEvidenceType = 'classification_mismatch';
  } else if (exposeClassification && classificationIsValidated && !hasAiRequirement) {
    documentEvidenceType = 'ai_classification';
  } else if (exposeClassification && legacyClassification) {
    documentEvidenceType = 'legacy_classification';
  }

  return {
    documentState,
    documentEvidenceType,
    documentValidationStatus: classificationMismatch
      ? 'mismatch'
      : documentState === 'needs_review'
        ? validationStatusForCandidate(analysis)
        : legacyClassification
          ? 'legacy'
          : classificationIsValidated ? 'classification_validated' : 'unverified',
    documentAiClassificationValidated: exposeClassification && classificationIsValidated,
  };
}

function projectDocumentRequirement(requirement, activeAnalyses = []) {
  const requirementStatus = normalizedDocumentStatus(requirement?.status);
  const candidates = (Array.isArray(activeAnalyses) ? activeAnalyses : [])
    .filter(analysis => documentRequirementMatchesAnalysis(requirement, analysis));
  const validCandidates = candidates.filter(analysis =>
    checklistEvidenceForRequirement(requirement, analysis),
  );
  const currentValid = validCandidates.filter(analysis =>
    analysis.is_active !== false && !analysis.superseded_at
  );
  const evidenceCandidates = currentValid.length > 0 ? currentValid : validCandidates;
  const matchedAnalysis = evidenceCandidates
    .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))[0] || null;
  const currentCandidate = candidates
    .filter(analysis => analysis.is_active !== false && !analysis.superseded_at)
    .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))[0]
    || [...candidates].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))[0]
    || null;
  const notApplicable = ['not_applicable', 'na', 'n_a'].includes(requirementStatus)
    || requirement?.notApplicable === true;

  if (notApplicable) {
    return {
      status: 'not_applicable',
      received: false,
      needsReview: false,
      evidenceType: null,
      validationStatus: 'not_applicable',
      aiClassificationValidated: false,
      analysis: null,
      candidateAnalysis: null,
    };
  }

  if (matchedAnalysis) {
    const evidence = checklistEvidenceForRequirement(requirement, matchedAnalysis);
    return {
      status: 'received',
      received: true,
      needsReview: false,
      evidenceType: evidence.evidenceType,
      validationStatus: evidence.validationStatus,
      aiClassificationValidated: evidence.aiClassificationValidated === true,
      analysis: matchedAnalysis,
      candidateAnalysis: currentCandidate,
    };
  }

  const needsReview = DOCUMENT_REVIEW_STATUSES.has(requirementStatus) || !!currentCandidate;
  const candidateStatus = currentCandidate
    ? validationStatusForCandidate(currentCandidate)
    : needsReview ? 'needs_review' : 'missing';
  return {
    status: needsReview ? 'needs_review' : 'missing',
    received: false,
    needsReview,
    evidenceType: currentCandidate ? 'unverified_upload' : null,
    validationStatus: candidateStatus,
    aiClassificationValidated: false,
    analysis: null,
    candidateAnalysis: currentCandidate,
  };
}

/**
 * The coordinator and AI must make document-status decisions from this
 * projection, not from independent template or checklist heuristics.
 *
 * `analyses` may contain historical rows. A validated current version can
 * satisfy a requirement; a previously validated version remains valid while
 * its replacement is still pending or has failed.
 */
function projectDocumentChecklist(checklist = [], analyses = []) {
  const activeAnalyses = selectActiveDocumentVersions(analyses);
  const activeDocumentStates = activeAnalyses.map(analysis => ({
    ...analysis,
    ...activeDocumentEvidenceState(analysis, checklist),
  }));
  const items = (Array.isArray(checklist) ? checklist : []).map(item => {
    const state = projectDocumentRequirement(item, analyses);
    return {
      ...item,
      documentState: state.status,
      documentReceived: state.received,
      documentNeedsReview: state.needsReview,
      documentEvidenceType: state.evidenceType,
      documentValidationStatus: state.validationStatus,
      documentAiClassificationValidated: state.aiClassificationValidated,
    };
  });
  const missingDocuments = items
    .filter(item => item.required
      && (item.documentState === 'missing'
        || (item.documentState === 'needs_review' && item.documentReceived !== true)))
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
  normalizeDocumentClassification,
  projectDocumentRequirement,
  projectDocumentChecklist,
};