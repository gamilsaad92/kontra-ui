const request = require('supertest');
const { app } = require('./testUtils/app');

describe('Autonomous Credit Operating Graph API', () => {
  beforeEach(() => {
    const { autonomousCreditGraph } = require('./autonomousCreditGraph');
    autonomousCreditGraph.reset();
  });

  it('requires payload when ingesting data', async () => {
    const res = await request(app).post('/api/credit-graph/ingest').send({});
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/at least one/i);
  });

  it('ingests borrower, asset, and telemetry data and returns snapshot', async () => {
    const payload = {
      borrowers: [
        {
          id: 'b-1',
          name: 'Acme Holdings',
          payment_history: [
            { period: '2024-01', status: 'on_time' },
            { period: '2024-02', status: 'late', days_late: 5 },
          ],
          total_commitment: 2500000,
        },
      ],
      assets: [
        {
          id: 'a-1',
          borrowerId: 'b-1',
          value: 4500000,
          net_operating_income: 180000,
        },
      ],
      covenants: [
        {
          id: 'c-1',
          borrowerId: 'b-1',
          status: 'satisfied',
          breaches: [],
        },
      ],
      telemetry: [
        {
          borrowerId: 'b-1',
          source: 'property-management',
          metrics: { health: 0.82, sentiment: 0.3 },
        },
      ],
    };

    const res = await request(app).post('/api/credit-graph/ingest').send(payload);
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('ingested');
    expect(res.body.fabric.borrowers).toHaveLength(1);
    expect(res.body.fabric.weights.paymentHistory).toBeGreaterThan(0);

    const snapshot = await request(app).get('/api/credit-graph/snapshot');
    expect(snapshot.statusCode).toBe(200);
    expect(Array.isArray(snapshot.body.borrowers)).toBe(true);
    expect(snapshot.body.borrowers[0].borrowerId).toBe('b-1');
  });

  it('returns borrower summary or 404 if not found', async () => {
    const missing = await request(app).get('/api/credit-graph/borrowers/unknown');
    expect(missing.statusCode).toBe(404);

    await request(app)
      .post('/api/credit-graph/ingest')
      .send({ borrowers: [{ id: 'b-1', payment_history: [{ period: '2024-03', status: 'on_time' }] }] });

    const found = await request(app).get('/api/credit-graph/borrowers/b-1');
    expect(found.statusCode).toBe(200);
    expect(found.body.borrowerId).toBe('b-1');
    expect(found.body.riskScore).toBeGreaterThan(0);
  });

  it('validates feedback payloads and applies learning', async () => {
    await request(app)
      .post('/api/credit-graph/ingest')
      .send({ borrowers: [{ id: 'b-1', payment_history: [{ period: '2024-03', status: 'on_time' }] }] });

    const invalid = await request(app).post('/api/credit-graph/feedback').send({ borrowerId: 'b-1' });
    expect(invalid.statusCode).toBe(400);

    const response = await request(app)
      .post('/api/credit-graph/feedback')
      .send({ borrowerId: 'b-1', signal: 'paymentHistory', direction: 'positive', magnitude: 2 });
    expect(response.statusCode).toBe(200);
    expect(response.body.weights.paymentHistory).toBeGreaterThan(0.3);
    expect(response.body.evaluation.borrowerId).toBe('b-1');
  });
});
