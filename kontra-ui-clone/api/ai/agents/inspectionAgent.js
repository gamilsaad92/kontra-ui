const safeDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const matchLabel = (label = '', token) =>
  label.toLowerCase().includes(token.toLowerCase());

const photoChecklist = (attachments = []) => {
  const required = ['wide_shot', 'unit_id', 'before_after'];
  const available = [];

  attachments.forEach((attachment) => {
    const label = attachment.label || attachment.kind || '';
    if (matchLabel(label, 'wide')) available.push('wide_shot');
    if (matchLabel(label, 'unit')) available.push('unit_id');
    if (matchLabel(label, 'before') || matchLabel(label, 'after')) {
      available.push('before_after');
    }
  });

  const uniqueAvailable = Array.from(new Set(available));
  const missing = required.filter((item) => !uniqueAvailable.includes(item));

  return {
    required,
    available: uniqueAvailable,
    missing,
  };
};

const mapScopeEvidence = (scopeItems = [], attachments = []) => {
  const hasEvidence = attachments.length > 0;
  return scopeItems.map((item) => {
    const claimedPct = item.claimedPct ?? item.completedPct ?? item.claimed_pct ?? 0;
    const supportedPct = hasEvidence
      ? Math.max(0, Math.min(claimedPct, 100))
      : 0;
    return {
      lineItemId: item.lineItemId ?? item.id ?? item.line_item_id ?? 'unknown',
      claimedPct,
      supportedPct,
      reason: hasEvidence
        ? 'Evidence set includes photos that partially support completion.'
        : 'No evidence attached to support scope completion.',
    };
  });
};

/**
 * @param {import('../types').AiReviewInput} input
 * @returns {import('../types').AiReviewOutput}
 */
const runInspectionAgent = (input) => {
  const context = input.context || {};
  const attachments = input.attachments || [];
  const reasons = [];
  const evidence = attachments.map((attachment, index) => ({
    label: attachment.label || `Inspection photo ${index + 1}`,
    url: attachment.url || '',
    kind: attachment.kind || 'photo',
    excerpt: attachment.excerpt,
  }));

  const checklist = photoChecklist(attachments);
  if (attachments.length === 0) {
    reasons.push({
      code: 'missing_required_photos',
      message: 'No inspection photos were provided.',
      severity: 'high',
    });
  } else if (checklist.missing.length > 0) {
    reasons.push({
      code: 'missing_required_photos',
      message: `Missing photo types: ${checklist.missing.join(', ')}.`,
      severity: 'medium',
    });
  }

  const scopeItems = context.scope_items || context.sov_items || [];
  const scopeEvidence = mapScopeEvidence(scopeItems, attachments);
  if (scopeItems.length > 0 && scopeEvidence.some((item) => item.supportedPct === 0)) {
    reasons.push({
      code: 'insufficient_scope_evidence',
      message: 'Scope items lack supporting inspection evidence.',
      severity: 'medium',
    });
  }

  const dueDate = safeDate(context.due_date);
  if (dueDate && new Date() > dueDate) {
    reasons.push({
      code: 'timeline_delay_risk',
      message: 'Inspection occurs after the scheduled due date.',
      severity: 'low',
    });
  }

  const status = reasons.some((reason) => reason.severity === 'high')
    ? 'fail'
    : reasons.length > 0
      ? 'needs_review'
      : 'pass';

  const confidence = status === 'pass' ? 0.84 : status === 'fail' ? 0.32 : 0.54;

  const recommendedActions = [];
  if (status === 'pass') {
    recommendedActions.push({
      action_type: 'approve_release_funds',
      label: 'Approve release of funds',
      payload: { scopeItems: scopeItems.map((item) => item.id ?? item.lineItemId) },
      requires_approval: true,
    });
  } else {
    recommendedActions.push(
      {
        action_type: 'request_missing_photos',
        label: 'Request missing inspection photos',
        payload: { missing: checklist.missing },
        requires_approval: true,
      },
      {
        action_type: 'order_reinspection',
        label: 'Order reinspection',
        payload: { reason: 'Insufficient evidence for scope completion.' },
        requires_approval: true,
      }
    );
  }

  let title = 'Inspection validated';
  if (reasons.some((reason) => reason.code === 'missing_required_photos')) {
    title = 'Inspection needs review: missing required photos';
  } else if (reasons.some((reason) => reason.code === 'insufficient_scope_evidence')) {
    title = 'Inspection needs review: scope evidence mismatch';
  } else if (status === 'fail') {
    title = 'Inspection failed validation';
  }

  const summary = status === 'pass'
    ? 'Inspection evidence appears complete and matches the reported scope.'
    : 'Inspection evidence requires human review before any servicing action.';

  return {
    status,
    confidence,
    title,
    summary,
    reasons,
    evidence,
    recommended_actions: recommendedActions,
    proposed_updates: {
      photo_checklist: checklist,
      scope_to_evidence: scopeEvidence,
    },
  };
};

module.exports = { runInspectionAgent };
