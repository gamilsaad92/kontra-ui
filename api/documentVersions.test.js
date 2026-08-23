const {
  selectActiveDocumentVersions,
  isActiveDocumentVersion,
  replacementHistoryBySection,
} = require('./lib/documentVersions');
const {
  computeTransactionRecordState,
} = require('./lib/transactionState');

describe('document version selection', () => {
  const initial = {
    id: 'insurance-v1',
    section: 'insurance_claim_documentation',
    filename: 'claim-original.pdf',
    created_at: '2026-08-20T09:00:00.000Z',
    is_active: false,
    superseded_at: '2026-08-21T09:00:00.000Z',
  };
  const replacement = {
    id: 'insurance-v2',
    section: 'insurance_claim_documentation',
    filename: 'claim-replacement.pdf',
    created_at: '2026-08-21T09:00:00.000Z',
    is_active: true,
  };

  it('uses only the replacement as the active evidence source while preserving history', () => {
    const active = selectActiveDocumentVersions([
      initial,
      replacement,
      { id: 'title-v1', section: 'title', created_at: '2026-08-20T10:00:00.000Z' },
    ]);

    expect(active).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'insurance-v2' }),
      expect.objectContaining({ id: 'title-v1' }),
    ]));
    expect(active).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'insurance-v1' }),
    ]));

    expect(replacementHistoryBySection([initial, replacement])
      .insurance_claim_documentation)
      .toEqual([
        expect.objectContaining({ id: 'insurance-v1', version: 1, active: false }),
        expect.objectContaining({ id: 'insurance-v2', version: 2, active: true }),
      ]);
  });

  it('keeps legacy rows compatible by selecting the newest version per section', () => {
    expect(selectActiveDocumentVersions([
      { id: 'v1', section: 'legal', created_at: '2026-08-20T09:00:00.000Z' },
      { id: 'v2', section: 'legal', created_at: '2026-08-21T09:00:00.000Z' },
    ])).toEqual([expect.objectContaining({ id: 'v2' })]);
  });

  it('marks a superseded source inactive so a late extraction job cannot use it', () => {
    expect(isActiveDocumentVersion(initial)).toBe(false);
    expect(isActiveDocumentVersion(replacement)).toBe(true);
  });

  it('supports reject, replacement, and awaiting-confirmation evidence lifecycle', () => {
    const replacementSource = {
      ...replacement,
      processing_status: 'extracted',
      source_hash: 'replacement-hash',
    };
    expect(selectActiveDocumentVersions([
      initial,
      replacementSource,
    ])).toEqual([expect.objectContaining({ id: 'insurance-v2' })]);

    // Reject/clear removes the original extracted candidate from canonical state.
    const rejected = computeTransactionRecordState([{
      id: 'proceeds-field',
      field_key: 'financial.insurance_proceeds',
      display_label: 'Insurance Proceeds',
      value_text: null,
      status: 'missing',
      source_doc_id: null,
    }], 'generated_ai', [{
      key: 'financial.insurance_proceeds',
      label: 'Insurance Proceeds',
      required: true,
    }]);
    expect(rejected.requiredFields[0]).toEqual(expect.objectContaining({ status: 'missing' }));

    // Extraction from the active replacement restores a reviewable candidate;
    // it does not auto-confirm the value.
    const replacementExtracted = computeTransactionRecordState([{
      id: 'proceeds-field',
      field_key: 'financial.insurance_proceeds',
      display_label: 'Insurance Proceeds',
      value_text: '$325,000',
      status: 'extracted',
      source_doc_id: replacementSource.id,
    }], 'generated_ai', [{
      key: 'financial.insurance_proceeds',
      label: 'Insurance Proceeds',
      required: true,
    }]);
    expect(replacementExtracted.requiredFields[0]).toEqual(expect.objectContaining({
      value: '$325,000',
      status: 'awaiting',
    }));
  });
});