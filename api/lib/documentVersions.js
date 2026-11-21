'use strict';

const SUCCESSFUL_DOCUMENT_STATUSES = new Set([
  'ai_complete',
  'analyzed',
  'approved',
  'complete',
  'completed',
  'extracted',
  'received',
]);

/**
 * Returns the single authoritative document version for each requirement
 * section. Superseded records remain in the input for audit/history callers,
 * but must not influence current summaries, checks, or extracted evidence.
 *
 * Legacy rows have no active marker; for them the most recently created row
 * remains the active version, matching the pre-versioning UI behavior.
 */
function selectActiveDocumentVersions(analyses = []) {
  const activeBySection = new Map();
  const fallbackBySection = new Map();
  const hasExplicitVersionState = (analyses || []).some(analysis =>
    analysis && Object.prototype.hasOwnProperty.call(analysis, 'is_active')
  );

  for (const analysis of analyses || []) {
    if (!analysis || analysis.section === 'cross_document_verification') continue;
    if (!isActiveDocumentVersion(analysis)) continue;
    // During rollout, some databases expose the processing columns but not
    // the version columns. A failed or still-pending row must not hide the
    // previously successful version in that legacy projection. If there is no
    // prior successful version, keep the upload visible for review; checklist
    // validity is decided separately from its processing and classification.
    if (!hasExplicitVersionState && !isSuccessfulDocumentVersion(analysis)) {
      const existingFallback = fallbackBySection.get(analysis.section);
      const currentTime = new Date(analysis.created_at || 0).getTime();
      const existingTime = new Date(existingFallback?.created_at || 0).getTime();
      if (!existingFallback || currentTime >= existingTime) {
        fallbackBySection.set(analysis.section, analysis);
      }
      continue;
    }

    const existing = activeBySection.get(analysis.section);
    const currentTime = new Date(analysis.created_at || 0).getTime();
    const existingTime = new Date(existing?.created_at || 0).getTime();
    if (!existing || currentTime >= existingTime) {
      activeBySection.set(analysis.section, analysis);
    }
  }

  for (const [section, analysis] of fallbackBySection.entries()) {
    if (!activeBySection.has(section)) activeBySection.set(section, analysis);
  }
  return [...activeBySection.values()];
}

function isSuccessfulDocumentVersion(analysis) {
  if (!analysis) return false;
  const status = String(
    analysis.processing_status || analysis.analysis?.processing_status || '',
  ).trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (!SUCCESSFUL_DOCUMENT_STATUSES.has(status)) return false;
  if (analysis.analysis?.pending === true
    || analysis.analysis?.needs_review === true
    || analysis.analysis?.needsReview === true) return false;
  const classificationStatus = analysis.analysis?.document_classification?.validation_status;
  if (classificationStatus && classificationStatus !== 'validated') return false;
  return true;
}

function isActiveDocumentVersion(analysis) {
  return Boolean(analysis)
    && analysis.is_active !== false
    && !analysis.superseded_at;
}

function replacementHistoryBySection(analyses = []) {
  const history = {};
  const counters = {};

  for (const analysis of analyses || []) {
    if (!analysis || analysis.section === 'cross_document_verification') continue;
    counters[analysis.section] = (counters[analysis.section] || 0) + 1;
    if (!history[analysis.section]) history[analysis.section] = [];
    history[analysis.section].push({
      id: analysis.id,
      version: counters[analysis.section],
      filename: analysis.filename,
      uploaded_by_role: analysis.uploaded_by_role,
      created_at: analysis.created_at,
      active: analysis.is_active !== false && !analysis.superseded_at,
      superseded_at: analysis.superseded_at || null,
    });
  }

  return history;
}

module.exports = {
  selectActiveDocumentVersions,
  SUCCESSFUL_DOCUMENT_STATUSES,
  isSuccessfulDocumentVersion,
  isActiveDocumentVersion,
  replacementHistoryBySection,
};