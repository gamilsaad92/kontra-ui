'use strict';

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
    // prior successful version, however, the upload is still live evidence
    // and must remain visible as received rather than appearing missing.
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
  const status = String(analysis.processing_status || '').toLowerCase();
  if (status === 'failed' || status === 'uploaded' || status === 'processing' || status === 'retrying') return false;
  if (analysis.analysis?.pending === true) return false;
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
  isSuccessfulDocumentVersion,
  isActiveDocumentVersion,
  replacementHistoryBySection,
};