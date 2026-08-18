import {
  getPackRecordSchema,
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

  test('Fundraising resolves one 17-field denominator and hides the closing-date alias', () => {
    const requiredFields = getRequiredRecordFields('fundraising');
    const requiredKeys = requiredFields.map(field => field.canonicalKey || field.key);
    const schema = getPackRecordSchema('fundraising');
    const renderedRequiredFields = Object.values(schema)
      .flat()
      .filter(field => requiredKeys.includes(field.canonicalKey || field.key))
      .filter(field => field.renderable !== false);
    const closingAlias = schema.transaction.find(field => field.key === 'transaction.target_close');

    expect(requiredFields).toHaveLength(17);
    expect(new Set(requiredKeys).size).toBe(17);
    expect(renderedRequiredFields).toHaveLength(17);
    expect(closingAlias?.renderable).toBe(false);
    expect(requiredKeys).toContain('financial.target_raise');
  });
});