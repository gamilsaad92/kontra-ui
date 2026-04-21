const request = require('supertest');
const app = require('../index');

describe('POST /api/hazard-loss', () => {
  it('requires draw_id and part_i', async () => {
    const res = await request(app).post('/api/hazard-loss').send({});
    expect(res.statusCode).toBe(400);
  });
});
