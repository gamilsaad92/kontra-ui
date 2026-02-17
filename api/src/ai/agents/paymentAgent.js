const THRESHOLD = 50;

const toNumber = (value) => {
  const parsed = typeof value === 'string' ? Number(value) : value;
  return Number.isFinite(parsed) ? Number(parsed) : null;
};

const toDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

function runPaymentAgent(paymentData = {}) {
  const expectedAmount = toNumber(paymentData.expected_amount);
  const receivedAmount = toNumber(paymentData.received_amount);
  const dueDate = toDate(paymentData.due_date);
  const receivedDate = toDate(paymentData.received_date);

  const reasons = [];
  const evidence = [];

  if (expectedAmount != null && receivedAmount != null && receivedAmount < expectedAmount - THRESHOLD) {
    reasons.push({
      code: 'SHORT_PAY',
      message: `Received $${receivedAmount.toFixed(2)} vs expected $${expectedAmount.toFixed(2)}.`,
      severity: 'high',
    });
  }

  if (expectedAmount != null && receivedAmount != null && receivedAmount > expectedAmount + THRESHOLD) {
    reasons.push({
      code: 'OVER_PAY',
      message: `Received $${receivedAmount.toFixed(2)} exceeds expected $${expectedAmount.toFixed(2)}.`,
      severity: 'med',
    });
  }

  if (dueDate && receivedDate && receivedDate.getTime() > dueDate.getTime()) {
    reasons.push({
      code: 'LATE_PAY',
      message: `Payment arrived ${Math.ceil((receivedDate - dueDate) / (1000 * 60 * 60 * 24))} day(s) after due date.`,
      severity: 'med',
    });
  }

  if ((paymentData.memo || '').trim().length === 0) {
    reasons.push({ code: 'MEMO_MISMATCH', message: 'Payment memo is missing or blank.', severity: 'low' });
  }

  const status = reasons.length > 0 ? 'needs_review' : 'pass';

  const recommendedActions = [
    {
      action_type: 'approve_posting',
      label: 'Approve posting',
      payload: {
        allocation: {
          principal: Math.max(0, Number(((receivedAmount || 0) * 0.7).toFixed(2))),
          interest: Math.max(0, Number(((receivedAmount || 0) * 0.2).toFixed(2))),
          escrow: Math.max(0, Number(((receivedAmount || 0) * 0.1).toFixed(2))),
        },
      },
      requires_approval: true,
    },
    {
      action_type: 'draft_borrower_email',
      label: 'Draft borrower email',
      payload: {
        remitter: paymentData.remitter || 'Borrower',
        expected_amount: expectedAmount,
        received_amount: receivedAmount,
      },
      requires_approval: true,
    },
    {
      action_type: 'route_to_ops',
      label: 'Route to payment ops',
      payload: { queue: 'payment-ops' },
      requires_approval: true,
    },
  ];

  return {
    status,
    confidence: status === 'pass' ? 0.9 : 0.62,
    title: status === 'pass' ? 'Payment passed AI review' : 'Payment requires AI exception review',
    summary:
      status === 'pass'
        ? 'No payment exceptions were detected by the rules engine.'
        : `Detected ${reasons.length} payment exception(s) requiring human review.`,
    reasons,
    evidence,
    recommended_actions: recommendedActions,
    proposed_updates: {
      normalized: {
        expected_amount: expectedAmount,
        received_amount: receivedAmount,
        due_date: paymentData.due_date || null,
        received_date: paymentData.received_date || null,
      },
    },
  };
}

module.exports = { runPaymentAgent };
