const request = require('supertest');
const { app, resetSupabase } = require('./testUtils/app');
const { resetServicingState } = require('./services/servicing');

beforeEach(() => {
 resetSupabase();
 resetServicingState();
});

describe('Servicing engine', () => {
  it('requires authentication for servicing endpoints', async () => {
    const res = await request(app)
      .post('/api/servicing/pools/POOL-1/payments/import')
      .send({});

    expect(res.statusCode).toBe(401);
  });

  it('ingests payment rows and produces remittance summary and cashflows', async () => {
    const payload = {
      period: '2025-04-01',
      rows: [
        {
          loan_id: 'LN-100',
          date: '2025-04-05',
          principal: 30000,
          interest: 5000,
          fees: 500,
          type: 'principal',
        },
        {
          loan_id: 'LN-100',
          date: '2025-04-10',
          interest: 2000,
          type: 'default_interest',
          description: 'late interest',
        },
        {
          loan_id: 'LN-200',
          date: '2025-04-12',
          principal: 10000,
          interest: 1000,
          type: 'recovery',
        },
        {
          loan_id: 'LN-200',
          date: '2025-04-15',
          amount: 5000,
          type: 'advance',
        },
      ],
    };

    const res = await request(app)
      .post('/api/servicing/pools/POOL-2025-1/payments/import')
      .set('Authorization', 'Bearer test-token')
     .send(payload);

    expect(res.statusCode).toBe(201);
    expect(res.body.remittance_summary).toMatchObject({
      pool_id: 'POOL-2025-1',
      period: '2025-04-01',
      gross_interest: 8000,
      gross_principal: 40000,
      fees: 500,
      advances: 5000,
      recoveries: 11000,
    });
    expect(res.body.remittance_summary.default_interest).toBe(2000);
    expect(res.body.remittance_summary.net_to_investors).toBe(53500);

    const { cashflows } = res.body;
    const loan100 = cashflows.find((c) => c.loan_id === 'LN-100');
    expect(loan100.cashflows).toHaveLength(2);
    expect(loan100.cashflows[1].tag).toBe('default_interest');
  });

 it('returns cashflow history and remittance summary for a period', async () => {
    const payload = {
      period: '2025-04-01',
      rows: [
        { loan_id: 'LN-1', date: '2025-04-02', principal: 15000, interest: 2500, fees: 250 },
        { loan_id: 'LN-1', date: '2025-04-18', interest: 1000, type: 'default_interest' },
        { loan_id: 'LN-2', date: '2025-04-11', principal: 5000, interest: 800, type: 'recovery' },
      ],
    };

    await request(app)
      .post('/api/servicing/pools/POOL-99/payments/import')
      .set('Authorization', 'Bearer test-token')
      .send(payload);

    const cashflowRes = await request(app)
      .get('/api/servicing/pools/POOL-99/cashflows?loan_id=LN-1&period=2025-04-01')
      .set('Authorization', 'Bearer test-token');
   
    expect(cashflowRes.statusCode).toBe(200);
    expect(cashflowRes.body.cashflows[0].cashflows).toHaveLength(2);

    const remittanceRes = await request(app)
      .get('/api/servicing/pools/POOL-99/remittance/2025-04-01')
      .set('Authorization', 'Bearer test-token');

    expect(remittanceRes.body.remittance_summary.net_to_investors).toBe(29850);
    expect(remittanceRes.body.remittance_summary.default_interest).toBe(1000);
  });
});
