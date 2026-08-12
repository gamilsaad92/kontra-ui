const {
  canonicalizeTransactionRecordKey,
  aliasKeysForCanonical,
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
});