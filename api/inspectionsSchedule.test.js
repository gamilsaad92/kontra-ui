const request = require('supertest');
const app = require('./index');

describe('POST /api/inspections/schedule', () => {
  it('requires project_id, inspection_date and contact', async () => {
    const res = await request(app).post('/api/inspections/schedule').send({});
    expect(res.statusCode).toBe(400);
  });
});

describe('POST /api/inspections/1/decision', () => {
  it('requires status', async () => {
    const res = await request(app).post('/api/inspections/1/decision').send({});
    expect(res.statusCode).toBe(400);
  });
});
