const request = require('supertest');
const app = require('../index');

describe('POST /api/underwriter-chat', () => {
  it('requires question', async () => {
    const res = await request(app).post('/api/underwriter-chat').send({});
    expect(res.statusCode).toBe(400);
  });
});
