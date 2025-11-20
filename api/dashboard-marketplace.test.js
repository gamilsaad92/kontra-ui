const request = require('supertest');
const { app, resetSupabase, createClient } = require('./testUtils/app');

const authHeader = ['Authorization', 'Bearer test-token'];

describe('GET /api/dashboard/marketplace', () => {
  beforeEach(() => {
    resetSupabase();
  });

  it('returns aggregated marketplace metrics when data exists', async () => {
    const listings = [
      {
        id: 'listing-1',
        title: 'Starlight Tower',
        sector: 'Multifamily',
        geography: 'TX',
        par_amount: 5000000,
        occupancy_rate: 94,
        dscr: 1.32,
        marketplace_metrics: { dscrBuffer: 0.35, noiMargin: 18.2 },
        borrower_kpis: [{ name: 'Occupancy 94%' }, { name: 'DSCR 1.32x' }],
        compliance_hold: false,
        organization_id: 'org-1',
        updated_at: '2024-10-01T12:00:00Z',
      },
      {
        id: 'listing-2',
        title: 'Harbor Point',
        sector: 'Industrial',
        geography: 'CA',
        par_amount: 3250000,
        occupancy_rate: 88,
        dscr: 1.21,
        marketplace_metrics: { dscrBuffer: 0.28, noiMargin: 15.1 },
        borrower_kpis: [{ name: 'Occupancy 88%' }],
        compliance_hold: false,
        organization_id: 'org-1',
        updated_at: '2024-10-02T15:30:00Z',
      },
    ];

    createClient.__setTable('exchange_listings', { records: listings });

    const res = await request(app)
      .get('/api/dashboard/marketplace')
      .set(...authHeader);

    expect(res.statusCode).toBe(200);
    expect(res.body.totals).toEqual(
      expect.objectContaining({
        activeListings: 2,
        totalParAmount: expect.any(Number),
      })
    );
    expect(res.body.highlights).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'listing-1', title: 'Starlight Tower' }),
        expect.objectContaining({ id: 'listing-2', title: 'Harbor Point' }),
      ])
    );
    expect(res.body.borrowerKpiLeaders).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'Occupancy 94%', count: 1 }),
        expect.objectContaining({ name: 'Occupancy 88%', count: 1 }),
      ])
    );
    expect(res.body.updatedAt).toBe('2024-10-02T15:30:00.000Z');
  });
});
