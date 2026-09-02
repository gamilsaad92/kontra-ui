process.env.SUPABASE_URL = 'http://example.com';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test';
process.env.FEATURE_FLAGS = '';
process.env.OPENAI_API_KEY = 'test';
process.env.SENTRY_DSN = 'test';
process.env.STRIPE_SECRET_KEY = 'test';
process.env.PII_ENCRYPTION_KEY = 'test';

jest.mock('./middlewares/authenticate', () => (req, res, next) => {
  req.user = { id: 'investor1' };
  req.organizationId = 'org1';
  next();
});

jest.mock('./db', () => {
  const db = { trade_marketplace: [] };
  let id = 1;
  function from(table) {
    const data = db[table];
    const builder = {
      _filters: [],
      insert(records) {
        const rows = records.map(r => ({ id: String(id++), ...r }));
        data.push(...rows);
        return {
          select() {
            return {
              single() {
                return Promise.resolve({ data: rows[0], error: null });
              }
            };
          }
        };
      },
      select() {
        let rows = [...data];
        return Promise.resolve({ data: rows, error: null });
      },
      order() {
        return builder;
      }
    };
    return builder;
  }
  return { supabase: { from }, __reset() { db.trade_marketplace = []; id = 1; } };
});

const express = require('express');
const request = require('supertest');
const marketplaceRouter = require('./routers/marketplace');

const app = express();
app.use(express.json());
app.use('/api/marketplace', marketplaceRouter);

beforeEach(() => {
  require('./db').__reset();
});

describe('Marketplace API', () => {
  it('creates and lists marketplace entries', async () => {
    const create = await request(app)
      .post('/api/marketplace')
      .send({
        type: 'bid',
        symbol: 'AAA',
        quantity: 10,
        price: 100,
        loanId: 'LN-100',
        loanName: 'Flagler Industrial',
        settlementType: 'amm',
        expectedApy: 0.087,
        walletAddress: '0xabc',
        payoutFrequency: 'quarterly',
      });
    expect(create.statusCode).toBe(201);
    expect(create.body.entry.settlementType).toBe('amm');
    expect(create.body.entry.stablecoinPayment.token).toBe('USDC');
    expect(create.body.entry.payoutFrequency).toBe('quarterly');
    expect(create.body.entry.expectedApy).toBeCloseTo(0.087);

    const list = await request(app).get('/api/marketplace');
    expect(list.body.entries).toHaveLength(1);
    expect(list.body.entries[0].loanId).toBe('LN-100');
    expect(list.body.entries[0].distributionPlan.strategy).toBe('pro-rata');
  });

  it('simulates yield distribution to token holders', async () => {
    const response = await request(app)
      .post('/api/marketplace/distribute')
      .send({
        loanId: 'LN-22',
        paymentAmount: 125000,
        holders: [
          { wallet: '0xholder1', ownership: 0.6 },
          { wallet: '0xholder2', ownership: 0.4 },
        ],
      });

    expect(response.statusCode).toBe(200);
    expect(response.body.distributions).toHaveLength(2);
    expect(response.body.distributions[0].amount).toBeCloseTo(75000);
    expect(response.body.summary.stablecoin.token).toBe('USDC');
  });
});
