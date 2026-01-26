const express = require('express');
const { supabase } = require('../db');
const requireOrg = require('../middlewares/requireOrg');
const { runPaymentAgent } = require('../ai/agents/paymentAgent');
const { runInspectionAgent } = require('../ai/agents/inspectionAgent');

const router = express.Router();

const isAiReviewsEnabled = () => process.env.AI_REVIEWS_ENABLED !== 'false';
const isAiExecutionEnabled = () => process.env.AI_EXECUTION_ENABLED === 'true';

const guardAiReviews = (req, res) => {
  if (!isAiReviewsEnabled()) {
    res.status(404).json({ message: 'AI reviews are disabled.' });
    return false;
  }
  return true;
};

const nowIso = () => new Date().toISOString();

router.use(requireOrg);

router.post('/ai/payments/review', async (req, res) => {
  if (!guardAiReviews(req, res)) return;
  const sourceId = req.body?.paymentId ?? req.body?.sourceId;
  if (!sourceId) {
    return res.status(400).json({ message: 'paymentId is required.' });
  }

  const { data: payment } = await supabase
    .from('payments')
    .select('*')
    .eq('id', sourceId)
    .eq('org_id', req.orgId)
    .maybeSingle();

  const loanId = req.body?.loanId ?? payment?.loan_id ?? null;
  const projectId = req.body?.projectId ?? payment?.project_id ?? null;
  const context = {
    expected_amount: payment?.expected_amount ?? req.body?.context?.expected_amount,
    due_date: payment?.due_date ?? req.body?.context?.due_date,
    received_amount: payment?.amount ?? req.body?.context?.received_amount,
    received_date: payment?.received_date ?? payment?.created_at ?? req.body?.context?.received_date,
    remitter_name: payment?.remitter_name ?? req.body?.context?.remitter_name,
    memo: payment?.memo ?? req.body?.context?.memo,
    expected_remitter: req.body?.context?.expected_remitter,
    expected_memo: req.body?.context?.expected_memo,
    last_payment_dates: req.body?.context?.last_payment_dates,
    escrow_due: req.body?.context?.escrow_due,
    late_fee_rules: req.body?.context?.late_fee_rules,
    suspected_fraud: req.body?.context?.suspected_fraud,
    proposed_allocation: req.body?.context?.proposed_allocation,
    posting_notes: req.body?.context?.posting_notes,
  };

  const input = {
    orgId: req.orgId,
    loanId,
    projectId,
    type: 'payment',
    sourceId: String(sourceId),
    attachments: req.body?.attachments || [],
    context,
  };

  const output = runPaymentAgent(input);
  const timestamp = nowIso();
  const insertPayload = {
    org_id: req.orgId,
    loan_id: loanId,
    project_id: projectId,
    type: 'payment',
    source_id: String(sourceId),
    status: output.status,
    confidence: output.confidence,
    title: output.title,
    summary: output.summary,
    reasons: output.reasons,
    evidence: output.evidence,
    recommended_actions: output.recommended_actions,
    proposed_updates: output.proposed_updates,
    created_by: 'ai',
    created_at: timestamp,
    updated_at: timestamp,
  };

  const { data, error } = await supabase
    .from('ai_reviews')
    .insert(insertPayload)
    .select('*')
    .single();

  if (error) {
    return res.status(500).json({ message: 'Unable to create AI review.', error });
  }

  return res.status(201).json({ review: data });
});

router.post('/ai/inspections/review', async (req, res) => {
  if (!guardAiReviews(req, res)) return;
  const sourceId = req.body?.inspectionId ?? req.body?.sourceId;
  if (!sourceId) {
    return res.status(400).json({ message: 'inspectionId is required.' });
  }

  const { data: inspection } = await supabase
    .from('inspections')
    .select('*')
    .eq('id', sourceId)
    .eq('org_id', req.orgId)
    .maybeSingle();

  const loanId = req.body?.loanId ?? inspection?.loan_id ?? null;
  const projectId = req.body?.projectId ?? inspection?.project_id ?? null;

  const input = {
    orgId: req.orgId,
    loanId,
    projectId,
    type: 'inspection',
    sourceId: String(sourceId),
    attachments: req.body?.attachments || inspection?.attachments || [],
    context: {
      scope_items: req.body?.context?.scope_items ?? inspection?.scope_items ?? [],
      inspection_notes: req.body?.context?.inspection_notes ?? inspection?.notes,
      due_date: req.body?.context?.due_date ?? inspection?.due_date,
    },
  };

  const output = runInspectionAgent(input);
  const timestamp = nowIso();
  const insertPayload = {
    org_id: req.orgId,
    loan_id: loanId,
    project_id: projectId,
    type: 'inspection',
    source_id: String(sourceId),
    status: output.status,
    confidence: output.confidence,
    title: output.title,
    summary: output.summary,
    reasons: output.reasons,
    evidence: output.evidence,
    recommended_actions: output.recommended_actions,
    proposed_updates: output.proposed_updates,
    created_by: 'ai',
    created_at: timestamp,
    updated_at: timestamp,
  };

  const { data, error } = await supabase
    .from('ai_reviews')
    .insert(insertPayload)
    .select('*')
    .single();

  if (error) {
    return res.status(500).json({ message: 'Unable to create AI review.', error });
  }

  return res.status(201).json({ review: data });
});

router.get('/ai/reviews', async (req, res) => {
  if (!guardAiReviews(req, res)) return;
  const { type, status, loanId, projectId } = req.query || {};

  let query = supabase
    .from('ai_reviews')
    .select('*')
    .eq('org_id', req.orgId)
    .order('updated_at', { ascending: false });

  if (type) query = query.eq('type', type);
  if (status) query = query.eq('status', status);
  if (loanId) query = query.eq('loan_id', loanId);
  if (projectId) query = query.eq('project_id', projectId);

  const { data, error } = await query;
  if (error) {
    return res.status(500).json({ message: 'Unable to load AI reviews.', error });
  }

  return res.json({ reviews: data || [] });
});

router.post('/ai/reviews/:id/mark', async (req, res) => {
  if (!guardAiReviews(req, res)) return;
  const { id } = req.params;
  const { status } = req.body || {};
  if (!['pass', 'needs_review', 'fail'].includes(status)) {
    return res.status(400).json({ message: 'Invalid status.' });
  }

  const { data, error } = await supabase
    .from('ai_reviews')
    .update({ status, updated_at: nowIso() })
    .eq('id', id)
    .eq('org_id', req.orgId)
    .select('*')
    .single();

  if (error) {
    return res.status(500).json({ message: 'Unable to update AI review.', error });
  }

  return res.json({ review: data });
});

router.post('/ai/reviews/:id/approve-action', async (req, res) => {
  if (!guardAiReviews(req, res)) return;
  const { id } = req.params;
  const { action_type, action_payload, notes } = req.body || {};
  if (!action_type) {
    return res.status(400).json({ message: 'action_type is required.' });
  }

  const { data, error } = await supabase
    .from('ai_review_actions')
    .insert({
      review_id: id,
      action_type,
      action_payload: action_payload || {},
      outcome: 'approved',
      notes: notes || null,
      actor_id: req.headers['x-user-id'] || null,
      created_at: nowIso(),
    })
    .select('*')
    .single();

  if (error) {
    return res.status(500).json({ message: 'Unable to record approval.', error });
  }

  const executionEnabled = isAiExecutionEnabled();

  return res.json({
    approval: data,
    executionEnabled,
    message: executionEnabled
      ? 'Approval recorded. Execution enabled.'
      : 'Approval recorded. Execution disabled.',
  });
});

module.exports = { router };
