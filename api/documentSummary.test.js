const request = require('supertest')
const app = require('./index')

describe('POST /api/document-summary', () => {
  it('requires file upload', async () => {
    const res = await request(app).post('/api/document-summary')
    expect(res.statusCode).toBe(400)
  })
})
