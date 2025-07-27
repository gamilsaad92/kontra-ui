const request = require('supertest');
const app = require('./index');

describe('POST /api/risk-score', () => {
  it('requires loanId', async () => {
    const res = await request(app).post('/api/risk-score').send({});
    expect(res.statusCode).toBe(400);
  });

  it('returns a numeric score', async () => {
    const res = await request(app)
      .post('/api/risk-score')
      .send({ loanId: 1, borrowerHistory: { latePayments: 1 }, paymentHistory: { delinquencies: 0 }, creditData: { creditScore: 700 } });
    expect(res.statusCode).toBe(200);
    expect(typeof res.body.score).toBe('number');
  });
});
