/**
 * Workflow Orchestrator — OpenClaw 3-Layer Orchestration
 *
 * Layer 1 — Trigger Router: maps inbound event types to workflow types.
 * Layer 2 — Workflow Executor: fetches a queued workflow run and delegates
 *            to the appropriate domain agent.
 * Layer 3 — Human Gate: updates workflow runs to `awaiting_review` when the
 *            agent recommends human approval before proceeding.
 */

const { supabase } = require('../../api/db');
const { runPaymentAgent } = require('../../api/src/ai/agents/paymentAgent');
const { runInspectionAgent } = require('../../api/src/ai/agents/inspectionAgent');
const { runDrawAgent } = require('../../api/src/ai/agents/drawAgent');
const { runFinancialAgent } = require('../../api/src/ai/agents/financialAgent');
const { runEscrowAgent } = require('../../api/src/ai/agents/escrowAgent');
const { runManagementAgent } = require('../../api/src/ai/agents/managementAgent');

// ── Layer 1: Trigger Router ───────────────────────────────────────────────────

const TRIGGER_MAP = {
  'financial-uploaded': 'financial_review',
  'inspection-uploaded': 'inspection_review',
  'draw-submitted': 'draw_review',
  'covenant-breach': 'covenant_breach',
  'occupancy-alert': 'occupancy_alert',
  'payment-received': 'payment_review',
  'missing-annuals': 'missing_annuals',
};

/**
 * Maps a trigger type string to the canonical workflow_type.
 * @param {string} triggerType
 * @returns {string}
 */
function routeTrigger(triggerType) {
  const mapped = TRIGGER_MAP[triggerType];
  if (!mapped) {
    throw new Error(`Unknown trigger type: ${triggerType}`);
  }
  return mapped;
}

// ── Confidence threshold for auto-approval ───────────────────────────────────

const AUTO_APPROVE_THRESHOLD = 0.85;

// ── Agent dispatcher ─────────────────────────────────────────────────────────

function dispatchAgent(workflowType, inputPayload) {
  switch (workflowType) {
    case 'payment_review':
      return runPaymentAgent(inputPayload);
    case 'inspection_review':
      return runInspectionAgent(inputPayload);
    case 'draw_review':
      return runDrawAgent(inputPayload);
    case 'financial_review':
      return runFinancialAgent(inputPayload);
    case 'escrow_review':
      return runEscrowAgent(inputPayload);
    case 'management_review':
      return runManagementAgent(inputPayload);
    case 'covenant_breach':
      return runFinancialAgent({ ...inputPayload, _trigger: 'covenant_breach' });
    case 'occupancy_alert':
      return runFinancialAgent({ ...inputPayload, _trigger: 'occupancy_alert' });
    case 'risk_scoring':
      return runFinancialAgent(inputPayload);
    case 'missing_annuals':
      return { status: 'needs_review', confidence: 0.5, summary: 'Annual financials are missing.', reasons: [{ code: 'MISSING_ANNUALS', message: 'Annual financial submission is overdue.', severity: 'high' }], recommended_actions: [], evidence: [] };
    case 'borrower_communication':
      return { status: 'pass', confidence: 0.9, summary: 'Borrower communication processed.', reasons: [], recommended_actions: [], evidence: [] };
    default:
      return { status: 'needs_review', confidence: 0.0, summary: `Unknown workflow type: ${workflowType}`, reasons: [], recommended_actions: [], evidence: [] };
  }
}

// ── Layer 2: Workflow Executor ────────────────────────────────────────────────

/**
 * Fetches a workflow_run by id, runs the agent, and updates the DB record.
 * Implements the 3-layer pattern:
 *   queued → running → (completed | awaiting_review | failed)
 *
 * @param {string} runId   - UUID of the workflow_runs row
 * @param {string} orgId   - Organization id for row-level security
 */
async function executeWorkflow(runId, orgId) {
  const now = () => new Date().toISOString();

  // Fetch the run
  const { data: run, error: fetchError } = await supabase
    .from('workflow_runs')
    .select('*')
    .eq('id', runId)
    .maybeSingle();

  if (fetchError || !run) {
    console.error('[orchestrator] run not found', runId, fetchError?.message);
    return;
  }

  if (!['queued', 'retrying'].includes(run.status)) {
    console.warn('[orchestrator] run is not in a runnable state', runId, run.status);
    return;
  }

  // Mark as running
  await supabase
    .from('workflow_runs')
    .update({ status: 'running', started_at: now(), updated_at: now() })
    .eq('id', runId);

  // Record start step
  await supabase.from('agent_steps').insert({
    org_id: orgId || run.org_id,
    workflow_run_id: runId,
    agent_name: run.workflow_type,
    step_name: 'agent_start',
    status: 'running',
    input_payload: run.input_payload || {},
    output_payload: {},
    started_at: now(),
    completed_at: null,
  });

  let agentResult;
  let agentError = null;

  try {
    agentResult = await Promise.resolve(dispatchAgent(run.workflow_type, run.input_payload || {}));
  } catch (err) {
    agentError = err;
    console.error('[orchestrator] agent threw', runId, err.message);
  }

  if (agentError || !agentResult) {
    await supabase
      .from('workflow_runs')
      .update({
        status: 'failed',
        error_message: agentError?.message || 'Agent returned no result',
        completed_at: now(),
        updated_at: now(),
      })
      .eq('id', runId);
    return;
  }

  // Determine next status
  const confidence = Number(agentResult.confidence || 0);
  const agentStatus = agentResult.status || 'needs_review';

  let nextStatus;
  if (agentStatus === 'pass' && confidence >= AUTO_APPROVE_THRESHOLD) {
    nextStatus = 'completed';
  } else {
    nextStatus = 'awaiting_review';
  }

  // Persist agent output
  const outputPayload = {
    agent_result: agentResult,
    workflow_type: run.workflow_type,
    executed_at: now(),
  };

  await supabase
    .from('workflow_runs')
    .update({
      status: nextStatus,
      output_payload: outputPayload,
      confidence_score: confidence,
      completed_at: nextStatus === 'completed' ? now() : null,
      updated_at: now(),
    })
    .eq('id', runId);

  // Record completion step
  await supabase.from('agent_steps').insert({
    org_id: orgId || run.org_id,
    workflow_run_id: runId,
    agent_name: run.workflow_type,
    step_name: 'agent_complete',
    status: 'completed',
    input_payload: run.input_payload || {},
    output_payload: outputPayload,
    started_at: now(),
    completed_at: now(),
  });

  // If awaiting_review, store recommended actions as artifacts
  if (nextStatus === 'awaiting_review' && Array.isArray(agentResult.recommended_actions)) {
    const artifactRows = agentResult.recommended_actions.map((action) => ({
      org_id: orgId || run.org_id,
      workflow_run_id: runId,
      loan_id: run.loan_id || null,
      artifact_type: 'recommended_action',
      label: action.label || action.action_type,
      payload: action,
      status: 'pending',
      created_at: now(),
    }));

    if (artifactRows.length > 0) {
      await supabase.from('agent_artifacts').insert(artifactRows);
    }
  }

  console.log(`[orchestrator] run ${runId} → ${nextStatus} (confidence: ${confidence.toFixed(2)})`);
}

module.exports = { routeTrigger, executeWorkflow };
