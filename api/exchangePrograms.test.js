process.env.SUPABASE_URL = 'http://example.com';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test';
process.env.FEATURE_FLAGS = '';
process.env.OPENAI_API_KEY = 'test';
process.env.SENTRY_DSN = 'test';
process.env.STRIPE_SECRET_KEY = 'test';
process.env.PII_ENCRYPTION_KEY = 'test';

jest.mock('./middlewares/authenticate', () => (req, res, next) => {
  req.user = { id: 'trader-1' };
  req.organizationId = 'org-1';
  next();
});

const tables = {
  mini_cmbs_pools: [],
  mini_cmbs_orders: [],
  loan_participations: [],
  loan_participation_bids: [],
  preferred_equity_tokens: [],
  preferred_equity_distributions: []
};

jest.mock('./db', () => {
  let id = 1;
  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }
  function from(table) {
    if (!tables[table]) tables[table] = [];
    const data = tables[table];
    const builder = {
      _filters: [],
      insert(records) {
        const rows = records.map(record => ({ id: String(id++), ...clone(record) }));
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
        let rows = data.map(clone);
        for (const filter of builder._filters) {
          rows = rows.filter(row => row[filter.col] === filter.val);
        }
        return Promise.resolve({ data: rows, error: null });
      },
      eq(col, val) {
        builder._filters.push({ col, val });
        return builder;
      }
    };
    return builder;
  }
  return {
    supabase: { from },
    __reset() {
      Object.keys(tables).forEach(key => {
        tables[key] = [];
      });
      id = 1;
    }
  };
});

const express = require('express');
const request = require('supertest');
const exchangeProgramsRouter = require('./routers/exchangePrograms');

const app = express();
app.use(express.json());
app.use('/api/exchange-programs', exchangeProgramsRouter);

beforeEach(() => {
  require('./db').__reset();
});

describe('Mini-CMBS pool workflows', () => {
  it('creates a pool and allows order placement', async () => {
    const createRes = await request(app)
      .post('/api/exchange-programs/mini-cmbs')
      .send({
        pool_name: 'Pool A',
        total_balance: 12000000,
        coupon_rate: 5.25,
        structure: 'Senior/Sub',
        collateral: ['Loan 1', 'Loan 2'],
        auction_type: 'auction'
      });
    expect(createRes.statusCode).toBe(201);
    const poolId = createRes.body.pool.id;

    const orderRes = await request(app)
      .post(`/api/exchange-programs/mini-cmbs/${poolId}/orders`)
      .send({ side: 'bid', price: 102.5, size: 3000000 });
    expect(orderRes.statusCode).toBe(201);

    const listRes = await request(app).get('/api/exchange-programs/mini-cmbs');
    expect(listRes.statusCode).toBe(200);
    expect(listRes.body.pools).toHaveLength(1);
    expect(listRes.body.pools[0].order_book.bids).toHaveLength(1);
  });
});

describe('Loan participation marketplace', () => {
  it('creates listings and records bids', async () => {
    const listingRes = await request(app)
      .post('/api/exchange-programs/participations')
      .send({
        loan_name: 'Hospitality Loan',
        available_amount: 4000000,
        min_piece: 500000,
        target_yield: 8.5
      });
    expect(listingRes.statusCode).toBe(201);
    const listingId = listingRes.body.participation.id;

    const bidRes = await request(app)
      .post(`/api/exchange-programs/participations/${listingId}/bids`)
      .send({ bidder: 'Bank A', size: 750000, rate: 8.75 });
    expect(bidRes.statusCode).toBe(201);

    const listRes = await request(app).get('/api/exchange-programs/participations');
    expect(listRes.statusCode).toBe(200);
    expect(listRes.body.participations[0].bids[0].bidder).toBe('Bank A');
  });
});

describe('Preferred equity tokenization', () => {
  it('issues tokens and tracks distributions', async () => {
    const issueRes = await request(app)
      .post('/api/exchange-programs/preferred-equity')
      .send({
        token_name: 'Series PE-1',
        project: 'Mixed-Use Tower',
        price_per_token: 1000,
        total_supply: 1000,
        target_irr: 12,
        distribution_frequency: 'Quarterly'
      });
    expect(issueRes.statusCode).toBe(201);
    const tokenId = issueRes.body.token.id;

    const distRes = await request(app)
      .post(`/api/exchange-programs/preferred-equity/${tokenId}/distributions`)
      .send({ distribution_date: '2024-06-30', amount: 55000, memo: 'Q2 distribution' });
    expect(distRes.statusCode).toBe(201);

    const listRes = await request(app).get('/api/exchange-programs/preferred-equity');
    expect(listRes.statusCode).toBe(200);
    expect(listRes.body.tokens[0].distributions).toHaveLength(1);
  });
});
