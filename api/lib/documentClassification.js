'use strict';

const INVALID_CLASSIFICATIONS = new Set([
  'ambiguous',
  'other',
  'unknown',
  'unclassified',
  'unclear',
]);

function normalizeDocumentClassification(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ');
}

function classificationValues(value) {
  const values = Array.isArray(value) ? value : [value];
  return values
    .filter(item => typeof item === 'string')
    .map(item => item.trim())
    .filter(Boolean);
}

function buildAiDocumentClassification(analysis = {}, validationStatus = 'pending') {
  const candidates = [
    ...classificationValues(analysis.doc_type),
    ...classificationValues(analysis.document_type),
    ...classificationValues(analysis.documentType),
  ];
  const unique = [...new Map(
    candidates
      .map(label => [normalizeDocumentClassification(label), label])
      .filter(([normalized]) => normalized),
  ).values()];
  const normalized = unique.map(normalizeDocumentClassification);
  const explicitlyAmbiguous = analysis.classification_ambiguous === true
    || analysis.ambiguous === true
    || (Array.isArray(analysis.doc_type_candidates) && analysis.doc_type_candidates.length > 1);
  const ambiguous = explicitlyAmbiguous
    || unique.length !== 1
    || normalized.some(label => INVALID_CLASSIFICATIONS.has(label));

  return {
    source: 'ai',
    label: ambiguous ? null : unique[0],
    candidates: unique,
    ambiguous,
    validation_status: validationStatus,
  };
}

function getDocumentClassification(document) {
  const stored = document?.analysis?.document_classification
    || document?.document_classification;
  if (stored && stored.source === 'ai') return stored;

  // Do not infer a classification from documentType: the lightweight uploader
  // writes the section label there even when no content analysis ran.
  const legacyLabel = document?.analysis?.doc_type
    || document?.analysis?.document_type
    || document?.doc_type
    || document?.document_type;
  if (typeof legacyLabel === 'string' && legacyLabel.trim()) {
    return {
      source: 'legacy_ai',
      label: legacyLabel.trim(),
      candidates: [legacyLabel.trim()],
      ambiguous: false,
      validation_status: 'legacy',
    };
  }

  return null;
}

function getExpectedDocumentTypes(requirement = {}) {
  requirement = requirement || {};
  const extraction = requirement.aiExtraction || requirement.ai_extraction || {};
  const configured = [
    extraction.docTypes,
    extraction.documentTypes,
    requirement.expectedDocumentTypes,
    requirement.expected_document_types,
    requirement.docTypes,
    requirement.documentTypes,
  ].flatMap(classificationValues);
  const explicit = [
    requirement.document_type,
    requirement.documentType,
    extraction.documentType,
    extraction.document_type,
  ].flatMap(classificationValues);
  const fallback = [requirement.label, requirement.name].flatMap(classificationValues);
  const expected = configured.length ? configured : explicit.length ? explicit : fallback;
  return [...new Map(
    expected
      .map(label => [normalizeDocumentClassification(label), label])
      .filter(([normalized]) => normalized),
  ).values()];
}

function matchesChecklistDocumentClassification(requirement, document) {
  const classification = getDocumentClassification(document);
  if (!classification || classification.ambiguous === true) return false;
  if (classification.source === 'ai'
    && classification.validation_status !== 'validated') return false;

  const label = normalizeDocumentClassification(classification.label);
  if (!label || INVALID_CLASSIFICATIONS.has(label)) return false;
  const candidates = [...new Set(
    classificationValues(classification.candidates)
      .map(normalizeDocumentClassification)
      .filter(Boolean),
  )];
  if (candidates.length > 1 || (candidates.length === 1 && candidates[0] !== label)) return false;

  const expected = getExpectedDocumentTypes(requirement)
    .map(normalizeDocumentClassification)
    .filter(Boolean);
  return expected.includes(label);
}

module.exports = {
  buildAiDocumentClassification,
  getDocumentClassification,
  getExpectedDocumentTypes,
  matchesChecklistDocumentClassification,
  normalizeDocumentClassification,
};
