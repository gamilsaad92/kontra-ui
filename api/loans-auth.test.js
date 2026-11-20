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

  it('does not treat organization metadata as membership proof', async () => {
    createClient.__setTable('org_memberships', { records: [] });
    createClient.__setAuthUser({ id: 'user-1', user_metadata: {} });
    const res = await request(app)
      .get('/api/loans')
      .set('Authorization', 'Bearer test-token');
    expect(res.statusCode).toBe(403);
    expect(res.body.code).toBe('ORG_MEMBERSHIP_REQUIRED');
  });

  it('rejects an organization header without an active membership', async () => {
    createClient.__setTable('org_memberships', {
      records: [{
        org_id: '00000000-0000-0000-0000-000000000001',
        user_id: 'user-1',
        role: 'admin',
        status: 'active',
        deleted_at: null,
      }],
    });
    createClient.__setAuthUser({ id: 'user-1', user_metadata: {} });
    const res = await request(app)
      .get('/api/loans')
      .set('Authorization', 'Bearer test-token')
      .set('X-Organization-Id', '00000000-0000-0000-0000-000000000042');
    expect(res.statusCode).toBe(403);
    expect(res.body.code).toBe('ORG_FORBIDDEN');
  });

  it('allows a valid organization admin selected by header', async () => {
    createClient.__setTable('org_memberships', {
      records: [{
        org_id: '00000000-0000-0000-0000-000000000001',
        user_id: 'user-1',
        role: 'admin',
        status: 'active',
        deleted_at: null,
      }],
    });
    createClient.__setAuthUser({ id: 'user-1', user_metadata: {} });
    const res = await request(app)
      .get('/api/loans')
      .set('Authorization', 'Bearer test-token')
      .set('X-Organization-Id', '00000000-0000-0000-0000-000000000001');
    expect(res.statusCode).toBe(200);
    expect(res.body.loans).toEqual([{ id: 'loan-1' }]);
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
    createClient.__setTable('org_memberships', { records: [] });
    const forbidden = await request(app)
      .get('/api/loans/1/payoff-instructions')
      .set('Authorization', 'Bearer test-token');
    expect(forbidden.statusCode).toBe(403);

    resetSupabase();
    createClient.__setTable('org_memberships', {
      records: [{
        org_id: '00000000-0000-0000-0000-000000000001',
        user_id: 'user-1',
        role: 'admin',
        status: 'active',
        deleted_at: null,
      }],
    });
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
