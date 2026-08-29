jest.mock('./db', () => ({
  supabase: {
    from: jest.fn(),
  },
}));

const { supabase } = require('./db');
const { runVerification } = require('./lib/verificationEngine');

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
});