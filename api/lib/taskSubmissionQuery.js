'use strict';

const WITH_STATUS_COLUMNS = 'role, email, name, status, doc_count, submitted_at';
const WITHOUT_STATUS_COLUMNS = 'role, email, name, doc_count, submitted_at';

function isMissingSubmissionStatus(error) {
  if (!error) return false;
  const message = [
    error.message,
    error.details,
    error.hint,
  ].filter(Boolean).join(' ').toLowerCase();
  const missingColumn = /(?:column|field).{0,100}\bstatus\b.{0,100}(?:does not exist|not found|schema cache)/
    .test(message)
    || /(?:could not find|unknown).{0,100}\bstatus\b.{0,100}party_submissions/
      .test(message);
  return missingColumn;
}

async function loadTaskSubmissions(client, propertyId) {
  const withStatus = await client
    .from('party_submissions')
    .select(WITH_STATUS_COLUMNS)
    .eq('property_id', propertyId);

  if (!isMissingSubmissionStatus(withStatus.error)) return withStatus;

  return client
    .from('party_submissions')
    .select(WITHOUT_STATUS_COLUMNS)
    .eq('property_id', propertyId);
}

module.exports = {
  isMissingSubmissionStatus,
  loadTaskSubmissions,
};
