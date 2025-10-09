const request = require('supertest');
const { app, resetSupabase, createClient } = require('./testUtils/app');

beforeEach(() => {
  resetSupabase();
  createClient.__setTable('loans', {
    records: [{ id: 'loan-1' }],
    maybeSingle: { id: 1, amount: 100, interest_rate: 6 },
  });
});

describe('loans router authentication', () => {
  it('returns 401 when Authorization header is missing', async () => {
    const res = await request(app).get('/api/loans');
    expect(res.statusCode).toBe(401);
  });

  it('returns 403 when organization metadata is missing', async () => {
    createClient.__setAuthUser({ id: 'user-1', user_metadata: {} });
    const res = await request(app)
      .get('/api/loans')
      .set('Authorization', 'Bearer test-token');
    expect(res.statusCode).toBe(403);
  });

  it('allows access for authenticated organization', async () => {
    const res = await request(app)
      .get('/api/loans')
      .set('Authorization', 'Bearer test-token');
    expect(res.statusCode).toBe(200);
    expect(res.body.loans).toEqual([{ id: 'loan-1' }]);
  });

  it('enforces auth on payoff instructions', async () => {
    const unauthorized = await request(app).get('/api/loans/1/payoff-instructions');
    expect(unauthorized.statusCode).toBe(401);

    createClient.__setAuthUser({ id: 'user-1', user_metadata: {} });
    const forbidden = await request(app)
      .get('/api/loans/1/payoff-instructions')
      .set('Authorization', 'Bearer test-token');
    expect(forbidden.statusCode).toBe(403);

    resetSupabase();
    createClient.__setTable('loans', {
      maybeSingle: { id: 1, amount: 100, interest_rate: 6 },
    });
    const success = await request(app)
      .get('/api/loans/1/payoff-instructions')
      .set('Authorization', 'Bearer test-token');
    expect(success.statusCode).toBe(200);
    expect(success.body.instructions).toContain('loan 1');
  });
});
