const request = require('supertest');
const app = require('../index');

describe('POST /api/predict-bills', () => {
  it('requires property_value', async () => {
    const res = await request(app).post('/api/predict-bills').send({});
    expect(res.statusCode).toBe(400);
  });
});
