process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = '';
process.env.APP_DATABASE_URL = '';
process.env.SUPABASE_DB_URL = '';
process.env.SUPABASE_URL = 'http://placeholder';
process.env.SUPABASE_SERVICE_ROLE_KEY = '';
process.env.OPENAI_API_KEY = 'test-only-openai-key';
process.env.SENTRY_DSN = '';
process.env.STRIPE_SECRET_KEY = '';
process.env.STRIPE_WEBHOOK_SECRET = '';
process.env.PII_ENCRYPTION_KEY = 'test-only-pii-key';

jest.mock('pg', () => {
  class PersistentDatabaseDisabled {
    constructor() {
      throw new Error('Persistent PostgreSQL access is disabled in this test.');
    }
  }
  return { Pool: PersistentDatabaseDisabled, Client: PersistentDatabaseDisabled };
});
jest.mock('./middlewares/auditLogger', () => (_req, _res, next) => next());

const request = require('supertest');
const app = require('./index');

describe('exchange trade documents endpoints', () => {
  it('blocks document generation with the exchange surface', async () => {
    const res = await request(app)
      .post('/api/exchange/trades/1/documents')
      .send({ template: 'trade-summary' });
    expect(res.statusCode).toBe(503);
    expect(res.body.code).toBe('INTERIM_SECURITY_RESTRICTION');
  });

  it('blocks trade signing with the exchange surface', async () => {
    const res = await request(app)
      .post('/api/exchange/trades/1/sign')
      .send({ path: '/isolated/test.pdf' });
    expect(res.statusCode).toBe(503);
    expect(res.body.code).toBe('INTERIM_SECURITY_RESTRICTION');
  });
});
