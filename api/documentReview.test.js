const request = require('supertest');
const app = require('./index');

describe('POST /api/document-review/process', () => {
  it('requires file and doc_type', async () => {
    const res = await request(app).post('/api/document-review/process');
    expect(res.statusCode).toBe(400);
  });
    it('flags missing signatures', async () => {
    const res = await request(app)
      .post('/api/document-review/process')
      .field('doc_type', 'contract')
      .attach('file', Buffer.from('agreement without signature'), 'test.txt');
    expect(res.statusCode).toBe(200);
    expect(res.body.missingSignature).toBe(true);
  });
});
