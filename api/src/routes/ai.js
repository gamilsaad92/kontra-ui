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
  DrawReviewRequestSchema,
  FinancialReviewRequestSchema,
  EscrowReviewRequestSchema,
  ManagementReviewRequestSchema,
  NarrativeRequestSchema,
} = require('../schemas/ai/reviews');
const { runPaymentAgent } = require('../../ai/agents/paymentAgent');
const { runInspectionAgent } = require('../../ai/agents/inspectionAgent');
const { runDrawAgent } = require('../../ai/agents/drawAgent');
const { runFinancialAgent } = require('../../ai/agents/financialAgent');
const { runEscrowAgent } = require('../../ai/agents/escrowAgent');
const { runManagementAgent } = require('../../ai/agents/managementAgent');
const narrativeGenerator = require('../lib/narrativeGenerator');
const narrativeGenerator = require('../lib/narrativeGenerator');
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
      reasons: status === 'pass' ? [] : [{ code: 'OPEN_ITEM', message: 'Compliance item is still open.', severity: 'medium' }],
      evidence: [],
      recommended_actions: [{ action_type: 'route_to_compliance', label: 'Route to compliance queue', payload: { item_id: item.id }, requires_approval: true }],
      proposed_updates: { current_status: item.status },
    },
  });

  return res.status(201).json(validateResponse(AiReviewResponseSchema, { review }));
});

router.post('/draws/review', async (req, res) => {
  let body;
  try { body = parseOrThrow(DrawReviewRequestSchema, req.body); }
  catch (error) { return sendValidationError(res, error); }

  const { data: draw } = await supabase.from('draws').select(selectFor('draws'))
    .eq('org_id', req.orgId).eq('id', body.draw_id).maybeSingle();
  if (!draw) return res.status(404).json({ code: 'DRAW_NOT_FOUND' });

  const d = draw.data || {};
  const review = await createReview({
    orgId: req.orgId, type: 'draw', entityType: 'draw', entityId: draw.id,
    result: runDrawAgent({
      invoices: d.invoices,
      lien_waivers: d.lien_waivers,
      line_items: d.line_items,
      attachments: d.attachments,
      prior_draw_total: d.prior_draw_total,
      requested_amount: d.requested_amount,
      contract_amount: d.contract_amount,
      inspector_cert: d.inspector_cert,
      context: { property_name: draw.title, draw_number: d.draw_number },
    }),
  });
  return res.status(201).json(validateResponse(AiReviewResponseSchema, { review }));
});

router.post('/financials/review', async (req, res) => {
  let body;
  try { body = parseOrThrow(FinancialReviewRequestSchema, req.body); }
  catch (error) { return sendValidationError(res, error); }

  const { data: fin } = await supabase.from('borrower_financials').select(selectFor('borrower_financials'))
    .eq('org_id', req.orgId).eq('id', body.financial_id).maybeSingle();
  if (!fin) return res.status(404).json({ code: 'FINANCIAL_NOT_FOUND' });

  const d = fin.data || {};
  const review = await createReview({
    orgId: req.orgId, type: 'financial', entityType: 'borrower_financial', entityId: fin.id,
    result: runFinancialAgent({
      current: d.current,
      prior: d.prior,
      underwritten: d.underwritten,
      annual_debt_service: d.annual_debt_service,
      dscr_covenant: d.dscr_covenant,
      occupancy_covenant: d.occupancy_covenant,
      variance_explanations: d.variance_explanations,
      context: { property_name: fin.title, period: d.period },
    }),
  });
  return res.status(201).json(validateResponse(AiReviewResponseSchema, { review }));
});

router.post('/escrows/review', async (req, res) => {
  let body;
  try { body = parseOrThrow(EscrowReviewRequestSchema, req.body); }
  catch (error) { return sendValidationError(res, error); }

  const { data: escrow } = await supabase.from('escrows').select(selectFor('escrows'))
    .eq('org_id', req.orgId).eq('id', body.escrow_id).maybeSingle();
  if (!escrow) return res.status(404).json({ code: 'ESCROW_NOT_FOUND' });

  const d = escrow.data || {};
  const review = await createReview({
    orgId: req.orgId, type: 'escrow', entityType: 'escrow', entityId: escrow.id,
    result: runEscrowAgent({
      current_balance: d.current_balance,
      scheduled_items: d.scheduled_items,
      transactions: d.transactions,
      monthly_deposit: d.monthly_deposit,
      cushion_months: d.cushion_months,
      context: { property_name: escrow.title },
    }),
  });
  return res.status(201).json(validateResponse(AiReviewResponseSchema, { review }));
});

router.post('/management/review', async (req, res) => {
  let body;
  try { body = parseOrThrow(ManagementReviewRequestSchema, req.body); }
  catch (error) { return sendValidationError(res, error); }

  const { data: mgmt } = await supabase.from('management_items').select(selectFor('management_items'))
    .eq('org_id', req.orgId).eq('id', body.management_id).maybeSingle();
  if (!mgmt) return res.status(404).json({ code: 'MANAGEMENT_NOT_FOUND' });

  const d = mgmt.data || {};
  const review = await createReview({
    orgId: req.orgId, type: 'management', entityType: 'management_item', entityId: mgmt.id,
    result: runManagementAgent({
      documents: d.documents,
      change_type: d.change_type,
      manager_info: d.manager_info,
      clause_flags: d.clause_flags,
      lender_consent_obtained: d.lender_consent_obtained,
      context: { property_name: mgmt.title },
    }),
  });
  return res.status(201).json(validateResponse(AiReviewResponseSchema, { review }));
});

router.post('/narrative', async (req, res) => {
  let body;
  try { body = parseOrThrow(NarrativeRequestSchema, req.body); }
  catch (error) { return sendValidationError(res, error); }

  const tableMap = {
    inspection: 'inspections', draw: 'draws', financial: 'borrower_financials',
    escrow: 'escrows', payment: 'payments', management: 'management_items',
  };
  const table = tableMap[body.type];

  const { data: entity } = await supabase.from(table).select('*')
    .eq('org_id', req.orgId).eq('id', body.entity_id).maybeSingle();
  if (!entity) return res.status(404).json({ code: 'ENTITY_NOT_FOUND' });

  let review = null;
  if (body.review_id) {
    const { data: rv } = await supabase.from('ai_reviews').select('*')
      .eq('org_id', req.orgId).eq('id', body.review_id).maybeSingle();
    review = rv;
  }

  const d = entity.data || {};
  const overrides = body.overrides || {};
  const context = { property_name: entity.title, ...overrides.context };
  let narrative = '';

  try {
    if (body.type === 'inspection') {
      narrative = narrativeGenerator.inspectionComment({
        property_name: context.property_name,
        inspection_date: d.inspection_date || overrides.inspection_date,
        inspector: d.inspector || overrides.inspector,
        status: review?.status || d.status || 'needs_review',
        findings: d.findings || [],
        life_safety: d.life_safety_items || [],
        repairs_completed: d.repairs_completed || [],
        repairs_pending: d.repairs_pending || [],
        deferral_amount: d.deferral_amount,
        context,
      });
    } else if (body.type === 'draw') {
      const pu = review?.proposed_updates || {};
      narrative = narrativeGenerator.drawComment({
        property_name: context.property_name,
        draw_number: d.draw_number,
        draw_amount: d.requested_amount,
        cumulative_disbursed: (d.prior_draw_total || 0) + (d.requested_amount || 0),
        contract_amount: d.contract_amount,
        work_description: d.work_description || [],
        lien_waiver_status: pu.lien_waiver_status
          ? (pu.lien_waiver_status.missing_waivers?.length === 0 ? 'All lien waivers received' : 'Waivers outstanding')
          : null,
        inspector_cert: d.inspector_cert,
        context,
      });
    } else if (body.type === 'financial') {
      const pu = review?.proposed_updates || {};
      narrative = narrativeGenerator.financialComment({
        property_name: context.property_name,
        period: d.period,
        dscr: pu.dscr ?? d.dscr,
        occupancy: pu.occupancy ?? d.current?.occupancy,
        noi: d.current?.noi,
        prior_dscr: pu.prior_dscr,
        prior_occupancy: d.prior?.occupancy,
        dscr_covenant: d.dscr_covenant,
        occupancy_covenant: d.occupancy_covenant,
        variance_explanations: d.variance_explanations || [],
        watchlist: review?.status === 'fail',
        context,
      });
    } else if (body.type === 'escrow') {
      const pu = review?.proposed_updates || {};
      narrative = narrativeGenerator.escrowComment({
        property_name: context.property_name,
        current_balance: d.current_balance,
        monthly_deposit: d.monthly_deposit,
        projected_low: pu.projected_low_balance,
        shortage_amount: pu.projected_low_balance < 0 ? Math.abs(pu.projected_low_balance) : 0,
        scheduled_items: d.scheduled_items || [],
        action_taken: overrides.action_taken,
        context,
      });
    } else if (body.type === 'payment') {
      narrative = narrativeGenerator.paymentComment({
        property_name: context.property_name,
        payment_amount: d.received_amount,
        expected_amount: d.expected_amount,
        received_date: d.received_date,
        due_date: d.due_date,
        exception_type: d.exception_type,
        remitter: d.remitter,
        allocation: d.allocation,
        context,
      });
    } else if (body.type === 'management') {
      narrative = narrativeGenerator.inspectionComment({
        property_name: context.property_name,
        status: review?.status || 'needs_review',
        findings: (d.clause_flags || []),
        context,
      });
    }
  } catch (err) {
    return res.status(500).json({ code: 'NARRATIVE_GENERATION_FAILED', details: err.message });
  }

  return res.json({ narrative, type: body.type, entity_id: body.entity_id });
});

module.exports = router;
