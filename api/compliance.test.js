process.env.FEATURE_FLAGS = 'compliance'
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

describe('POST /api/pci-scan', () => {
  it('returns compliance result', async () => {
    const res = await request(app).post('/api/pci-scan').send({})
    expect(res.statusCode).toBe(200)
    expect(res.body.compliant).toBeDefined()
  })
})

describe('GET /api/gdpr-export/:userId', () => {
  it('endpoint exists', async () => {
    const res = await request(app).get('/api/gdpr-export/1')
    expect(res.statusCode).not.toBe(404)
  })
})

describe('DELETE /api/gdpr-delete/:userId', () => {
  it('endpoint exists', async () => {
    const res = await request(app).delete('/api/gdpr-delete/1')
    expect(res.statusCode).not.toBe(404)
  })
})
