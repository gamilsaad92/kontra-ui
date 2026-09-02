const request = require('supertest')
const app = require('./index')

describe('POST /api/generate-closing-doc', () => {
  it('requires fields', async () => {
    const res = await request(app).post('/api/generate-closing-doc').send({})
    expect(res.statusCode).toBe(400)
  })
})

describe('POST /api/generate-tax-form', () => {
  it('requires form_type and data', async () => {
    const res = await request(app).post('/api/generate-tax-form').send({})
    expect(res.statusCode).toBe(400)
  })
})
