const request = require('supertest');
const { app, resetSupabase, createClient } = require('./testUtils/app');

describe('loan amortization schedules', () => {
  let scheduleRecords;

  beforeEach(() => {
    resetSupabase();
    scheduleRecords = [];

    createClient.__setTable('loans', {
      maybeSingle: {
        id: 'loan-123',
        amount: 12000,
        interest_rate: 6,
        term_months: 12,
        start_date: '2024-01-01',
      },
    });

    createClient.__setTable('amortization_schedules', {
      records: scheduleRecords,
      insert: rows => {
        const entries = Array.isArray(rows) ? rows : [rows];
        scheduleRecords.push(...entries);
        return entries;
      },
    });
  });

  it('does not create duplicate rows on repeated generation', async () => {
    const first = await request(app)
      .post('/api/loans/loan-123/generate-schedule')
      .set('Authorization', 'Bearer test-token');

    expect(first.statusCode).toBe(200);
    expect(first.body.schedule).toHaveLength(12);
    expect(scheduleRecords).toHaveLength(12);

    const second = await request(app)
      .post('/api/loans/loan-123/generate-schedule')
      .set('Authorization', 'Bearer test-token');

    expect(second.statusCode).toBe(200);
    expect(second.body.schedule).toHaveLength(12);
    expect(second.body.schedule).toEqual(first.body.schedule);
    expect(scheduleRecords).toHaveLength(12);
  });
});
