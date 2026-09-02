/**
 * Workflow Orchestration Routes
 *
 * GET    /api/workflow-templates           - List all machine-readable workflow templates
 * GET    /api/workflow-templates/:id      - Get a single template with full step graph
 * POST   /api/workflows/from-template     - Launch a workflow from a template
 *
 * POST   /api/workflows                    - Create and queue a workflow run
 * GET    /api/workflows                    - List workflow runs (with filters)
 * GET    /api/workflows/:id               - Get a single workflow run
 * POST   /api/workflows/:id/retry         - Retry a failed workflow
 * POST   /api/workflows/:id/cancel        - Cancel a queued/running workflow
 * GET    /api/workflows/:id/steps         - Get granular step detail for a run
 *
 * POST   /api/triggers/financial-uploaded  - Trigger: financial package uploaded
 * POST   /api/triggers/inspection-uploaded - Trigger: inspection report uploaded
 * POST   /api/triggers/draw-submitted      - Trigger: draw request submitted
 * POST   /api/triggers/covenant-breach     - Trigger: covenant breach detected
 * POST   /api/triggers/occupancy-alert     - Trigger: occupancy below threshold
 * POST   /api/triggers/hazard-loss-filed   - Trigger: hazard/insurance loss event filed
 * POST   /api/triggers/watchlist-added     - Trigger: loan added to watchlist
 * POST   /api/triggers/maturity-t90        - Trigger: loan within 90 days of maturity
 * POST   /api/triggers/covenant-test-due   - Trigger: scheduled covenant test
 *
 * POST   /api/agents/callback             - Agent posts back result
 * POST   /api/agents/heartbeat            - Agent heartbeat (for long-running)
 *
 * POST   /api/reviews/:workflowId/approve         - Human approves output
 * POST   /api/reviews/:workflowId/reject          - Human rejects output
 * POST   /api/reviews/:workflowId/request_changes - Human requests changes
 * GET    /api/approval-queue              - All pending approvals for this org
 *
 * GET    /api/loans/:loanId/agent-artifacts - Get artifacts for a loan
 * GET    /api/workflows/:id/evidence        - Get evidence for a workflow
 */

const express = require('express');
const { supabase } = require('../../db');
const { routeTrigger, executeWorkflow } = require('../../../ai/lib/workflowOrchestrator');
const { getTemplates, getTemplate, resolveTemplate } = require('../../lib/workflowTemplates');

const router = express.Router();

const VALID_WORKFLOW_TYPES = [
  'financial_review', 'inspection_review', 'draw_review',
  'borrower_communication', 'risk_scoring', 'covenant_breach',
  'occupancy_alert', 'missing_annuals',
  // Phase 1 template-based types
  'hazard_loss_disbursement', 'watchlist_review',
  'borrower_financial_analysis', 'maturity_tracking', 'covenant_monitoring',
];

// ── Helper ─────────────────────────────────────────────────────────────────
async function createWorkflowRun({ org_id, loan_id, workflow_type, source_entity_type, source_entity_id, input_payload, requested_by, priority }) {
  const { data, error } = await supabase
    .from('workflow_runs')
    .insert({
      org_id,
      loan_id: loan_id || null,
      workflow_type,
      status: 'queued',
      priority: priority || 5,
      source_entity_type: source_entity_type || null,
      source_entity_id: source_entity_id || null,
      input_payload: input_payload || {},
      requested_by: requested_by || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

// ── Workflow Templates ────────────────────────────────────────────────────────

router.get('/workflow-templates', (req, res) => {
  return res.json({ items: getTemplates(), total: getTemplates().length });
});

router.get('/workflow-templates/:id', (req, res) => {
  const template = getTemplate(req.params.id);
  if (!template) return res.status(404).json({ code: 'TEMPLATE_NOT_FOUND' });
  return res.json({ template });
});

// Launch a workflow run from a template (preferred way for UI-initiated workflows)
router.post('/workflows/from-template', async (req, res) => {
  const { template_id, loan_id, input_payload, priority } = req.body;
  if (!template_id) return res.status(400).json({ code: 'MISSING_TEMPLATE_ID' });

  const template = getTemplate(template_id);
  if (!template) return res.status(400).json({ code: 'INVALID_TEMPLATE_ID', valid: getTemplates().map((t) => t.id) });

  try {
    const slaDeadline = new Date(Date.now() + template.sla_hours * 3600 * 1000).toISOString();
    const firstStep = template.steps[0]?.id || null;

    const run = await createWorkflowRun({
      org_id: req.orgId,
      loan_id: loan_id || null,
      workflow_type: template.id,
      source_entity_type: 'template',
      source_entity_id: null,
      input_payload: {
        ...(input_payload || {}),
        template_id,
        template_name: template.name,
        sla_hours: template.sla_hours,
      },
      requested_by: req.headers['x-user-id'] || null,
      priority: priority || 5,
    });

    // Patch in template_id and sla_deadline if columns exist
    await supabase.from('workflow_runs')
      .update({ template_id, current_step: firstStep, sla_deadline: slaDeadline, updated_at: new Date().toISOString() })
      .eq('id', run.id)
      .then(() => {});

    setImmediate(() => {
      executeWorkflow(run.id, req.orgId).catch((err) => {
        console.error('[workflow/from-template] execution error', run.id, err.message);
      });
    });

    return res.status(201).json({
      ok: true,
      workflow_run: { ...run, template_id, current_step: firstStep, sla_deadline: slaDeadline },
      template: { id: template.id, name: template.name, sla_hours: template.sla_hours, step_count: template.steps.length },
    });
  } catch (err) {
    return res.status(500).json({ code: 'WORKFLOW_FROM_TEMPLATE_FAILED', details: err.message });
  }
});

// ── Approval Queue ────────────────────────────────────────────────────────────

router.get('/approval-queue', async (req, res) => {
  try {
    const { data: reviews, error } = await supabase
      .from('human_reviews')
      .select('*')
      .eq('org_id', req.orgId)
      .in('review_status', ['pending', 'changes_requested'])
      .order('created_at', { ascending: true });

    if (error) return res.status(500).json({ code: 'APPROVAL_QUEUE_FAILED', details: error.message });

    // Enrich with workflow run context
    const runIds = (reviews || []).map((r) => r.workflow_run_id).filter(Boolean);
    let runs = [];
    if (runIds.length) {
      const { data } = await supabase.from('workflow_runs').select('id,workflow_type,loan_id,priority').in('id', runIds);
      runs = data || [];
    }
    const runMap = Object.fromEntries(runs.map((r) => [r.id, r]));

    const enriched = (reviews || []).map((review) => ({
      ...review,
      workflow_context: runMap[review.workflow_run_id] || null,
    }));

    return res.json({ items: enriched, total: enriched.length });
  } catch (err) {
    return res.status(500).json({ code: 'APPROVAL_QUEUE_FAILED', details: err.message });
  }
});

// ── Workflow CRUD ─────────────────────────────────────────────────────────────

router.post('/workflows', async (req, res) => {
  const { loan_id, workflow_type, source_entity_type, source_entity_id, input_payload, priority } = req.body;
  if (!workflow_type || !VALID_WORKFLOW_TYPES.includes(workflow_type)) {
    return res.status(400).json({ code: 'INVALID_WORKFLOW_TYPE', valid: VALID_WORKFLOW_TYPES });
  }
  try {
    const run = await createWorkflowRun({
      org_id: req.orgId,
      loan_id,
      workflow_type,
      source_entity_type,
      source_entity_id,
      input_payload,
      requested_by: req.headers['x-user-id'] || null,
      priority,
    });

    // Execute asynchronously (non-blocking for long runs in production)
    setImmediate(() => {
      executeWorkflow(run.id, req.orgId).catch((err) => {
        console.error('[workflow] execution error', run.id, err.message);
      });
    });

    return res.status(201).json({ ok: true, workflow_run: run });
  } catch (err) {
    return res.status(500).json({ code: 'WORKFLOW_CREATE_FAILED', details: err.message });
  }
});

router.get('/workflows', async (req, res) => {
  const { status, workflow_type, loan_id, limit = 50, offset = 0 } = req.query;
  let query = supabase
    .from('workflow_runs')
    .select('*', { count: 'exact' })
    .eq('org_id', req.orgId)
    .order('created_at', { ascending: false })
    .range(Number(offset), Number(offset) + Number(limit) - 1);

  if (status) query = query.eq('status', status);
  if (workflow_type) query = query.eq('workflow_type', workflow_type);
  if (loan_id) query = query.eq('loan_id', loan_id);

  const { data, count, error } = await query;
  if (error) return res.status(500).json({ code: 'WORKFLOW_LIST_FAILED', details: error.message });
  return res.json({ items: data || [], total: count || 0 });
});

router.get('/workflows/:id', async (req, res) => {
  const { data, error } = await supabase
    .from('workflow_runs')
    .select('*')
    .eq('org_id', req.orgId)
    .eq('id', req.params.id)
    .maybeSingle();
  if (error) return res.status(500).json({ code: 'WORKFLOW_FETCH_FAILED', details: error.message });
  if (!data) return res.status(404).json({ code: 'NOT_FOUND' });

  // Also fetch steps and artifacts
  const [stepsRes, artifactsRes] = await Promise.all([
    supabase.from('agent_steps').select('*').eq('workflow_run_id', req.params.id).order('created_at'),
    supabase.from('agent_artifacts').select('*').eq('workflow_run_id', req.params.id).order('created_at'),
  ]);

  return res.json({
    workflow_run: data,
    steps: stepsRes.data || [],
    artifacts: artifactsRes.data || [],
  });
});

router.post('/workflows/:id/retry', async (req, res) => {
  const { data: run } = await supabase
    .from('workflow_runs')
    .select('*')
    .eq('org_id', req.orgId)
    .eq('id', req.params.id)
    .maybeSingle();
  if (!run) return res.status(404).json({ code: 'NOT_FOUND' });
  if (!['failed', 'cancelled'].includes(run.status)) {
    return res.status(400).json({ code: 'NOT_RETRYABLE', current_status: run.status });
  }

  const now = new Date().toISOString();
  await supabase.from('workflow_runs')
    .update({ status: 'queued', error_message: null, started_at: null, completed_at: null, updated_at: now })
    .eq('id', req.params.id);

  setImmediate(() => {
    executeWorkflow(req.params.id, req.orgId).catch((err) => {
      console.error('[workflow] retry error', req.params.id, err.message);
    });
  });

  return res.json({ ok: true });
});

router.post('/workflows/:id/cancel', async (req, res) => {
  const { data } = await supabase
    .from('workflow_runs')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('org_id', req.orgId)
    .eq('id', req.params.id)
    .in('status', ['queued', 'running'])
    .select('*')
    .single();
  if (!data) return res.status(404).json({ code: 'NOT_FOUND_OR_NOT_CANCELLABLE' });
  return res.json({ ok: true });
});

// ── Triggers ──────────────────────────────────────────────────────────────────

const TRIGGER_PRIORITY = {
  'covenant-breach': 1, 'covenant-test-due': 2, 'watchlist-added': 2,
  'maturity-t90': 3, 'hazard-loss-filed': 2, 'delinquency-threshold': 2,
};

async function handleTrigger(req, res, trigger_type) {
  const { loan_id, entity_id, entity_type, payload } = req.body;
  try {
    // Try legacy route first, fall back to template resolution
    let workflow_type;
    try { workflow_type = routeTrigger(trigger_type); } catch (_) {}
    if (!workflow_type) workflow_type = resolveTemplate(trigger_type) || trigger_type.replace(/-/g, '_');

    const priority = TRIGGER_PRIORITY[trigger_type] || 5;

    const run = await createWorkflowRun({
      org_id: req.orgId,
      loan_id,
      workflow_type,
      source_entity_type: entity_type || trigger_type,
      source_entity_id: entity_id || null,
      input_payload: payload || {},
      requested_by: req.headers['x-user-id'] || null,
      priority,
    });

    // If the trigger maps to a known template, attach SLA deadline
    const template = resolveTemplate(trigger_type) ? require('../../lib/workflowTemplates').getTemplate(resolveTemplate(trigger_type)) : null;
    if (template) {
      const slaDeadline = new Date(Date.now() + template.sla_hours * 3600 * 1000).toISOString();
      const firstStep = template.steps[0]?.id || null;
      await supabase.from('workflow_runs')
        .update({ template_id: template.id, current_step: firstStep, sla_deadline: slaDeadline, updated_at: new Date().toISOString() })
        .eq('id', run.id)
        .then(() => {});
    }

    setImmediate(() => {
      executeWorkflow(run.id, req.orgId).catch((err) => {
        console.error('[workflow trigger]', trigger_type, err.message);
      });
    });

    return res.status(201).json({ ok: true, workflow_run_id: run.id, workflow_type });
  } catch (err) {
    return res.status(500).json({ code: 'TRIGGER_FAILED', details: err.message });
  }
}

// Original triggers
router.post('/triggers/financial-uploaded', (req, res) => handleTrigger(req, res, 'financial-uploaded'));
router.post('/triggers/inspection-uploaded', (req, res) => handleTrigger(req, res, 'inspection-uploaded'));
router.post('/triggers/draw-submitted', (req, res) => handleTrigger(req, res, 'draw-submitted'));
router.post('/triggers/covenant-breach', (req, res) => handleTrigger(req, res, 'covenant-breach'));
router.post('/triggers/occupancy-alert', (req, res) => handleTrigger(req, res, 'occupancy-alert'));

// Phase 1 new triggers
router.post('/triggers/hazard-loss-filed', (req, res) => handleTrigger(req, res, 'hazard-loss-filed'));
router.post('/triggers/watchlist-added', (req, res) => handleTrigger(req, res, 'watchlist-added'));
router.post('/triggers/maturity-t90', (req, res) => handleTrigger(req, res, 'maturity-t90'));
router.post('/triggers/covenant-test-due', (req, res) => handleTrigger(req, res, 'covenant-test-due'));
router.post('/triggers/delinquency-threshold', (req, res) => handleTrigger(req, res, 'delinquency-threshold'));

// ── Agent callbacks ───────────────────────────────────────────────────────────

router.post('/agents/callback', async (req, res) => {
  const { workflow_run_id, agent_name, step_name, status, output_payload, error_message } = req.body;
  if (!workflow_run_id) return res.status(400).json({ code: 'MISSING_WORKFLOW_RUN_ID' });

  await supabase.from('agent_steps').insert({
    org_id: req.orgId,
    workflow_run_id,
    agent_name: agent_name || 'unknown',
    step_name: step_name || 'callback',
    status: status || 'completed',
    input_payload: {},
    output_payload: output_payload || {},
    error_message: error_message || null,
    started_at: new Date().toISOString(),
    completed_at: new Date().toISOString(),
  });

  return res.json({ ok: true });
});

router.post('/agents/heartbeat', async (req, res) => {
  const { workflow_run_id } = req.body;
  if (!workflow_run_id) return res.status(400).json({ code: 'MISSING_WORKFLOW_RUN_ID' });
  await supabase.from('workflow_runs')
    .update({ updated_at: new Date().toISOString() })
    .eq('org_id', req.orgId)
    .eq('id', workflow_run_id);
  return res.json({ ok: true });
});

// ── Human Reviews ─────────────────────────────────────────────────────────────

async function handleReviewAction(req, res, review_status) {
  const { workflow_run_id: wfId } = req.params;
  const { review_notes, approved_output } = req.body;
  const reviewer_id = req.headers['x-user-id'] || null;
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from('human_reviews')
    .update({ review_status, reviewer_id, review_notes: review_notes || null, approved_output: approved_output || null, updated_at: now })
    .eq('org_id', req.orgId)
    .eq('workflow_run_id', wfId)
    .select('*')
    .maybeSingle();

  if (!data) {
    // Insert if no review record yet
    const { data: ins, error: insErr } = await supabase
      .from('human_reviews')
      .insert({ org_id: req.orgId, workflow_run_id: wfId, review_status, reviewer_id, review_notes: review_notes || null, approved_output: approved_output || null })
      .select('*')
      .single();
    if (insErr) return res.status(500).json({ code: 'REVIEW_FAILED', details: insErr.message });

    const wfStatus = review_status === 'approved' ? 'completed' : review_status === 'rejected' ? 'failed' : 'needs_review';
    await supabase.from('workflow_runs').update({ status: wfStatus, completed_at: review_status === 'approved' ? now : null, updated_at: now }).eq('id', wfId);
    return res.json({ ok: true, review: ins });
  }

  if (error) return res.status(500).json({ code: 'REVIEW_FAILED', details: error.message });

  const wfStatus = review_status === 'approved' ? 'completed' : review_status === 'rejected' ? 'failed' : 'needs_review';
  await supabase.from('workflow_runs').update({ status: wfStatus, updated_at: now }).eq('id', wfId);
  return res.json({ ok: true, review: data });
}

router.post('/reviews/:workflow_run_id/approve', (req, res) => handleReviewAction(req, res, 'approved'));
router.post('/reviews/:workflow_run_id/reject', (req, res) => handleReviewAction(req, res, 'rejected'));
router.post('/reviews/:workflow_run_id/request_changes', (req, res) => handleReviewAction(req, res, 'changes_requested'));

// ── Artifacts & Evidence ──────────────────────────────────────────────────────

router.get('/loans/:loanId/agent-artifacts', async (req, res) => {
  const { data: runs } = await supabase
    .from('workflow_runs')
    .select('id')
    .eq('org_id', req.orgId)
    .eq('loan_id', req.params.loanId);

  if (!runs?.length) return res.json({ items: [] });

  const runIds = runs.map((r) => r.id);
  const { data, error } = await supabase
    .from('agent_artifacts')
    .select('*')
    .eq('org_id', req.orgId)
    .in('workflow_run_id', runIds)
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ code: 'ARTIFACTS_FETCH_FAILED', details: error.message });
  return res.json({ items: data || [] });
});

router.get('/workflows/:id/evidence', async (req, res) => {
  const { data, error } = await supabase
    .from('workflow_evidence')
    .select('*')
    .eq('org_id', req.orgId)
    .eq('workflow_run_id', req.params.id)
    .order('created_at');
  if (error) return res.status(500).json({ code: 'EVIDENCE_FETCH_FAILED', details: error.message });
  return res.json({ items: data || [] });
});

module.exports = router;
