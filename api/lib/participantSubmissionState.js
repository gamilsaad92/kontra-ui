'use strict';

/**
 * A successful participant document upload is also a participant submission.
 * Keep this write separate from the document evidence projection so every
 * upload path can update the durable participant state consistently.
 */
async function syncParticipantSubmissionFromDocument({
  supabase,
  propertyId,
  role,
  email = null,
  name = null,
} = {}) {
  if (!supabase || !propertyId || !role) return null;

  const existingResult = await supabase
    .from('party_submissions')
    .select('name, email, doc_count, submitted_at, notes')
    .eq('property_id', propertyId)
    .eq('role', role)
    .maybeSingle();
  if (existingResult.error) throw existingResult.error;

  let documentCount = null;
  const countResult = await supabase
    .from('deal_analyses')
    .select('id', { count: 'exact', head: true })
    .eq('property_id', propertyId)
    .eq('uploaded_by_role', role);
  if (!countResult.error) {
    documentCount = countResult.count;
  } else {
    const legacyCount = await supabase
      .from('deal_analyses')
      .select('id')
      .eq('property_id', propertyId)
      .eq('uploaded_by_role', role);
    if (legacyCount.error) throw legacyCount.error;
    documentCount = Array.isArray(legacyCount.data) ? legacyCount.data.length : null;
  }

  const existing = existingResult.data || {};
  const now = new Date().toISOString();
  const payload = {
    property_id: propertyId,
    role,
    name: existing.name || name || role,
    email: existing.email || email || null,
    doc_count: Number.isFinite(Number(documentCount))
      ? Number(documentCount)
      : Number(existing.doc_count || 0) + 1,
    submitted_at: now,
    notes: existing.notes || null,
  };
  const { data, error } = await supabase
    .from('party_submissions')
    .upsert(payload, { onConflict: 'property_id,role' })
    .select('property_id, role, doc_count, submitted_at')
    .maybeSingle();
  if (error) throw error;
  return data || payload;
}

function deriveParticipantSubmissionRows(submissions = [], analyses = []) {
  const rowsByRole = new Map(
    (Array.isArray(submissions) ? submissions : [])
      .filter(row => row?.role)
      .map(row => [String(row.role).trim().toLowerCase().replace(/\s+/g, '_'), row]),
  );
  const evidenceByRole = new Map();

  (Array.isArray(analyses) ? analyses : []).forEach(analysis => {
    const role = String(analysis?.uploaded_by_role || '').trim().toLowerCase().replace(/\s+/g, '_');
    if (!role || analysis?.section === 'cross_document_verification') return;
    const processingStatus = String(analysis?.processing_status || '').toLowerCase();
    if (processingStatus === 'failed' || analysis?.analysis?.pending === true) return;
    const evidence = evidenceByRole.get(role) || [];
    evidence.push(analysis);
    evidenceByRole.set(role, evidence);
  });

  for (const [role, evidence] of evidenceByRole.entries()) {
    const existing = rowsByRole.get(role);
    const latestEvidence = evidence
      .slice()
      .sort((left, right) => new Date(right.created_at || 0) - new Date(left.created_at || 0))[0];
    const evidenceCount = evidence.length;
    const existingCount = Number(existing?.doc_count || 0);
    const derived = {
      role: existing?.role || role,
      name: existing?.name || role,
      email: existing?.email || null,
      doc_count: Math.max(existingCount, evidenceCount),
      submitted_at: existing?.submitted_at || latestEvidence?.created_at || null,
      notes: existing?.notes || null,
      submissionSource: existing ? 'recorded_submission_and_role_evidence' : 'role_uploaded_evidence',
    };
    rowsByRole.set(role, existing ? { ...existing, ...derived } : derived);
  }

  return [...rowsByRole.values()];
}

module.exports = {
  deriveParticipantSubmissionRows,
  syncParticipantSubmissionFromDocument,
};
