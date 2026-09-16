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
    .select('name, email, status, doc_count, submitted_at, notes')
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
    status: 'submitted',
    doc_count: Number.isFinite(Number(documentCount))
      ? Number(documentCount)
      : Number(existing.doc_count || 0) + 1,
    submitted_at: now,
    notes: existing.notes || null,
  };
  const { data, error } = await supabase
    .from('party_submissions')
    .upsert(payload, { onConflict: 'property_id,role' })
    .select('property_id, role, status, doc_count, submitted_at')
    .maybeSingle();
  if (error) throw error;
  return data || payload;
}

module.exports = {
  syncParticipantSubmissionFromDocument,
};