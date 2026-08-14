const {
  canonicalizeTransactionRecordKey,
  aliasKeysForCanonical,
  canonicalTransactionTypeLabel,
} = require('./lib/transactionRecordCanonicalization');

describe('Transaction Record canonicalization', () => {
  test.each([
    ['transaction.target_closing_date', 'transaction.closing_date', 'business_acquisition'],
    ['financial.annual_revenue', 'financial.revenue', 'business_acquisition'],
    ['asset_identity.legal_name', 'asset.legal_name', 'business_acquisition'],
    ['asset_identity.legal_name', 'asset.name', 'cre_acquisition'],
    ['asset_identity.legal_name', 'asset.issuer', 'fundraising'],
    ['beneficial_ownership.owners', 'ownership.existing_owners', 'business_acquisition'],
    ['financial.purchase_price', 'transaction.purchase_price', 'business_acquisition'],
  ])('%s maps to %s for %s', (alias, canonical, packId) => {
    expect(canonicalizeTransactionRecordKey(alias, packId)).toBe(canonical);
  });

  test('returns one canonical destination and its known aliases', () => {
    expect(aliasKeysForCanonical('transaction.closing_date', 'business_acquisition'))
      .toEqual(expect.arrayContaining([
        'transaction.closing_date',
        'transaction.target_closing_date',
        'transaction.target_close_date',
      ]));
  });

  test.each([
    ['cre_acquisition', 'cre_acquisition', 'Business Acquisition', 'Commercial Real Estate Acquisition'],
    ['business_acquisition', 'business_acquisition', 'Commercial Real Estate Acquisition', 'Business Acquisition'],
    ['fundraising', 'fundraising', 'Business Acquisition', 'Fundraising Round'],
    ['tokenization', 'tokenization', 'Business Acquisition', 'Token Issuance / STO'],
  ])('canonicalizes %s labels from the authoritative type', (machineType, workflowKey, suppliedLabel, expected) => {
    expect(canonicalTransactionTypeLabel(machineType, workflowKey, suppliedLabel)).toBe(expected);
  });

  test('does not relabel a non-built-in machine type using its generic storage pack', () => {
    expect(canonicalTransactionTypeLabel('lending', 'business_acquisition', 'Lending / Finance'))
      .toBe('Lending / Finance');
  });
});