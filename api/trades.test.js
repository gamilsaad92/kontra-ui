process.env.SUPABASE_URL = 'http://example.com'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test'
process.env.FEATURE_FLAGS = ''
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
const express = require('express')
const request = require('supertest')
const tradesRouter = require('./routers/trades')

const app = express()
app.use(express.json())
app.use('/api', tradesRouter)

beforeEach(() => {
  require('./db').__reset()
})

describe('POST /api/trades', () => {
  it('rejects trades exceeding risk limit', async () => {
    const res = await request(app)
      .post('/api/trades')
      .send({
        trade_type: 'loan_sale',
        notional_amount: 2000000,
        price: 100,
        side: 'buy',
        counterparties: ['cp1'],
        symbol: 'AAA'
      })
    expect(res.statusCode).toBe(400)
  })

  it('accepts trades within risk limit', async () => {
    const res = await request(app)
      .post('/api/trades')
      .send({
        trade_type: 'repo',
        notional_amount: 1000,
        price: 10,
        side: 'sell',
        counterparties: ['cp1'],
        symbol: 'BBB'
      })
    expect(res.statusCode).toBe(201)
    expect(res.body.trade).toBeDefined()
  })
})
