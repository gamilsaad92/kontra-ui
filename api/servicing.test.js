const request = require('supertest');
const app = require('../index');

describe('GET /api/loans/:id/escrow/upcoming', () => {
  it('validates loan id', async () => {
    const res = await request(app).get('/api/loans/foo/escrow/upcoming');
    expect(res.statusCode).toBe(400);
  });
});

describe('POST /api/loans/:id/escrow/pay', () => {
  it('requires type and amount', async () => {
    const res = await request(app).post('/api/loans/1/escrow/pay').send({});
    expect(res.statusCode).toBe(400);
  });
});

describe('GET /api/loans/:id/escrow/projection', () => {
  it('validates loan id', async () => {
    const res = await request(app).get('/api/loans/foo/escrow/projection');
    expect(res.statusCode).toBe(400);
  });
});
