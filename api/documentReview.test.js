const request = require('supertest');
const app = require('./index');

describe('POST /api/document-review/process', () => {
  it('requires file and doc_type', async () => {
    const res = await request(app).post('/api/document-review/process');
    expect(res.statusCode).toBe(400);
  });
});
