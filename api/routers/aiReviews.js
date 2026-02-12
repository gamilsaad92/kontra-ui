const express = require('express');
const { ZodError } = require('../lib/zod');
const { supabase } = require('../db');
const requireOrg = require('../middlewares/requireOrg');
const { runPaymentAgent } = require('../ai/agents/paymentAgent');
const { runInspectionAgent } = require('../ai/agents/inspectionAgent');
const {
  PaymentReviewRequestSchema,
  ReviewInspectionRequestSchema,
  ReviewsListQuerySchema,
  MarkReviewRequestSchema,
  ApproveActionRequestSchema,
  ReviewResponseSchema,
  ReviewsListResponseSchema,
  ApproveActionResponseSchema,
} = require('../src/schemas/servicing/aiReviews');

const router = express.Router();

const isAiReviewsEnabled = () => process.env.AI_REVIEWS_ENABLED !== 'false';
const isAiExecutionEnabled = () => process.env.AI_EXECUTION_ENABLED === 'true';

const guardAiReviews = (req, res) => {
  if (!isAiReviewsEnabled()) {
   res.status(404).json({ code: 'FEATURE_DISABLED', message: 'AI reviews are disabled.' });
    return false;
  }
  return true;
};

const nowIso = () => new Date().toISOString();

const validationError = (res, error) => {
  if (!(error instanceof ZodError)) {
    return res.status(500).json({ code: 'SERVER_ERROR', message: 'Unexpected validation error.' });
  }
  return res.status(400).json({
    code: 'VALIDATION_ERROR',
    message: 'Request validation failed.',
    details: error.issues,
  });
};

const parseInput = (schema, payload) => schema.parse(payload || {});

const sendValidated = (res, schema, payload, status = 200) => {
  const parsed = schema.parse(payload);
  return res.status(status).json(parsed);
};

router.use(requireOrg);

router.post('/ai/payments/review', async (req, res) => {
  if (!guardAiReviews(req, res)) return;

  let body;
  try {
    body = parseInput(PaymentReviewRequestSchema, req.body);
  } catch (error) {
    return validationError(res, error);
  }

   const sourceId = body.paymentId ?? body.sourceId;

  const { data: payment } = await supabase
    .from('payments')
    .select('*')
    .eq('id', sourceId)
    .eq('org_id', req.orgId)
    .maybeSingle();

  const loanId = body.loanId ?? payment?.loan_id ?? null;
  const projectId = body.projectId ?? payment?.project_id ?? null;
  const context = {
      expected_amount: payment?.expected_amount ?? body.context?.expected_amount,
    due_date: payment?.due_date ?? body.context?.due_date,
    received_amount: payment?.amount ?? body.context?.received_amount,
    received_date: payment?.received_date ?? payment?.created_at ?? body.context?.received_date,
    remitter_name: payment?.remitter_name ?? body.context?.remitter_name,
    memo: payment?.memo ?? body.context?.memo,
    expected_remitter: body.context?.expected_remitter,
    expected_memo: body.context?.expected_memo,
    last_payment_dates: body.context?.last_payment_dates,
    escrow_due: body.context?.escrow_due,
    late_fee_rules: body.context?.late_fee_rules,
    suspected_fraud: body.context?.suspected_fraud,
    proposed_allocation: body.context?.proposed_allocation,
    posting_notes: body.context?.posting_notes,
  };

  const input = {
    orgId: req.orgId,
    loanId,
    projectId,
    type: 'payment',
    sourceId: String(sourceId),
    attachments: body.attachments || [],
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
    return res.status(500).json({ code: 'AI_REVIEW_CREATE_FAILED', message: 'Unable to create AI review.', details: error });
  }

  try {
    return sendValidated(res, ReviewResponseSchema, { review: data }, 201);
  } catch (parseError) {
    return res.status(500).json({ code: 'RESPONSE_VALIDATION_ERROR', message: 'Invalid AI review response.', details: parseError.issues });
  }
});

router.post('/ai/inspections/review', async (req, res) => {
  if (!guardAiReviews(req, res)) return;

  let body;
  try {
    body = parseInput(ReviewInspectionRequestSchema, req.body);
  } catch (error) {
    return validationError(res, error);
  }

    const sourceId = body.inspectionId ?? body.sourceId;

  const { data: inspection } = await supabase
    .from('inspections')
    .select('*')
    .eq('id', sourceId)
    .eq('org_id', req.orgId)
    .maybeSingle();

  const loanId = body.loanId ?? inspection?.loan_id ?? null;
  const projectId = body.projectId ?? inspection?.project_id ?? null;

  const input = {
    orgId: req.orgId,
    loanId,
    projectId,
    type: 'inspection',
    sourceId: String(sourceId),
     attachments: body.attachments || inspection?.attachments || [],
    context: {
        scope_items: body.context?.scope_items ?? inspection?.scope_items ?? [],
      inspection_notes: body.context?.inspection_notes ?? inspection?.notes,
      due_date: body.context?.due_date ?? inspection?.due_date,
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
   return res.status(500).json({ code: 'AI_REVIEW_CREATE_FAILED', message: 'Unable to create AI review.', details: error });
  }

  try {
    return sendValidated(res, ReviewResponseSchema, { review: data }, 201);
  } catch (parseError) {
    return res.status(500).json({ code: 'RESPONSE_VALIDATION_ERROR', message: 'Invalid AI review response.', details: parseError.issues });
  }
});

router.get('/ai/reviews', async (req, res) => {
  if (!guardAiReviews(req, res)) return;

  let queryFilters;
  try {
    queryFilters = parseInput(ReviewsListQuerySchema, req.query);
  } catch (error) {
    return validationError(res, error);
  }

  const { type, status, loanId, projectId } = queryFilters;

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
    return res.status(500).json({ code: 'AI_REVIEW_LIST_FAILED', message: 'Unable to load AI reviews.', details: error });
  }

  try {
    return sendValidated(res, ReviewsListResponseSchema, { reviews: data || [] });
  } catch (parseError) {
    return res.status(500).json({ code: 'RESPONSE_VALIDATION_ERROR', message: 'Invalid AI reviews response.', details: parseError.issues });
  }
});

router.post('/ai/reviews/:id/mark', async (req, res) => {
  if (!guardAiReviews(req, res)) return;
  const { id } = req.params;

  let body;
  try {
    body = parseInput(MarkReviewRequestSchema, req.body);
  } catch (error) {
    return validationError(res, error);
  }

  const { data, error } = await supabase
    .from('ai_reviews')
     .update({ status: body.status, updated_at: nowIso() })
    .eq('id', id)
    .eq('org_id', req.orgId)
    .select('*')
    .single();

  if (error) {
     return res.status(500).json({ code: 'AI_REVIEW_UPDATE_FAILED', message: 'Unable to update AI review.', details: error });
  }

  try {
    return sendValidated(res, ReviewResponseSchema, { review: data });
  } catch (parseError) {
    return res.status(500).json({ code: 'RESPONSE_VALIDATION_ERROR', message: 'Invalid AI review response.', details: parseError.issues });
  }
});

router.post('/ai/reviews/:id/approve-action', async (req, res) => {
  if (!guardAiReviews(req, res)) return;
  const { id } = req.params;
 
  let body;
  try {
    body = parseInput(ApproveActionRequestSchema, req.body);
  } catch (error) {
    return validationError(res, error);
  }

  const { data, error } = await supabase
    .from('ai_review_actions')
    .insert({
      review_id: id,
          action_type: body.action_type,
      action_payload: body.action_payload || {},
      outcome: 'approved',
        notes: body.notes || null,
      actor_id: req.headers['x-user-id'] || null,
      created_at: nowIso(),
    })
    .select('*')
    .single();

  if (error) {
    return res.status(500).json({ code: 'AI_REVIEW_APPROVAL_FAILED', message: 'Unable to record approval.', details: error });
  }

  const executionEnabled = isAiExecutionEnabled();

   try {
    return sendValidated(res, ApproveActionResponseSchema, {
      approval: data,
      executionEnabled,
      message: executionEnabled
        ? 'Approval recorded. Execution enabled.'
        : 'Approval recorded. Execution disabled.',
    });
  } catch (parseError) {
    return res.status(500).json({ code: 'RESPONSE_VALIDATION_ERROR', message: 'Invalid approval response.', details: parseError.issues });
  }
});

module.exports = { router };
