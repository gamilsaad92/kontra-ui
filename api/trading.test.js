process.env.SUPABASE_URL = 'http://example.com'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test'
process.env.OPENAI_API_KEY = 'test'
process.env.SENTRY_DSN = 'test'
process.env.STRIPE_SECRET_KEY = 'test'
process.env.PII_ENCRYPTION_KEY = 'test'

jest.mock('./middlewares/authenticate', () => (req, res, next) => {
  req.user = { id: 'test' }
  req.organizationId = 'org1'
  next()
})
jest.mock('./webhooks', () => ({ triggerWebhooks: jest.fn() }))
jest.mock('./collabServer', () => ({ broadcast: jest.fn() }))
jest.mock('./db', () => {
  const db = { trades: [], trade_participants: [], trade_settlements: [] }
  let id = 1
  function from(table) {
    const data = db[table]
    const builder = {
      _filters: [],
      insert(records) {
        const rows = records.map(r => ({ id: String(id++), ...r }))
        data.push(...rows)
        return {
          select() {
            return {
              single() {
                return Promise.resolve({ data: rows[0], error: null })
              }
            }
          }
        }
      },
      select() {
        let rows = [...data]
        for (const f of builder._filters) {
          rows = rows.filter(r => r[f.col] === f.val)
        }
        return Promise.resolve({ data: rows, error: null })
      },
      update(values) {
        return {
          eq(col, val) {
            const row = data.find(r => r[col] === val)
            if (row) Object.assign(row, values)
            return {
              select() {
                return {
                  single() {
                    return Promise.resolve({ data: row || null, error: row ? null : { message: 'not found' } })
                  }
                }
              }
            }
          }
        }
      },
      eq(col, val) {
        builder._filters.push({ col, val })
        return builder
      }
    }
    return builder
  }
  return {
    supabase: { from },
    __reset() {
      db.trades = []
      db.trade_participants = []
      db.trade_settlements = []
      id = 1
    }
  }
})
const fs = require('fs')
const path = require('path')
const request = require('supertest')

const AUDIT_PATH = path.join(__dirname, 'auditLogs.enc')

function buildApp() {
  const express = require('express')
  const app = express()
  const tradesRouter = require('./routers/trades')
  app.use(express.json())
  app.use('/api', tradesRouter)
  return app
}

describe('Trading API', () => {
  let app

  beforeEach(() => {
    jest.resetModules()
    jest.clearAllMocks()
    process.env.FEATURE_FLAGS = ''
    delete process.env.KYC_API_URL
    delete process.env.KYC_API_KEY
    delete global.fetch
    app = buildApp()
    require('./db').__reset()
  })
  

  afterEach(() => {
    if (fs.existsSync(AUDIT_PATH)) fs.unlinkSync(AUDIT_PATH)
  })

  describe('trade creation', () => {
    it('creates a trade with valid payload', async () => {
      const res = await request(app)
        .post('/api/trades')
         .send({
          trade_type: 'loan_sale',
          notional_amount: 1500,
          price: 100,
          side: 'buy',
          counterparties: ['cp1'],
          symbol: 'AAA',
          quantity: 10
        })
      expect(res.statusCode).toBe(201)
      expect(res.body.trade.trade_type).toBe('loan_sale')
    })

    it('rejects trade with missing fields', async () => {
      const res = await request(app)
        .post('/api/trades')
        .send({ notional_amount: 5, price: 10, side: 'buy', counterparties: ['cp1'] })
      expect(res.statusCode).toBe(400)
    })

    it('rejects trade without price', async () => {
      const res = await request(app)
        .post('/api/trades')
        .send({ trade_type: 'loan_sale', notional_amount: 5, side: 'buy', counterparties: ['cp1'] })
      expect(res.statusCode).toBe(400)
    })

    it('rejects trade without side', async () => {
      const res = await request(app)
        .post('/api/trades')
        .send({ trade_type: 'loan_sale', notional_amount: 5, price: 10, counterparties: ['cp1'] })
      expect(res.statusCode).toBe(400)
    })

    it('rejects trade without counterparties', async () => {
      const res = await request(app)
        .post('/api/trades')
        .send({ trade_type: 'loan_sale', notional_amount: 5, price: 10, side: 'buy' })
      expect(res.statusCode).toBe(400)
    })
  })

  describe('listing trades with filters', () => {
     it('filters by type and status', async () => {
       await request(app)
        .post('/api/trades')
        .send({
          trade_type: 'loan_sale',
          notional_amount: 1,
          price: 10,
          side: 'buy',
          counterparties: ['cp1'],
          symbol: 'AAA'
        })
      const created = await request(app)
        .post('/api/trades')
        .send({
          trade_type: 'repo',
          notional_amount: 2,
          price: 20,
          side: 'sell',
          counterparties: ['cp2'],
          symbol: 'BBB'
        })
      await request(app).post(`/api/trades/${created.body.trade.id}/settle`)

      let res = await request(app).get('/api/trades?trade_type=loan_sale')
      expect(res.body.trades).toHaveLength(1)
      expect(res.body.trades[0].symbol).toBe('AAA')

      res = await request(app).get('/api/trades?status=settled')
      expect(res.body.trades).toHaveLength(1)
      expect(res.body.trades[0].status).toBe('settled')
    })
  })

  describe('settlement flow', () => {
    it('settles a trade after creation', async () => {
      const created = await request(app)
        .post('/api/trades')
       .send({
          trade_type: 'repo',
          notional_amount: 300,
          price: 30,
          side: 'buy',
          counterparties: ['cp1'],
          symbol: 'CCC'
        })
      const id = created.body.trade.id

      const res = await request(app).post(`/api/trades/${id}/settle`)
      expect(res.statusCode).toBe(200)
      expect(res.body.trade.status).toBe('settled')
      
      const collabServer = require('./collabServer')
      expect(collabServer.broadcast).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'trade.settled',
          trade: expect.objectContaining({ id })
        })
      )
    })
  })

  describe('with kyc feature flag', () => {
    beforeEach(() => {
      process.env.FEATURE_FLAGS = 'kyc'
      process.env.KYC_API_URL = 'http://kyc.test'
      process.env.KYC_API_KEY = 'key'
      global.fetch = jest.fn()
      jest.resetModules()
      app = buildApp()
    })

    it('rejects trade when kyc fails and prevents settlement', async () => {
      fetch.mockResolvedValue({ ok: true, json: async () => ({ passed: false }) })
      const res = await request(app)
        .post('/api/trades')
       .send({
          trade_type: 'loan_sale',
          notional_amount: 1,
          price: 10,
          side: 'buy',
          counterparties: ['cp1'],
          symbol: 'AAA'
        })
      expect(res.statusCode).toBe(400)

      const settle = await request(app).post('/api/trades/1/settle')
      expect(settle.statusCode).toBe(404)
    })

    it('allows trade and settlement when kyc passes', async () => {
      fetch.mockResolvedValue({ ok: true, json: async () => ({ passed: true }) })
      const created = await request(app)
        .post('/api/trades')
      .send({
          trade_type: 'loan_sale',
          notional_amount: 1,
          price: 10,
          side: 'buy',
          counterparties: ['cp1'],
          symbol: 'AAA'
        })
      expect(created.statusCode).toBe(201)

      const id = created.body.trade.id
      const settle = await request(app).post(`/api/trades/${id}/settle`)
      expect(settle.statusCode).toBe(200)
      expect(settle.body.trade.status).toBe('settled')
      expect(fetch).toHaveBeenCalled()
    })
  })
})
