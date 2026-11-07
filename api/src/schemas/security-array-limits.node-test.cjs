const assert = require('node:assert/strict');
const test = require('node:test');
const { z } = require('../../lib/zod');
const aiReviews = require('./ai/reviews');
const servicingReviews = require('./servicing/aiReviews');
const exchangeSchemas = require('../../routers/exchangeInputSchemas');

test('Zod validation failures expose issue details for route error responses', () => {
  const result = z.string().safeParse(42);
  assert.equal(result.success, false);
  assert.equal(Array.isArray(result.error.issues), true);
  assert.equal(result.error.errors, undefined);
});

test('AI review reason arrays reject oversized content and accept bounded content', () => {
  const reasons = Array.from({ length: 100 }, () => ({
    code: 'CHECK',
    message: 'Review item',
    severity: 'low',
  }));
  assert.equal(aiReviews.AiReviewSchema.shape.reasons.safeParse(reasons).success, true);
  assert.equal(
    aiReviews.AiReviewSchema.shape.reasons.safeParse([...reasons, reasons[0]]).success,
    false,
  );
});

test('AI review response lists reject more than 100 records', () => {
  assert.equal(aiReviews.AiReviewsListResponseSchema.shape.items.safeParse([]).success, true);
  assert.equal(
    aiReviews.AiReviewsListResponseSchema.shape.items.safeParse(Array(101).fill({})).success,
    false,
  );
});

test('servicing request attachment arrays are bounded at 20', () => {
  const attachments = Array.from({ length: 20 }, () => ({}));
  assert.equal(
    servicingReviews.PaymentReviewRequestSchema.safeParse({
      paymentId: 'payment-1',
      attachments,
    }).success,
    true,
  );
  assert.equal(
    servicingReviews.PaymentReviewRequestSchema.safeParse({
      paymentId: 'payment-1',
      attachments: [...attachments, {}],
    }).success,
    false,
  );
  assert.equal(
    servicingReviews.ReviewInspectionRequestSchema.safeParse({
      inspectionId: 'inspection-1',
      attachments: [...attachments, {}],
    }).success,
    false,
  );
});

test('exchange request arrays have workflow-appropriate bounds', () => {
  const listing = {
    asset_type: 'loan',
    title: 'Test loan',
    par_amount: 100,
    rate_type: 'fixed',
  };
  assert.equal(
    exchangeSchemas.listingSchema.safeParse({
      ...listing,
      borrower_kpis: Array(100).fill({ name: 'DSCR' }),
      dscr_trend: Array(120).fill({ period: 'month', dscr: 1.2 }),
      invitee_org_ids: Array(100).fill('org'),
    }).success,
    true,
  );
  assert.equal(
    exchangeSchemas.listingSchema.safeParse({
      ...listing,
      borrower_kpis: Array(101).fill({ name: 'DSCR' }),
    }).success,
    false,
  );
  assert.equal(
    exchangeSchemas.listingSchema.safeParse({
      ...listing,
      dscr_trend: Array(121).fill({ period: 'month', dscr: 1.2 }),
    }).success,
    false,
  );
  assert.equal(
    exchangeSchemas.tradeUpdateSchema.safeParse({ documents: Array(101).fill('doc') }).success,
    false,
  );
});
