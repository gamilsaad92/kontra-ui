const request = require('supertest')
const app = require('./index')

describe('POST /api/parse-document', () => {
  it('requires file upload', async () => {
    const res = await request(app).post('/api/parse-document')
    expect(res.statusCode).toBe(400)
  })
})
