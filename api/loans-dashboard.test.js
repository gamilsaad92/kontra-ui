const request = require('supertest');
const { app, resetSupabase, createClient } = require('./testUtils/app');

const authHeader = ['Authorization', 'Bearer test-token'];

describe('Loans dashboard routes', () => {
  beforeEach(() => {
    resetSupabase();
  });

  describe('GET /api/loans/dscr-metrics', () => {
    it('returns DSCR metrics from Supabase when available', async () => {
      createClient.__setTable('loan_dscr_metrics', {
        records: [
          {
            loan_id: 'LN-999',
            borrower_name: 'Example Borrower',
            principal: 1000000,
            dscr: 1.4,
            target_dscr: 1.2,
            base_coupon: 6.15,
            rate_floor: 5.4,
            rate_cap: 7.3,
            rate_sensitivity: 1.55,
            interest_accrued_month: 50250,
            last_recalculated: '2024-09-29T10:00:00Z',
            next_reset: '2024-10-29T10:00:00Z',
            automation_notes: 'Latest automation run completed successfully.',
            organization_id: 'org-1',
          },
        ],
      });
      createClient.__setTable('loan_dscr_jobs', {
        maybeSingle: {
          last_run: '2024-09-29T10:00:00Z',
          next_run: '2024-10-29T10:00:00Z',
          status: 'Active',
          organization_id: 'org-1',
        },
      });

      const res = await request(app).get('/api/loans/dscr-metrics').set(...authHeader);

      expect(res.statusCode).toBe(200);
      expect(res.body.loans).toHaveLength(1);
      expect(res.body.loans[0]).toMatchObject({
        id: 'LN-999',
        borrower: 'Example Borrower',
        principal: 1000000,
        dscr: 1.4,
        targetDscr: 1.2,
        baseCoupon: 6.15,
        rateFloor: 5.4,
        rateCap: 7.3,
        rateSensitivity: 1.55,
        interestAccruedMonth: 50250,
        automationNotes: 'Latest automation run completed successfully.',
      });
      expect(res.body.job).toMatchObject({
        lastRun: '2024-09-29T10:00:00Z',
        nextRun: '2024-10-29T10:00:00Z',
        status: 'Active',
      });
      expect(res.body.lastRun).toBe('2024-09-29T10:00:00Z');
      expect(res.body.nextRun).toBe('2024-10-29T10:00:00Z');
    });

    it('falls back to seeded DSCR dataset when Supabase has no rows', async () => {
      const res = await request(app).get('/api/loans/dscr-metrics').set(...authHeader);

      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body.loans)).toBe(true);
      expect(res.body.loans.length).toBeGreaterThan(0);
      res.body.loans.forEach(loan => {
        expect(loan).toHaveProperty('id');
        expect(loan).toHaveProperty('borrower');
        expect(loan).toHaveProperty('dscr');
        expect(loan).toHaveProperty('targetDscr');
        expect(loan).toHaveProperty('baseCoupon');
      });
      expect(res.body.job).toHaveProperty('status');
      expect(res.body.lastRun).toBe(res.body.job.lastRun);
      expect(res.body.nextRun).toBe(res.body.job.nextRun);
    });
  });

  describe('GET /api/loans/performance-fees', () => {
    it('returns performance fee data from Supabase when available', async () => {
      createClient.__setTable('loan_performance_fees', {
        records: [
          {
            loan_id: 'LN-555',
            borrower_name: 'Performance Holdings',
            profit_share_pct: 0.19,
            noi_target: 900000,
            actual_noi: 940000,
            pref_return: 0.071,
            lender_split: 0.81,
            sponsor_split: 0.19,
            reserve_balance: 150000,
            last_waterfall: '2024-09-27T15:00:00Z',
            organization_id: 'org-1',
          },
        ],
      });

      const res = await request(app).get('/api/loans/performance-fees').set(...authHeader);

      expect(res.statusCode).toBe(200);
      expect(res.body.loans).toHaveLength(1);
      expect(res.body.loans[0]).toMatchObject({
        id: 'LN-555',
        borrower: 'Performance Holdings',
        profitSharePct: 0.19,
        noiTarget: 900000,
        actualNoi: 940000,
        prefReturn: 0.071,
        lenderSplit: 0.81,
        sponsorSplit: 0.19,
        reserveBalance: 150000,
        lastWaterfall: '2024-09-27T15:00:00Z',
      });
    });

    it('returns seeded performance fee data when Supabase is empty', async () => {
      const res = await request(app).get('/api/loans/performance-fees').set(...authHeader);

      expect(res.statusCode).toBe(200);
      expect(res.body.loans.length).toBeGreaterThan(0);
      res.body.loans.forEach(loan => {
        expect(loan).toHaveProperty('profitSharePct');
        expect(loan).toHaveProperty('noiTarget');
        expect(loan).toHaveProperty('actualNoi');
      });
    });
  });

  describe('GET /api/loans/green-kpis', () => {
    it('returns green KPI data from Supabase when available', async () => {
      createClient.__setTable('loan_green_kpis', {
        records: [
          {
            loan_id: 'LN-777',
            borrower_name: 'Green Estates',
            base_coupon: 5.7,
            rate_floor: 5.1,
            rate_cap: 6.8,
            last_ingested: '2024-09-28T11:00:00Z',
            energy_provider: 'GreenStream',
            kpis: [
              {
                name: 'Energy Intensity',
                unit: 'kWh/sf',
                baseline: 20,
                current: 18,
                target: 17,
                direction: 'decrease',
                rate_delta_bps: -9,
                source: 'Telemetry',
              },
            ],
            organization_id: 'org-1',
          },
        ],
      });
      createClient.__setTable('loan_green_feed_status', {
        maybeSingle: {
          provider: 'GreenStream',
          last_sync: '2024-09-28T11:05:00Z',
          status: 'Streaming',
          organization_id: 'org-1',
        },
      });

      const res = await request(app).get('/api/loans/green-kpis').set(...authHeader);

      expect(res.statusCode).toBe(200);
      expect(res.body.loans).toHaveLength(1);
      expect(res.body.loans[0]).toMatchObject({
        id: 'LN-777',
        borrower: 'Green Estates',
        baseCoupon: 5.7,
        rateFloor: 5.1,
        rateCap: 6.8,
        lastIngested: '2024-09-28T11:00:00Z',
        energyProvider: 'GreenStream',
      });
      expect(Array.isArray(res.body.loans[0].kpis)).toBe(true);
      expect(res.body.loans[0].kpis[0]).toMatchObject({
        name: 'Energy Intensity',
        unit: 'kWh/sf',
        baseline: 20,
        current: 18,
        target: 17,
        direction: 'decrease',
        rateDeltaBps: -9,
        source: 'Telemetry',
      });
      expect(res.body.feed).toMatchObject({
        provider: 'GreenStream',
        lastSync: '2024-09-28T11:05:00Z',
        status: 'Streaming',
      });
    });

    it('returns seeded green KPI data when Supabase is empty', async () => {
      const res = await request(app).get('/api/loans/green-kpis').set(...authHeader);

      expect(res.statusCode).toBe(200);
      expect(res.body.loans.length).toBeGreaterThan(0);
      expect(res.body.loans[0]).toHaveProperty('kpis');
      expect(Array.isArray(res.body.loans[0].kpis)).toBe(true);
      expect(res.body.feed).toHaveProperty('provider');
      expect(res.body.feed).toHaveProperty('status');
    });
  });
});
