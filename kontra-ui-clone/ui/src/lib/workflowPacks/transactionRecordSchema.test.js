import {
  getRequiredRecordFields,
  resolveSchemaKey,
} from './transactionRecordSchema';

describe('transaction record schema regression coverage', () => {
  test('CRE uses the CRE workflow schema and a deduplicated required denominator', () => {
    const schemaKey = resolveSchemaKey('cre_acquisition', null, 'REO / CRE');
    const requiredFields = getRequiredRecordFields(schemaKey);
    const requiredKeys = requiredFields.map(field => field.canonicalKey || field.key);

    expect(schemaKey).toBe('cre_acquisition');
    expect(requiredKeys).toContain('transaction.closing_date');
    expect(requiredKeys).toContain('transaction.purchase_price');
    expect(new Set(requiredKeys).size).toBe(requiredKeys.length);
  });
});