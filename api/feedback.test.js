const request = require('supertest');
const app = require('./index');

describe('POST /api/feedback', () => {
  it('validates required fields', async () => {
    const res = await request(app).post('/api/feedback').send({});
    expect(res.statusCode).toBe(400);
  });
  
  it('records feedback', async () => {
    const res = await request(app)
      .post('/api/feedback')
      .send({ message: 'Great feature', type: 'feature' });
    expect(res.statusCode).toBe(201);
  });
});
