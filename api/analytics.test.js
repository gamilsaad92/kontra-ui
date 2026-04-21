const request = require('supertest');
const app = require('../index');

describe('POST /api/predict-delinquency', () => {
  it('requires required fields', async () => {
    const res = await request(app).post('/api/predict-delinquency').send({});
    expect(res.statusCode).toBe(400);
  });
});

describe('POST /api/optimize-loan-offer', () => {
  it('requires required fields', async () => {
    const res = await request(app).post('/api/optimize-loan-offer').send({});
    expect(res.statusCode).toBe(400);
  });
});
