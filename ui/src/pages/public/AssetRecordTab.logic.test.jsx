const {
  canonicalFieldStatus,
  getRecordStats,
} = require('./AssetRecordTab');

describe('responsive Transaction Record projections', () => {
  test('uses awaiting for populated unconfirmed values and confirmed only for human-confirmed values', () => {
    const fields = [
      { field_key: 'transaction.loss_type', value_text: 'Fire', status: 'generated' },
      { field_key: 'financial.repair_costs', value_text: '$229,950', status: 'verified' },
      { field_key: 'asset.type', value_text: '', status: 'extracted' },
    ];
    expect(canonicalFieldStatus(fields[0])).toBe('awaiting');
    expect(canonicalFieldStatus(fields[1])).toBe('confirmed');
    expect(canonicalFieldStatus(fields[2])).toBe('missing');

    const stats = getRecordStats(
      fields.map(field => ({ ...field, field_category: field.field_key.split('.')[0] })),
      fields,
      fields.map(field => ({
        ...field,
        key: field.field_key,
        canonicalKey: field.field_key,
        category: field.field_category,
        workflowRequired: true,
      })),
    );
    expect(stats.total).toBe(3);
    expect(stats.confirmed).toBe(1);
    expect(stats.awaiting).toBe(1);
    expect(stats.complete).toBe(1);
  });

  test('reload-shaped canonical state keeps an awaiting field awaiting until confirmation', () => {
    const awaiting = { field_key: 'transaction.loss_event', value_text: 'Hurricane', status: 'awaiting' };
    const confirmed = { ...awaiting, status: 'verified' };
    expect(canonicalFieldStatus(awaiting)).toBe('awaiting');
    expect(canonicalFieldStatus(confirmed)).toBe('confirmed');
  });
});