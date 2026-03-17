/**
 * Workflow Orchestration Routes
 *
 * POST   /api/workflows                    - Create and queue a workflow run
 * GET    /api/workflows                    - List workflow runs (with filters)
 * GET    /api/workflows/:id               - Get a single workflow run
 * POST   /api/workflows/:id/retry         - Retry a failed workflow
 * POST   /api/workflows/:id/cancel        - Cancel a queued/running workflow
 *
 * POST   /api/triggers/financial-uploaded - Trigger: financial package uploaded
 * POST   /api/triggers/inspection-uploaded - Trigger: inspection report uploaded
 * POST   /api/triggers/draw-submitted     - Trigger: draw request submitted
 * POST   /api/triggers/covenant-breach    - Trigger: covenant breach detected
 * POST   /api/triggers/occupancy-alert    - Trigger: occupancy below threshold
 *
 * POST   /api/agents/callback             - Agent posts back result
 * POST   /api/agents/heartbeat            - Agent heartbeat (for long-running)
 *
 * POST   /api/reviews/:workflowId/approve         - Human approves output
 * POST   /api/reviews/:workflowId/reject          - Human rejects output
 * POST   /api/reviews/:workflowId/request_changes - Human requests changes
 *
 * GET    /api/loans/:loanId/agent-artifacts - Get artifacts for a loan
 * GET    /api/workflows/:id/evidence        - Get evidence for a workflow
 */

const express = require('express');
const { supabase } = require('../../db');
const { routeTrigger, executeWorkflow } = require('../../../ai/lib/workflowOrchestrator');

const router = express.Router();

const VALID_WORKFLOW_TYPES = [
  'financial_review', 'inspection_review', 'draw_review',
  'borrower_communication', 'risk_scoring', 'covenant_breach',
  'occupancy_alert', 'missing_annuals',
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

async function handleTrigger(req, res, trigger_type) {
  const { loan_id, entity_id, entity_type, payload } = req.body;
  try {
    const workflow_type = routeTrigger(trigger_type);
    const run = await createWorkflowRun({
      org_id: req.orgId,
      loan_id,
      workflow_type,
      source_entity_type: entity_type || trigger_type,
      source_entity_id: entity_id || null,
      input_payload: payload || {},
      requested_by: req.headers['x-user-id'] || null,
      priority: trigger_type === 'covenant-breach' ? 1 : 5,
    });

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

router.post('/triggers/financial-uploaded', (req, res) => handleTrigger(req, res, 'financial-uploaded'));
router.post('/triggers/inspection-uploaded', (req, res) => handleTrigger(req, res, 'inspection-uploaded'));
router.post('/triggers/draw-submitted', (req, res) => handleTrigger(req, res, 'draw-submitted'));
router.post('/triggers/covenant-breach', (req, res) => handleTrigger(req, res, 'covenant-breach'));
router.post('/triggers/occupancy-alert', (req, res) => handleTrigger(req, res, 'occupancy-alert'));

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
