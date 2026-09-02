jest.mock('./db', () => ({
  supabase: {
    from: jest.fn(),
  },
}));

const { supabase } = require('./db');
const {
  runVerification,
  getVerificationState,
  buildChecks,
  extractFacts,
} = require('./lib/verificationEngine');

function builder(result) {
  const chain = {};
  for (const method of ['select', 'eq', 'neq', 'order', 'limit', 'delete', 'insert']) {
    chain[method] = jest.fn(() => chain);
  }
  chain.then = (resolve, reject) => Promise.resolve(result).then(resolve, reject);
  return chain;
}

describe('verification upload compatibility', () => {
  afterEach(() => jest.resetAllMocks());

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
      .mockReturnValueOnce(builder({ data: { id: `${propertyId}-verification` }, error: null }));

    await expect(runVerification(propertyId)).resolves.toEqual(expect.objectContaining({
      propertyId,
      documents_considered: [section],
    }));
    expect(supabase.from).toHaveBeenCalledTimes(3);
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

  test('rehydrates a stale room snapshot from active document versions', async () => {
    const documents = [
      {
        id: 'commitment',
        section: 'loan_commitment',
        analysis: { metrics: { total_commitment: '$25,000,000' } },
        created_at: '2026-08-01T00:00:00.000Z',
        is_active: true,
      },
      {
        id: 'noi-a',
        section: 'operating_statement',
        analysis: { metrics: { net_operating_income: '$8,000,000' } },
        created_at: '2026-08-02T00:00:00.000Z',
        is_active: true,
      },
      {
        id: 'cash',
        section: 'cash_report',
        analysis: { metrics: { cash_variance: '$125,000' } },
        created_at: '2026-08-03T00:00:00.000Z',
        is_active: true,
      },
      {
        id: 'policy',
        section: 'servicing_policy',
        analysis: { metrics: { delinquency_trigger: { value: 7.5, unit: '%' } } },
        created_at: '2026-08-04T00:00:00.000Z',
        is_active: true,
      },
      {
        id: 'servicer',
        section: 'servicer_report',
        analysis: { metrics: { actual_delinquency: { value: 8.1, unit: '%' } } },
        created_at: '2026-08-05T00:00:00.000Z',
        is_active: true,
      },
      {
        id: 'noi-b',
        section: 'annual_financials',
        analysis: { metrics: { noi: '$7,800,000' } },
        created_at: '2026-08-06T00:00:00.000Z',
        is_active: true,
      },
    ];
    const staleChecks = [
      { id: 'stale-commitment-cash', type: 'fact_consistency', status: 'discrepancy', semantic_key: 'capital.commitment' },
      { id: 'stale-cash-noi', type: 'fact_consistency', status: 'discrepancy', semantic_key: 'financial.cash_variance' },
      { id: 'stale-noi-period', type: 'fact_consistency', status: 'discrepancy', semantic_key: 'financial.noi' },
      { id: 'stale-policy-noi', type: 'fact_consistency', status: 'discrepancy', semantic_key: 'covenant.delinquency_rate' },
      { id: 'stale-unrelated', type: 'fact_consistency', status: 'discrepancy', semantic_key: 'financial.revenue' },
    ];

    supabase.from
      .mockReturnValueOnce(builder({
        data: [{
          id: 'stale-verification',
          created_at: '2026-08-07T00:00:00.000Z',
          analysis: {
            status: 'complete',
            checks: staleChecks,
            summary: { verified: 0, discrepancies: staleChecks.length, pending: 0 },
          },
        }],
        error: null,
      }))
      .mockReturnValueOnce(builder({ data: documents, error: null }))
      .mockReturnValueOnce(builder({ data: { id: 'fresh-verification' }, error: null }));

    const state = await getVerificationState('room-with-stale-verification');
    const checks = state.runs[0].checks;

    expect(checks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: 'threshold_relationship',
        status: 'discrepancy',
        relationship: 'delinquency_rate',
      }),
      expect.objectContaining({
        type: 'fact_consistency',
        fact_key: 'financial.noi',
        status: 'discrepancy',
      }),
    ]));
    expect(checks).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ semantic_key: 'capital.commitment' }),
      expect.objectContaining({ semantic_key: 'financial.cash_variance' }),
      expect.objectContaining({ semantic_key: 'financial.revenue' }),
    ]));
    expect(supabase.from).toHaveBeenCalledTimes(3);

    // A second hydration with the same active evidence reuses the current
    // immutable run instead of creating another snapshot.
    const currentRun = state.runs[0];
    supabase.from.mockReset();
    supabase.from
      .mockReturnValueOnce(builder({ data: [{
        id: 'fresh-verification',
        created_at: currentRun.run_at,
        analysis: currentRun,
      }], error: null }))
      .mockReturnValueOnce(builder({ data: documents, error: null }));
    const secondState = await getVerificationState('room-with-stale-verification');
    expect(secondState.runs[0].source_signature).toBe(currentRun.source_signature);
    expect(supabase.from).toHaveBeenCalledTimes(2);
  });

  test('ignores superseded document evidence when hydrating verification', async () => {
    const documents = [
      {
        id: 'old-operating',
        section: 'operating_statement',
        analysis: { metrics: { noi: '$6,000,000' } },
        created_at: '2026-08-01T00:00:00.000Z',
        is_active: false,
        superseded_at: '2026-08-10T00:00:00.000Z',
      },
      {
        id: 'new-operating',
        section: 'operating_statement',
        analysis: { metrics: { noi: '$8,000,000' } },
        created_at: '2026-08-10T00:00:00.000Z',
        is_active: true,
      },
      {
        id: 'annual',
        section: 'annual_financials',
        analysis: { metrics: { noi: '$8,000,000' } },
        created_at: '2026-08-11T00:00:00.000Z',
        is_active: true,
      },
    ];

    supabase.from
      .mockReturnValueOnce(builder({ data: [], error: null }))
      .mockReturnValueOnce(builder({ data: documents, error: null }))
      .mockReturnValueOnce(builder({ data: { id: 'fresh-verification' }, error: null }));

    const state = await getVerificationState('room-with-replacement');
    expect(state.runs[0].checks).toEqual(expect.arrayContaining([
      expect.objectContaining({ fact_key: 'financial.noi', status: 'verified' }),
    ]));
    expect(state.runs[0].checks).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ value_a: 6000000 }),
    ]));
  });
});