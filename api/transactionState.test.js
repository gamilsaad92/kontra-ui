const {
  computeTransactionReadiness,
} = require('./lib/transactionState');

const requirements = require('../shared/transaction_record_requirements.json');

describe('transaction state recalculation', () => {
  it('removes not-applicable fields from the required denominator', () => {
    const required = requirements.cre_acquisition;
    const excluded = required[0];
    const fields = required.map((field, index) => ({
      field_key: field,
      value_text: index === 0 ? null : `confirmed-${index}`,
      status: index === 0 ? 'not_applicable' : 'verified',
    }));

    const result = computeTransactionReadiness(
      { workflow_pack_id: 'cre_acquisition' },
      fields,
      'cre_acquisition',
    );

    expect(result.notApplicableCount).toBe(1);
    expect(result.requiredCount).toBe(required.length - 1);
    expect(result.confirmedCount).toBe(required.length - 1);
    expect(result.overall).toBe(100);
    expect(excluded).toBeDefined();
  });
});