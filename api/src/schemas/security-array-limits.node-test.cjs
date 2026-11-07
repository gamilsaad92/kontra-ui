const assert = require('node:assert/strict');
const test = require('node:test');
const aiReviews = require('./ai/reviews');
const servicingReviews = require('./servicing/aiReviews');

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
