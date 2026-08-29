jest.mock('./db', () => ({
  supabase: {
    from: jest.fn(),
  },
}));

const { supabase } = require('./db');
const { runVerification, buildChecks, extractFacts } = require('./lib/verificationEngine');

function builder(result) {
  const chain = {};
  for (const method of ['select', 'eq', 'neq', 'order', 'delete', 'insert']) {
    chain[method] = jest.fn(() => chain);
  }
  chain.then = (resolve, reject) => Promise.resolve(result).then(resolve, reject);
  return chain;
}

describe('verification upload compatibility', () => {
  afterEach(() => jest.clearAllMocks());

  test.each([
    ['generated AI room', 'generated-room', 'generated_document'],
    ['Hazard Loss Review room', 'hazard-loss-room', 'insurance_claim_documentation'],
  ])('falls back to legacy document columns for a %s', async (_label, propertyId, section) => {
    supabase.from
      .mockReturnValueOnce(builder({
        data: null,
        error: { message: 'column deal_analyses.is_active does not exist', code: '42703' },
      }))
      .mockReturnValueOnce(builder({
        data: [{
          id: `${propertyId}-doc`,
          section,
          analysis: { summary: 'received' },
          created_at: '2026-08-29T00:00:00.000Z',
        }],
        error: null,
      }))
      .mockReturnValueOnce(builder({ data: null, error: null }))
      .mockReturnValueOnce(builder({ data: { id: `${propertyId}-verification` }, error: null }));

    await expect(runVerification(propertyId)).resolves.toEqual(expect.objectContaining({
      propertyId,
      documents_considered: [section],
    }));
    expect(supabase.from).toHaveBeenCalledTimes(4);
  });

  test('reconciles only semantic matches and detects threshold breaches', () => {
    const documents = [
      {
        id: 'commitment',
        section: 'loan_commitment',
        filename: 'Commitment.pdf',
        analysis: { metrics: { total_commitment: '$25,000,000' } },
      },
      {
        id: 'noi-a',
        section: 'operating_statement',
        filename: 'Operating statement.pdf',
        analysis: { metrics: { net_operating_income: '$8,000,000' } },
      },
      {
        id: 'cash',
        section: 'cash_report',
        filename: 'Cash report.pdf',
        analysis: { metrics: { cash_variance: '$125,000' } },
      },
      {
        id: 'policy',
        section: 'servicing_policy',
        filename: 'Servicing policy.pdf',
        analysis: { metrics: { delinquency_trigger: { value: 7.5, unit: '%' } } },
      },
      {
        id: 'servicer',
        section: 'servicer_report',
        filename: 'Servicer report.pdf',
        analysis: { metrics: { actual_delinquency: { value: 8.1, unit: '%' } } },
      },
      {
        id: 'noi-b',
        section: 'annual_financials',
        filename: 'Annual financials.pdf',
        analysis: { metrics: { noi: '$7,800,000' } },
      },
    ];

    const checks = buildChecks(documents, '2026-08-29T00:00:00.000Z');
    const thresholdCheck = checks.find(check => check.type === 'threshold_relationship');
    const noiCheck = checks.find(check => check.semantic_key === 'financial.noi');

    expect(thresholdCheck).toEqual(expect.objectContaining({
      status: 'discrepancy',
      threshold_value: 7.5,
      actual_value: 8.1,
      relationship: 'delinquency_rate',
      source_page_a: null,
      source_page_b: null,
    }));
    expect(noiCheck).toEqual(expect.objectContaining({
      type: 'fact_consistency',
      status: 'discrepancy',
      fact_key: 'financial.noi',
    }));
    expect(checks).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ semantic_key: 'capital.commitment' }),
      expect.objectContaining({ semantic_key: 'financial.cash_variance' }),
    ]));
    expect(extractFacts(documents[0])).toEqual([
      expect.objectContaining({
        semantic_key: 'capital.commitment',
        value: 25000000,
        value_type: 'amount',
        source_doc_id: 'commitment',
      }),
    ]);
    expect(extractFacts({
      id: 'untyped',
      section: 'summary_only',
      analysis: { summary: 'The transaction mentions $25,000,000 without naming the metric.' },
    })).toEqual([]);
  });
});