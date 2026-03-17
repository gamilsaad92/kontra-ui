/**
 * Workflow Orchestrator — 3-layer system
 *
 * Layer 1: Trigger Router — maps event types to workflow types
 * Layer 2: Workflow Planner — determines agent sequences
 * Layer 3: Verifier — validates output schema, evidence, confidence
 *
 * Guardrails: no side effects without human_review gate.
 * All steps are logged immutably to agent_steps.
 */

const { supabase } = require('../../db');
const { runFinancialAgent } = require('../agents/financialAgent');
const { runInspectionAgent } = require('../agents/inspectionAgent');
const { runDrawAgent } = require('../agents/drawAgent');
const { runBorrowerCommAgent } = require('../agents/borrowerCommAgent');
const { runRiskAgent } = require('../agents/riskAgent');
const { runEscrowAgent } = require('../agents/escrowAgent');
const {
  saveArtifact,
  createReviewTask,
  logAgentStep,
  upsertAgentMemory,
  saveEvidence,
} = require('./kontraTools');

// ── Layer 1: Trigger Router ──────────────────────────────────────────────────

const TRIGGER_TO_WORKFLOW = {
  'financial-uploaded': 'financial_review',
  'inspection-uploaded': 'inspection_review',
  'draw-submitted': 'draw_review',
  'covenant-breach': 'risk_scoring',
  'occupancy-alert': 'risk_scoring',
  'missing-annuals': 'borrower_communication',
};

function routeTrigger(trigger_type) {
  const wf = TRIGGER_TO_WORKFLOW[trigger_type];
  if (!wf) throw new Error(`Unknown trigger type: ${trigger_type}`);
  return wf;
}

// ── Layer 2: Workflow Planner ────────────────────────────────────────────────

const WORKFLOW_PLANS = {
  financial_review: [
    { agent: 'financial', step: 'analyze_financials' },
    { agent: 'risk', step: 'update_risk_score', depends_on: 'analyze_financials' },
    { agent: 'borrower_comm', step: 'draft_if_exceptions', depends_on: 'analyze_financials', condition: 'has_exceptions' },
  ],
  inspection_review: [
    { agent: 'inspection', step: 'analyze_inspection' },
    { agent: 'borrower_comm', step: 'draft_notice', depends_on: 'analyze_inspection', condition: 'has_exceptions' },
  ],
  draw_review: [
    { agent: 'draw', step: 'validate_draw_package' },
    { agent: 'borrower_comm', step: 'draft_deficiency', depends_on: 'validate_draw_package', condition: 'has_exceptions' },
  ],
  borrower_communication: [
    { agent: 'borrower_comm', step: 'draft_ror' },
  ],
  risk_scoring: [
    { agent: 'risk', step: 'score_loan' },
  ],
  covenant_breach: [
    { agent: 'financial', step: 'analyze_financials' },
    { agent: 'risk', step: 'score_loan', depends_on: 'analyze_financials' },
    { agent: 'borrower_comm', step: 'draft_cure_notice', depends_on: 'score_loan' },
  ],
  occupancy_alert: [
    { agent: 'financial', step: 'analyze_financials' },
    { agent: 'risk', step: 'score_loan', depends_on: 'analyze_financials' },
  ],
  missing_annuals: [
    { agent: 'borrower_comm', step: 'draft_ror' },
  ],
};

function planWorkflow(workflow_type) {
  const plan = WORKFLOW_PLANS[workflow_type];
  if (!plan) throw new Error(`No plan for workflow type: ${workflow_type}`);
  return plan;
}

// ── Agent runner ─────────────────────────────────────────────────────────────

function runAgentSync(agent_name, step_name, input) {
  switch (agent_name) {
    case 'financial': return runFinancialAgent(input);
    case 'inspection': return runInspectionAgent(input);
    case 'draw': return runDrawAgent(input);
    case 'borrower_comm': return runBorrowerCommAgent(input);
    case 'risk': return runRiskAgent(input);
    case 'escrow': return runEscrowAgent(input);
    default: throw new Error(`Unknown agent: ${agent_name}`);
  }
}

// ── Layer 3: Verifier ────────────────────────────────────────────────────────

const REQUIRED_FIELDS = ['status', 'confidence', 'title', 'summary', 'reasons'];
const VALID_STATUSES = ['pass', 'fail', 'needs_review'];

const CONFIDENCE_THRESHOLDS = {
  AUTO_DRAFT: 0.92,
  HUMAN_REVIEW: 0.75,
};

function verifyOutput(agent_name, output) {
  const errors = [];

  for (const field of REQUIRED_FIELDS) {
    if (output[field] === undefined || output[field] === null) {
      errors.push(`Missing required field: ${field}`);
    }
  }

  if (!VALID_STATUSES.includes(output.status)) {
    errors.push(`Invalid status: ${output.status}`);
  }

  const confidence = Number(output.confidence);
  if (Number.isNaN(confidence) || confidence < 0 || confidence > 1) {
    errors.push(`Invalid confidence: ${output.confidence}`);
  }

  if (!Array.isArray(output.reasons)) {
    errors.push('reasons must be an array');
  }

  const needsHumanReview = confidence < CONFIDENCE_THRESHOLDS.AUTO_DRAFT || output.status !== 'pass';

  return {
    valid: errors.length === 0,
    errors,
    needs_human_review: needsHumanReview,
    confidence_tier:
      confidence >= CONFIDENCE_THRESHOLDS.AUTO_DRAFT ? 'auto_draft'
      : confidence >= CONFIDENCE_THRESHOLDS.HUMAN_REVIEW ? 'human_review_required'
      : 'escalate',
  };
}

// ── Main executor ─────────────────────────────────────────────────────────────

async function executeWorkflow(workflow_run_id, org_id) {
  const now = new Date().toISOString();

  // Fetch workflow run
  const { data: run, error: runError } = await supabase
    .from('workflow_runs')
    .select('*')
    .eq('id', workflow_run_id)
    .eq('org_id', org_id)
    .single();
  if (runError || !run) throw new Error(`Workflow run not found: ${workflow_run_id}`);

  // Mark running
  await supabase.from('workflow_runs')
    .update({ status: 'running', started_at: now, updated_at: now })
    .eq('id', workflow_run_id);

  const input = run.input_payload || {};
  const plan = planWorkflow(run.workflow_type);
  const stepResults = {};
  const artifacts = [];

  try {
    for (const step of plan) {
      // Check condition
      if (step.condition === 'has_exceptions' && step.depends_on) {
        const depResult = stepResults[step.depends_on];
        if (!depResult || (depResult.status === 'pass' && depResult.reasons?.length === 0)) {
          await logAgentStep({
            org_id,
            workflow_run_id,
            agent_name: step.agent,
            step_name: step.step,
            input_payload: {},
            output_payload: { skipped: true, reason: 'No exceptions in prior step' },
          });
          continue;
        }
      }

      // Build step input from context + prior results
      const stepInput = buildStepInput(step, input, stepResults);

      // Run agent (sync — agents are deterministic rule engines, not LLMs)
      const result = runAgentSync(step.agent, step.step, stepInput);
      stepResults[step.step] = result;

      // Verify output
      const verification = verifyOutput(step.agent, result);

      // Log step (immutable)
      await logAgentStep({
        org_id,
        workflow_run_id,
        agent_name: step.agent,
        step_name: step.step,
        input_payload: stepInput,
        output_payload: { ...result, verification },
      });

      // Save artifact for narrative/memo steps
      if (['draft_if_exceptions', 'draft_notice', 'draft_deficiency', 'draft_ror', 'draft_cure_notice'].includes(step.step)) {
        const art = await saveArtifact({
          org_id,
          workflow_run_id,
          artifact_type: 'email_draft',
          content: result.proposed_updates || {},
        });
        artifacts.push(art);
      }

      // Save main result artifact
      const art = await saveArtifact({
        org_id,
        workflow_run_id,
        artifact_type: 'structured_output',
        content: { agent: step.agent, step: step.step, ...result, verification },
      });
      artifacts.push(art);
    }

    // Aggregate final output
    const finalOutput = {
      steps: Object.keys(stepResults),
      results: stepResults,
      artifacts: artifacts.map((a) => a.id),
    };

    // Create human review task if needed
    const needsReview = Object.values(stepResults).some(
      (r) => r.status !== 'pass' || Number(r.confidence) < CONFIDENCE_THRESHOLDS.AUTO_DRAFT
    );

    if (needsReview) {
      await createReviewTask({ org_id, workflow_run_id, reviewer_role: 'servicer' });
    } else {
      await supabase.from('workflow_runs')
        .update({ status: 'completed', output_payload: finalOutput, completed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', workflow_run_id);
    }

    // Update agent memory
    if (run.loan_id) {
      const firstResult = Object.values(stepResults)[0];
      if (firstResult) {
        await upsertAgentMemory({
          org_id,
          loan_id: run.loan_id,
          memory_type: memoryTypeForWorkflow(run.workflow_type),
          summary: firstResult.summary,
          facts: firstResult.proposed_updates || {},
        }).catch(() => {}); // non-critical
      }
    }

    return { ok: true, workflow_run_id, needs_review: needsReview, step_count: plan.length };

  } catch (err) {
    await supabase.from('workflow_runs')
      .update({ status: 'failed', error_message: err.message, updated_at: new Date().toISOString() })
      .eq('id', workflow_run_id);
    throw err;
  }
}

function buildStepInput(step, baseInput, priorResults) {
  const input = { ...baseInput };

  // Enrich with prior step outputs if available
  if (step.depends_on && priorResults[step.depends_on]) {
    const prior = priorResults[step.depends_on];
    input._prior_findings = prior.reasons || [];
    input._prior_status = prior.status;

    // For borrower comm: pull findings and missing items from prior
    if (step.agent === 'borrower_comm') {
      input.findings = prior.reasons || [];
      input.missing_items = prior.proposed_updates?.missing_items || [];
      input.comm_type = step.step.includes('cure') ? 'cure_notice'
        : step.step.includes('ror') ? 'ror_letter'
        : step.step.includes('deficiency') ? 'deficiency_notice'
        : 'follow_up';
    }

    // For risk: pass financial and other findings
    if (step.agent === 'risk') {
      input.financial = prior.proposed_updates || {};
    }
  }

  return input;
}

function memoryTypeForWorkflow(wf) {
  const map = {
    financial_review: 'financial_summary',
    inspection_review: 'inspection_history',
    draw_review: 'draw_history',
    risk_scoring: 'risk_profile',
    borrower_communication: 'borrower_communications',
    covenant_breach: 'covenant_tracker',
    occupancy_alert: 'financial_summary',
    missing_annuals: 'borrower_communications',
  };
  return map[wf] || 'financial_summary';
}

module.exports = { routeTrigger, planWorkflow, verifyOutput, executeWorkflow, CONFIDENCE_THRESHOLDS };
