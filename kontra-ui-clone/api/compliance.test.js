process.env.FEATURE_FLAGS = 'compliance'
process.env.ENCRYPTION_KEY = 'test-encryption-key'
process.env.PII_ENCRYPTION_KEY = 'test-pii-key'

jest.mock('./middlewares/authenticate', () => (req, _res, next) => {
  req.user = { id: 'user-1' }
  req.organizationId = 'org-1'
  req.role = 'admin'
  next()
})

jest.mock('./middlewares/requireRole', () => () => (req, _res, next) => {
  req.role = req.role || 'admin'
  next()
})

const fs = require('fs')
const crypto = require('crypto')
const request = require('supertest')
const { AUDIT_PATH } = require('./auditLogger')
const app = require('./index')

function decryptAuditLine(line) {
  const [ivHex, tagHex, cipherHex] = line.split(':')
  const key = crypto.createHash('sha256').update(process.env.ENCRYPTION_KEY).digest()
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivHex, 'hex'))
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'))
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(cipherHex, 'hex')),
    decipher.final(),
  ])
  return JSON.parse(decrypted.toString('utf8'))
}

afterEach(() => {
  if (fs.existsSync(AUDIT_PATH)) fs.unlinkSync(AUDIT_PATH)
})

describe('POST /api/regulatory-scan', () => {
  it('requires text field', async () => {
    const res = await request(app).post('/api/regulatory-scan').send({})
    expect(res.statusCode).toBe(400)
  })

  it('records an encrypted audit log', async () => {
    const res = await request(app)
      .post('/api/regulatory-scan')
      .send({ text: 'Test disclosure text' })

    expect(res.statusCode).toBe(200)
    await new Promise((resolve) => setTimeout(resolve, 20))
    const content = fs.readFileSync(AUDIT_PATH, 'utf8').trim()
    const lastLine = content.split('\n').pop()
    expect(lastLine).toMatch(/^[0-9a-f]+:[0-9a-f]+:[0-9a-f]+$/)
    const decoded = decryptAuditLine(lastLine)
    expect(decoded.method).toBe('POST')
    expect(decoded.url).toContain('/api/regulatory-scan')
    expect(decoded.body).toEqual({ text: 'Test disclosure text' })
    expect(decoded.status).toBe(200)
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

describe('GET /api/kyc', () => {
  it('returns KYC status', async () => {
    const res = await request(app).get('/api/kyc')
    expect(res.statusCode).toBe(200)
    expect(res.body.status).toBeDefined()
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
