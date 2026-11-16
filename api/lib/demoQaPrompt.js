const {
  isTokenizationQuestion,
  buildTokenizationGuidance,
  buildTokenizationPrompt,
  buildFixtureTransactionContext,
} = require('./tokenizationGuidance');

function buildDemoQaSystemPrompt(basePrompt, fixture, question) {
  const canonicalFields = fixture?.record?.record_state?.fields
    || fixture?.record?.fields
    || [];
  const populatedFields = canonicalFields
    .filter(field => field && (field.key || field.field_key)
      && field.value !== null
      && field.value !== undefined
      && String(field.value).trim())
    .map(field => ({
      key: field.key || field.field_key,
      label: field.label || field.display_label || field.key || field.field_key,
      value: field.value,
      status: field.status || null,
    }));

  const factsPrompt = populatedFields.length
    ? `${basePrompt}\n\nCanonical Transaction Record facts (authoritative):\n`
      + `${JSON.stringify(populatedFields, null, 2)}\n`
      + 'Use these canonical values for transaction facts. Respect each field status; '
      + 'do not describe a value awaiting review or in conflict as confirmed.'
    : basePrompt;

  if (!isTokenizationQuestion(question)) return factsPrompt;
  const guidance = buildTokenizationGuidance({
    transactionContext: buildFixtureTransactionContext(fixture),
  });
  return `${factsPrompt}\n\n${buildTokenizationPrompt(guidance)}`;
}

module.exports = { buildDemoQaSystemPrompt };
