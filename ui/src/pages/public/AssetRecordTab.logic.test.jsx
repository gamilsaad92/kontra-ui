const {
  getCategoryChip,
  uniqueCanonicalFields,
} = require('./AssetRecordTab');

function field(field_key, display_label, overrides = {}) {
  return {
    id: field_key,
    field_key,
    display_label,
    field_category: field_key.startsWith('parties.') ? 'parties' : 'transaction',
    value_text: display_label,
    status: 'verified',
    ...overrides,
  };
}

describe('Transaction Record category projection', () => {
  test('renders one row per canonical identity when dotted and bare aliases coexist', () => {
    const canonicalFields = [
      field('parties.seller', 'Seller Entity', { source_doc_id: 'seller-doc' }),
      field('parties.buyer', 'Buyer Entity'),
      field('transaction.transaction_structure', 'Transaction Structure'),
      field('transaction.closing_date', 'Target Closing Date', {
        status: 'conflicting',
        conflict_candidates: [{ value: 'October 29', source_doc_id: 'closing-doc' }],
      }),
    ];
    const fields = [
      ...canonicalFields,
      field('seller_entity', 'Seller Entity', { source_doc_id: 'seller-alias-doc' }),
      field('buyer_entity', 'Buyer Entity'),
      field('transaction_structure', 'Transaction Structure'),
      field('target_closing_date', 'Target Closing Date', {
        status: 'conflicting',
        conflict_candidates: [{ value: 'October 29', source_doc_id: 'closing-doc' }],
      }),
    ];

    const projected = uniqueCanonicalFields(fields, []);

    expect(projected.map(item => item.field_key)).toEqual([
      'parties.seller',
      'parties.buyer',
      'transaction.transaction_structure',
      'transaction.closing_date',
    ]);
    expect(projected[0].source_doc_id).toBe('seller-doc');
    expect(projected[3].status).toBe('conflicting');
    expect(projected[3].conflict_candidates).toHaveLength(1);
  });

  test('counts unique canonical identities in category chips', () => {
    const fields = [
      field('parties.seller', 'Seller Entity'),
      field('seller_entity', 'Seller Entity', { field_category: 'parties' }),
      field('parties.buyer', 'Buyer Entity'),
      field('buyer_entity', 'Buyer Entity', { field_category: 'parties' }),
      field('transaction.transaction_structure', 'Transaction Structure'),
      field('transaction_structure', 'Transaction Structure'),
    ];

    expect(getCategoryChip('parties', fields, [], 'full', null, null)).toEqual({
      text: '2 of 2 confirmed',
      color: 'green',
    });
    expect(getCategoryChip('transaction', fields, [], 'full', null, null)).toEqual({
      text: '1 of 1 confirmed',
      color: 'green',
    });
  });
});