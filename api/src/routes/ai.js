const express = require('express');
const { supabase } = require('../../db');
const { ZodError } = require('../../lib/zod');
const {
  AiReviewResponseSchema,
  AiReviewsListResponseSchema,
  AiReviewsListQuerySchema,
  MarkReviewRequestSchema,
  ApproveActionRequestSchema,
  PaymentReviewRequestSchema,
  InspectionReviewRequestSchema,
  ComplianceReviewRequestSchema,
} = require('../schemas/ai/reviews');
const { runPaymentAgent } = require('../ai/agents/paymentAgent');
const { runInspectionAgent } = require('../ai/agents/inspectionAgent');
const { selectFor } = require('../lib/selectColumns');

const router = express.Router();

const parseOrThrow = (schema, payload) => schema.parse(payload || {});
const validateResponse = (schema, payload) => schema.parse(payload);

const sendValidationError = (res, error) => {
  if (!(error instanceof ZodError)) return res.status(500).json({ code: 'SERVER_ERROR' });
  return res.status(400).json({ code: 'VALIDATION_ERROR', details: error.issues });
};

router.get('/reviews', async (req, res) => {
  let filters;
  try {
    filters = parseOrThrow(AiReviewsListQuerySchema, req.query);
  } catch (error) {
    return sendValidationError(res, error);
  }

  let query = supabase
    .from('ai_reviews')
   .select(selectFor('ai_reviews'), { count: 'exact' })
    .eq('org_id', req.orgId)
    .order('created_at', { ascending: false });

  if (filters.status) query = query.eq('status', filters.status);
  if (filters.type) query = query.eq('type', filters.type);
  if (filters.entity_type) query = query.eq('entity_type', filters.entity_type);
  if (filters.entity_id) query = query.eq('entity_id', filters.entity_id);

  const { data, count, error } = await query;
  if (error) return res.status(500).json({ code: 'AI_REVIEWS_LIST_FAILED', details: error.message });

  return res.json(validateResponse(AiReviewsListResponseSchema, { items: data || [], total: count || 0 }));
});

router.get('/reviews/:id', async (req, res) => {
  const { data, error } = await supabase
    .from('ai_reviews')
    .select(selectFor('ai_reviews'))
    .eq('org_id', req.orgId)
    .eq('id', req.params.id)
    .maybeSingle();

  if (error) return res.status(500).json({ code: 'AI_REVIEW_FETCH_FAILED', details: error.message });
  if (!data) return res.status(404).json({ code: 'NOT_FOUND' });

  return res.json(validateResponse(AiReviewResponseSchema, { review: data }));
});

router.post('/reviews/:id/mark', async (req, res) => {
  let body;
  try {
    body = parseOrThrow(MarkReviewRequestSchema, req.body);
  } catch (error) {
    return sendValidationError(res, error);
  }

  const { data, error } = await supabase
    .from('ai_reviews')
    .update({ status: body.status, updated_at: new Date().toISOString() })
    .eq('org_id', req.orgId)
    .eq('id', req.params.id)
    .select(selectFor('ai_reviews'))
    .single();

  if (error) return res.status(500).json({ code: 'AI_REVIEW_MARK_FAILED', details: error.message });

  return res.json(validateResponse(AiReviewResponseSchema, { review: data }));
});

router.post('/reviews/:id/approve-action', async (req, res) => {
  let body;
  try {
    body = parseOrThrow(ApproveActionRequestSchema, req.body);
  } catch (error) {
    return sendValidationError(res, error);
  }

  const actorId = req.headers['x-user-id'] || null;

  const { data: actionRow, error: actionErr } = await supabase
    .from('ai_review_actions')
    .insert({
      org_id: req.orgId,
      review_id: req.params.id,
      action_type: body.action_type,
      action_payload: body.action_payload,
      outcome: 'approved',
      notes: body.notes || null,
      actor_id: actorId,
    })
   .select(selectFor('ai_review_actions'))
    .single();

  if (actionErr) return res.status(500).json({ code: 'AI_ACTION_APPROVAL_FAILED', details: actionErr.message });

  await supabase.from('audit_log').insert({
    org_id: req.orgId,
    actor_id: actorId,
    action: 'ai.action.approved',
    entity_type: 'ai_review',
    entity_id: req.params.id,
    payload: {
      action_type: body.action_type,
      action_payload: body.action_payload,
      notes: body.notes || null,
      ai_review_action_id: actionRow.id,
    },
  });

  return res.json({ ok: true });
});

const createReview = async ({ orgId, type, entityType, entityId, result }) => {
  const now = new Date().toISOString();
  const payload = {
    org_id: orgId,
    type,
    entity_type: entityType,
    entity_id: entityId,
    status: result.status,
    confidence: result.confidence || 0,
    title: result.title,
    summary: result.summary,
    reasons: result.reasons || [],
    evidence: result.evidence || [],
    recommended_actions: result.recommended_actions || [],
    proposed_updates: result.proposed_updates || {},
    created_by: 'ai',
    created_at: now,
    updated_at: now,
  };

  const { data, error } = await supabase.from('ai_reviews').insert(payload).select(selectFor('ai_reviews')).single();
  if (error) throw error;
  return data;
};

router.post('/payments/review', async (req, res) => {
  let body;
  try {
    body = parseOrThrow(PaymentReviewRequestSchema, req.body);
  } catch (error) {
    return sendValidationError(res, error);
  }

  const { data: payment } = await supabase
    .from('payments')
    .select(selectFor('payments'))
    .eq('org_id', req.orgId)
    .eq('id', body.payment_id)
    .maybeSingle();

  if (!payment) return res.status(404).json({ code: 'PAYMENT_NOT_FOUND' });

  const paymentData = payment.data || {};
  const review = await createReview({
    orgId: req.orgId,
    type: 'payment',
    entityType: 'payment',
    entityId: payment.id,
    result: runPaymentAgent({
      expected_amount: paymentData.expected_amount,
      received_amount: paymentData.received_amount,
      due_date: paymentData.due_date,
      received_date: paymentData.received_date,
      memo: paymentData.memo,
      remitter: paymentData.remitter,
    }),
  });

  return res.status(201).json(validateResponse(AiReviewResponseSchema, { review }));
});

router.post('/inspections/review', async (req, res) => {
  let body;
  try {
    body = parseOrThrow(InspectionReviewRequestSchema, req.body);
  } catch (error) {
    return sendValidationError(res, error);
  }

  const { data: inspection } = await supabase
    .from('inspections')
   .select(selectFor('inspections'))
    .eq('org_id', req.orgId)
    .eq('id', body.inspection_id)
    .maybeSingle();

  if (!inspection) return res.status(404).json({ code: 'INSPECTION_NOT_FOUND' });

  const inspectionData = inspection.data || {};
  const review = await createReview({
    orgId: req.orgId,
    type: 'inspection',
    entityType: 'inspection',
    entityId: inspection.id,
    result: runInspectionAgent({
      photos: inspectionData.photos || [],
      required_photos_count: inspectionData.required_photos_count,
      notes: inspectionData.notes,
      scope_items: inspectionData.scope_items || [],
    }),
  });

  return res.status(201).json(validateResponse(AiReviewResponseSchema, { review }));
});

router.post('/compliance/review', async (req, res) => {
  let body;
  try {
    body = parseOrThrow(ComplianceReviewRequestSchema, req.body);
  } catch (error) {
    return sendValidationError(res, error);
  }

  const { data: item } = await supabase
    .from('compliance_items')
   .select(selectFor('compliance_items'))
    .eq('org_id', req.orgId)
    .eq('id', body.compliance_item_id)
    .maybeSingle();

  if (!item) return res.status(404).json({ code: 'COMPLIANCE_ITEM_NOT_FOUND' });

  const status = item.status === 'open' ? 'needs_review' : 'pass';
  const review = await createReview({
    orgId: req.orgId,
    type: 'compliance',
    entityType: 'compliance_item',
    entityId: item.id,
    result: {
      status,
      confidence: status === 'pass' ? 0.8 : 0.6,
      title: status === 'pass' ? 'Compliance item passed AI review' : 'Compliance item requires review',
      summary: status === 'pass' ? 'No open compliance exceptions detected.' : 'Open compliance status requires human review.',
      reasons: status === 'pass' ? [] : [{ code: 'OPEN_ITEM', message: 'Compliance item is still open.', severity: 'med' }],
      evidence: [],
      recommended_actions: [{ action_type: 'route_to_compliance', label: 'Route to compliance queue', payload: { item_id: item.id }, requires_approval: true }],
      proposed_updates: { current_status: item.status },
    },
  });

  return res.status(201).json(validateResponse(AiReviewResponseSchema, { review }));
});

module.exports = router;
