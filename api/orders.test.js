const request = require('supertest');
const app = require('./index');

describe('POST /api/orders', () => {
   it('requires organization id', async () => {
    const res = await request(app).post('/api/orders').send({});
    expect(res.statusCode).toBe(400);
  });
  
  it('requires items', async () => {
    const res = await request(app)
      .post('/api/orders')
      .set('X-Org-Id', '1')
      .send({});
    expect(res.statusCode).toBe(400);
  });
});
