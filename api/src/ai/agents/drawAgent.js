function runDrawAgent(drawData = {}) {
  const requestedAmount = Number(drawData.requested_amount || 0);
  const approvedAmount = Number(drawData.approved_amount || requestedAmount);
  const documentsProvided = Array.isArray(drawData.documents) ? drawData.documents : [];
  const requiredDocs = Array.isArray(drawData.required_documents) ? drawData.required_documents : [];
  const completionPct = Number(drawData.completion_percentage || 0);
  const invoiceTotal = Number(drawData.invoice_total || requestedAmount);

  const reasons = [];
  const evidence = documentsProvided
    .filter((d) => typeof d === 'object' && d.url)
    .map((d, i) => ({ label: d.label || `Document ${i + 1}`, url: d.url, kind: 'document' }));

  const missingDocs = requiredDocs.filter(
    (req) => !documentsProvided.some((d) => d.type === req || d.name === req)
  );
  if (missingDocs.length > 0) {
    reasons.push({
      code: 'MISSING_DOCS',
      message: `Missing required document(s): ${missingDocs.join(', ')}.`,
      severity: 'high',
    });
  }

  if (requestedAmount > invoiceTotal * 1.05) {
    reasons.push({
      code: 'OVER_REQUEST',
      message: `Requested $${requestedAmount.toFixed(2)} exceeds invoice total $${invoiceTotal.toFixed(2)} by more than 5%.`,
      severity: 'high',
    });
  }

  if (completionPct < 10 && requestedAmount > 0) {
    reasons.push({
      code: 'LOW_COMPLETION',
      message: `Draw requested at only ${completionPct}% project completion.`,
      severity: 'medium',
    });
  }

  const status = reasons.length > 0 ? 'needs_review' : 'pass';

  return {
    status,
    confidence: status === 'pass' ? 0.91 : 0.63,
    title: status === 'pass' ? 'Draw passed AI review' : 'Draw requires AI exception review',
    summary:
      status === 'pass'
        ? 'Draw package documentation and amounts appear complete and within tolerance.'
        : `Detected ${reasons.length} draw exception(s) requiring human review.`,
    reasons,
    evidence,
    recommended_actions:
      status === 'pass'
        ? [
            {
              action_type: 'approve_draw',
              label: 'Approve draw',
              payload: { approved_amount: approvedAmount },
              requires_approval: true,
            },
          ]
        : [
            {
              action_type: 'request_docs',
              label: 'Request missing documents',
              payload: { missing: missingDocs },
              requires_approval: true,
            },
            {
              action_type: 'reduce_amount',
              label: 'Reduce draw amount',
              payload: { recommended_amount: invoiceTotal },
              requires_approval: true,
            },
          ],
    proposed_updates: {
      requested_amount: requestedAmount,
      approved_amount: approvedAmount,
      completion_percentage: completionPct,
    },
  };
}

module.exports = { runDrawAgent };
