const request = require('supertest');
const app = require('../index');

describe('POST /api/portfolio-summary', () => {
  it('requires period field', async () => {
    const res = await request(app).post('/api/portfolio-summary').send({});
    expect(res.statusCode).toBe(400);
  });
});

describe('POST /api/query-loans', () => {
  it('requires query field', async () => {
    const res = await request(app).post('/api/query-loans').send({});
    expect(res.statusCode).toBe(400);
  });
});
