const request = require('supertest')
const app = require('./index')

describe('POST /api/regulatory-scan', () => {
  it('requires text field', async () => {
    const res = await request(app).post('/api/regulatory-scan').send({})
    expect(res.statusCode).toBe(400)
  })
})

describe('GET /api/evidence-dossier/:loanId', () => {
  it('endpoint exists', async () => {
    const res = await request(app).get('/api/evidence-dossier/1')
    expect(res.statusCode).not.toBe(404)
  })
})
