const request = require('supertest');
const app = require('./index');

describe('POST /api/forecast-metrics', () => {
  it('requires history', async () => {
    const res = await request(app).post('/api/forecast-metrics').send({});
    expect(res.statusCode).toBe(400);
  });
});

describe('POST /api/detect-anomalies', () => {
  it('requires values', async () => {
    const res = await request(app).post('/api/detect-anomalies').send({});
    expect(res.statusCode).toBe(400);
  });
});

describe('POST /api/suggest-plan', () => {
  it('requires usage', async () => {
    const res = await request(app).post('/api/suggest-plan').send({});
    expect(res.statusCode).toBe(400);
  });
});

describe('POST /api/predict-churn', () => {
  it('requires logins and days_since_login', async () => {
    const res = await request(app).post('/api/predict-churn').send({});
    expect(res.statusCode).toBe(400);
  });
});
