'use strict';

const SCHEMA_COMPATIBILITY_ERROR = /column|schema cache|does not exist|could not find/i;

/**
 * Load participant submissions across the additive party_submissions schema.
 *
 * Older production databases do not have status. A failed select on that
 * optional column must not make the otherwise valid submission rows disappear.
 */
async function loadParticipantSubmissions(supabase, propertyId, { includeEmail = false } = {}) {
  const selects = includeEmail
    ? [
      'role, email, name, status, doc_count, submitted_at',
      'role, email, name, doc_count, submitted_at',
    ]
    : [
      'role, name, status, doc_count, submitted_at',
      'role, name, doc_count, submitted_at',
    ];
  let lastError = null;

  for (const select of selects) {
    const result = await supabase
      .from('party_submissions')
      .select(select)
      .eq('property_id', propertyId);
    if (!result.error) return result.data || [];

    lastError = result.error;
    if (!SCHEMA_COMPATIBILITY_ERROR.test(result.error.message || '')) break;
  }

  if (lastError) {
    console.warn('[participant-submissions] could not load submissions:', lastError.message);
  }
  return [];
}

module.exports = {
  loadParticipantSubmissions,
};