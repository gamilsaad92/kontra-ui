const request = require('supertest');
const { app, resetSupabase, createClient } = require('./testUtils/app');

beforeEach(() => {
  resetSupabase();
});

describe('AI reviews contract validation', () => {
  it('returns structured validation error for invalid payment review payload', async () => {
    const response = await request(app)
      .post('/api/ai/payments/review')
      .set('x-org-id', 'org-1')
      .send({});

    expect(response.statusCode).toBe(400);
    expect(response.body.code).toBe('VALIDATION_ERROR');
    expect(Array.isArray(response.body.details)).toBe(true);
  });

  it('returns validated reviews list response', async () => {
    createClient.__setTable('ai_reviews', {
      records: [
        {
          id: 'review-1',
          org_id: 'org-1',
          loan_id: 'loan-1',
          project_id: null,
          type: 'payment',
          source_id: 'payment-1',
          status: 'needs_review',
          confidence: 0.8,
          title: 'Payment variance',
          summary: 'Amount mismatch',
          reasons: [],
          evidence: [],
          recommended_actions: [],
          proposed_updates: {},
          created_by: 'ai',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ],
    });

    const response = await request(app)
      .get('/api/ai/reviews?type=payment')
      .set('x-org-id', 'org-1');

    expect(response.statusCode).toBe(200);
    expect(Array.isArray(response.body.reviews)).toBe(true);
    expect(response.body.reviews[0].id).toBe('review-1');
  });
});
