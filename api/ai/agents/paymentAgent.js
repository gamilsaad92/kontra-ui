const DEFAULT_GRACE_DAYS = 5;

const toNumber = (value) => {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value.trim() !== '') return Number(value);
  return undefined;
};

const safeDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const daysBetween = (from, to) => {
  if (!from || !to) return null;
  const diffMs = to.getTime() - from.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
};

const buildAllocation = (receivedAmount, proposed) => {
  if (proposed && typeof proposed === 'object') {
    return proposed;
  }
  const total = toNumber(receivedAmount) || 0;
  const interest = Number((total * 0.3).toFixed(2));
  const escrow = Number((total * 0.1).toFixed(2));
  const fees = Number((total * 0.05).toFixed(2));
  const defaultInterest = Number((total * 0.05).toFixed(2));
  const principal = Number((total - interest - escrow - fees - defaultInterest).toFixed(2));
  return {
    principal: Math.max(principal, 0),
    interest,
    escrow,
    fees,
    default_interest: defaultInterest,
    suspense: 0,
  };
};

/**
 * @param {import('../types').AiReviewInput} input
 * @returns {import('../types').AiReviewOutput}
 */
const runPaymentAgent = (input) => {
  const context = input.context || {};
  const reasons = [];
  const evidence = (input.attachments || []).map((attachment, index) => ({
    label: attachment.label || `Attachment ${index + 1}`,
    url: attachment.url || '',
    kind: attachment.kind || 'document',
    excerpt: attachment.excerpt,
  }));

  const expectedAmount = toNumber(context.expected_amount);
  const receivedAmount = toNumber(context.received_amount);
  const dueDate = safeDate(context.due_date);
  const receivedDate = safeDate(context.received_date);
  const graceDays = toNumber(context?.late_fee_rules?.grace_days) ?? DEFAULT_GRACE_DAYS;

  if (context.suspected_fraud) {
    reasons.push({
      code: 'suspected_fraud',
      message: 'Potential fraud indicator detected in payment metadata.',
      severity: 'high',
    });
  }

  if (expectedAmount == null || receivedAmount == null) {
    reasons.push({
      code: 'missing_amounts',
      message: 'Payment amounts are incomplete; verify expected vs received.',
      severity: 'medium',
    });
  }

  if (expectedAmount != null && receivedAmount != null) {
    const shortBy = Number((expectedAmount - receivedAmount).toFixed(2));
    if (shortBy > 1) {
      reasons.push({
        code: 'short_pay',
        message: `Received amount is short by $${shortBy}.`,
        severity: 'high',
      });
    }
  }

  if (dueDate && receivedDate) {
    const lateBy = daysBetween(dueDate, receivedDate);
    if (lateBy != null && lateBy > graceDays) {
      reasons.push({
        code: 'late_pay',
        message: `Payment received ${lateBy} days after due date.`,
        severity: 'medium',
      });
    }
  }

  if (context.expected_remitter && context.remitter_name) {
    if (
      !String(context.remitter_name)
        .toLowerCase()
        .includes(String(context.expected_remitter).toLowerCase())
    ) {
      reasons.push({
        code: 'remitter_mismatch',
        message: 'Remitter name does not match the expected borrower entity.',
        severity: 'medium',
      });
    }
  }

  if (context.expected_memo && context.memo) {
    if (
      !String(context.memo)
        .toLowerCase()
        .includes(String(context.expected_memo).toLowerCase())
    ) {
      reasons.push({
        code: 'memo_mismatch',
        message: 'Payment memo does not match the expected reference.',
        severity: 'low',
      });
    }
  }

  const hasHighSeverity = reasons.some((reason) => reason.severity === 'high');
  const hasReasons = reasons.length > 0;
  const status = hasHighSeverity
    ? reasons.some((reason) => reason.code === 'suspected_fraud')
      ? 'fail'
      : 'needs_review'
    : hasReasons
      ? 'needs_review'
      : 'pass';

  const confidence = status === 'pass' ? 0.86 : status === 'fail' ? 0.35 : 0.56;

  const allocation = buildAllocation(receivedAmount, context.proposed_allocation);
  const proposedUpdates = {
    proposed_allocation: allocation,
    posting_notes: context.posting_notes || 'AI proposal generated for reviewer approval.',
  };

  const recommendedActions = [
    {
      action_type: 'approve_posting',
      label: 'Approve posting proposal',
      payload: { allocation },
      requires_approval: true,
    },
  ];

  if (status !== 'pass') {
    recommendedActions.push(
      {
        action_type: 'draft_borrower_email',
        label: 'Draft borrower clarification email',
        payload: {
          remitterName: context.remitter_name || '',
          receivedAmount: receivedAmount || 0,
          expectedAmount: expectedAmount || 0,
        },
        requires_approval: true,
      },
      {
        action_type: 'route_to_ops',
        label: 'Route to Operations',
        payload: { queue: 'payments-exceptions' },
        requires_approval: true,
      }
    );
  }

  let title = 'Payment cleared for posting';
  if (reasons.some((reason) => reason.code === 'short_pay')) {
    const shortReason = reasons.find((reason) => reason.code === 'short_pay');
    title = `Payment exception: ${shortReason.message}`;
  } else if (reasons.some((reason) => reason.code === 'late_pay')) {
    title = 'Payment exception: Late payment received';
  } else if (reasons.some((reason) => reason.code === 'remitter_mismatch')) {
    title = 'Payment exception: Remitter mismatch';
  } else if (status === 'fail') {
    title = 'Payment failed validation';
  }

  const summary = status === 'pass'
    ? 'Payment matches expected terms and is ready for posting approval.'
    : 'Payment requires human review before posting or borrower communication.';

  return {
    status,
    confidence,
    title,
    summary,
    reasons,
    evidence,
    recommended_actions: recommendedActions,
    proposed_updates: proposedUpdates,
  };
};

module.exports = { runPaymentAgent };
