'use strict';

const CANONICAL_EVIDENCE_FIELDS = [
  'confidence',
  'display_label',
  'extracted_by',
  'source_doc_id',
  'source_doc_version',
  'source_excerpt',
  'source_file_hash',
  'source_page',
  'source_type',
];

function preserveCanonicalEvidence(field = {}) {
  return Object.fromEntries(CANONICAL_EVIDENCE_FIELDS.map(key => [
    key,
    field[key] ?? null,
  ]));
}

function evidenceTokens(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .toLocaleLowerCase('en-US')
    .match(/[\p{L}\p{N}]+/gu) || [];
}

/**
 * Use a conservative literal token-sequence check before claiming that a
 * selected canonical value is supported by its own source excerpt. Ambiguous
 * or paraphrased excerpts remain reviewable instead of being auto-verified.
 */
function sourceExcerptSupportsValue(value, excerpt) {
  const expected = evidenceTokens(value);
  const actual = evidenceTokens(excerpt);
  if (!expected.length || !actual.length) return false;
  if (expected.length === 1 && expected[0].length < 3) return false;
  if (expected.length > actual.length) return false;
  for (let start = 0; start <= actual.length - expected.length; start += 1) {
    if (expected.every((token, index) => token === actual[start + index])) return true;
  }
  return false;
}

module.exports = {
  preserveCanonicalEvidence,
  sourceExcerptSupportsValue,
};
