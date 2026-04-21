const request = require('supertest');
const app = require('./index');

describe('Workflow Automation API', () => {
  it('lists workflows', async () => {
    const res = await request(app).get('/api/workflows');
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('creates a workflow', async () => {
    const res = await request(app)
      .post('/api/workflows')
      .send({ name: 'Test Flow', steps: ['step1'] });
    expect(res.statusCode).toBe(201);
    expect(res.body.name).toBe('Test Flow');

    const list = await request(app).get('/api/workflows');
    expect(list.body.find(w => w.name === 'Test Flow')).toBeDefined();
  });
});
