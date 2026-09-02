const request = require('supertest')
const app = require('./index')

describe('POST /api/classify-document', () => {
  it('requires file upload', async () => {
    const res = await request(app).post('/api/classify-document')
    expect(res.statusCode).toBe(400)
  })
})
