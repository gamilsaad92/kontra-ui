'use strict';

const {
  preserveCanonicalEvidence,
  sourceExcerptSupportsValue,
} = require('./transactionProvenance');

describe('Transaction Record provenance integrity', () => {
  test('preserves all existing canonical evidence, including explicit nulls', () => {
    expect(preserveCanonicalEvidence({
      confidence: null,
      display_label: 'Buyer',
      extracted_by: 'approved_generated_proposal',
      source_doc_id: null,
      source_doc_version: null,
      source_excerpt: null,
      source_file_hash: null,
      source_page: null,
      source_type: null,
    })).toEqual({
      confidence: null,
      display_label: 'Buyer',
      extracted_by: 'approved_generated_proposal',
      source_doc_id: null,
      source_doc_version: null,
      source_excerpt: null,
      source_file_hash: null,
      source_page: null,
      source_type: null,
    });
  });

  test('preserves complete source and confidence metadata from the canonical candidate', () => {
    expect(preserveCanonicalEvidence({
      confidence: 0.82,
      display_label: 'Buyer',
      extracted_by: 'ai',
      source_doc_id: 'canonical-document',
      source_doc_version: 'canonical-v2',
      source_excerpt: 'Buyer: Redwood Capital Partners LLC',
      source_file_hash: 'canonical-hash',
      source_page: 3,
      source_type: 'document',
    })).toEqual({
      confidence: 0.82,
      display_label: 'Buyer',
      extracted_by: 'ai',
      source_doc_id: 'canonical-document',
      source_doc_version: 'canonical-v2',
      source_excerpt: 'Buyer: Redwood Capital Partners LLC',
      source_file_hash: 'canonical-hash',
      source_page: 3,
      source_type: 'document',
    });
  });

  test.each([
    ['$1,450,000', 'Estimated Buyer Funds Due: $1,450,000.'],
    ['Redwood Capital Partners LLC', 'Buyer is Redwood Capital Partners, LLC.'],
  ])('recognizes a literal candidate value in its own excerpt', (value, excerpt) => {
    expect(sourceExcerptSupportsValue(value, excerpt)).toBe(true);
  });

  test.each([
    ['Redwood Capital Partners LLC', 'Buyer: Redwood Test Acquisitions LLC (fictional).'],
    ['$1,450,000', 'Estimated Buyer Funds Due: $1,250,000.'],
    ['Yes', 'The party yesterday reported no approval.'],
    ['Redwood Capital Partners LLC', ''],
  ])('does not treat inconsistent or absent excerpts as value support', (value, excerpt) => {
    expect(sourceExcerptSupportsValue(value, excerpt)).toBe(false);
  });
});
