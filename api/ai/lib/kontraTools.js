/**
 * Kontra Tool Wrappers for AI Agent Orchestration
 *
 * These tools expose Kontra's data layer to the agent runtime in a narrow,
 * deterministic, permission-checked manner.
 *
 * Every tool that writes data requires an explicit org_id and logs its action.
 * No tool performs irreversible side effects without a human_review record.
 */

const { supabase } = require('../../db');

// ── Read tools ────────────────────────────────────────────────────────────────

/**
 * Retrieve a structured loan summary including current status and key metrics.
 */
async function getLoanSummary({ org_id, loan_id }) {
  const { data, error } = await supabase
    .from('loans')
    .select('*')
    .eq('org_id', org_id)
    .eq('id', loan_id)
    .maybeSingle();
  if (error) throw new Error(`getLoanSummary: ${error.message}`);
  return data;
}

/**
 * Retrieve documents associated with a loan, optionally filtered by type.
 */
async function getLoanDocuments({ org_id, loan_id, filters = {} }) {
  let query = supabase
    .from('documents')
    .select('*')
    .eq('org_id', org_id)
    .eq('loan_id', loan_id);
  if (filters.type) query = query.eq('document_type', filters.type);
  if (filters.status) query = query.eq('status', filters.status);
  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) throw new Error(`getLoanDocuments: ${error.message}`);
  return data || [];
}

/**
 * Read a specific document's content by file_id (returns metadata + signed URL).
 */
async function readDocument({ org_id, file_id }) {
  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .eq('org_id', org_id)
    .eq('id', file_id)
    .maybeSingle();
  if (error) throw new Error(`readDocument: ${error.message}`);
  return data;
}

/**
 * Get the agent memory summary for a loan (for context continuity).
 */
async function getAgentMemory({ org_id, loan_id, memory_type }) {
  const { data, error } = await supabase
    .from('agent_memories')
    .select('*')
    .eq('org_id', org_id)
    .eq('loan_id', loan_id)
    .eq('memory_type', memory_type)
    .maybeSingle();
  if (error) throw new Error(`getAgentMemory: ${error.message}`);
  return data;
}

/**
 * Get the property's historical timeline — financial reviews, inspections, draws.
 */
async function getPropertyTimeline({ org_id, loan_id }) {
  const [financials, inspections, draws, workflowRuns] = await Promise.all([
    supabase.from('borrower_financials').select('id, title, status, created_at')
      .eq('org_id', org_id).eq('loan_id', loan_id).order('created_at', { ascending: false }).limit(5),
    supabase.from('inspections').select('id, title, status, created_at')
      .eq('org_id', org_id).eq('loan_id', loan_id).order('created_at', { ascending: false }).limit(5),
    supabase.from('draws').select('id, title, status, created_at')
      .eq('org_id', org_id).eq('loan_id', loan_id).order('created_at', { ascending: false }).limit(5),
    supabase.from('workflow_runs').select('id, workflow_type, status, created_at')
      .eq('org_id', org_id).eq('loan_id', loan_id).order('created_at', { ascending: false }).limit(10),
  ]);
  return {
    financials: financials.data || [],
    inspections: inspections.data || [],
    draws: draws.data || [],
    workflow_runs: workflowRuns.data || [],
  };
}

// ── Write tools ───────────────────────────────────────────────────────────────

/**
 * Persist an artifact produced by an agent. Requires workflow_run_id.
 */
async function saveArtifact({ org_id, workflow_run_id, artifact_type, content }) {
  const { data, error } = await supabase
    .from('agent_artifacts')
    .insert({ org_id, workflow_run_id, artifact_type, content })
    .select('*')
    .single();
  if (error) throw new Error(`saveArtifact: ${error.message}`);
  return data;
}

/**
 * Create a human review task for a completed workflow result.
 * This is the required gate before any consequential action.
 */
async function createReviewTask({ org_id, workflow_run_id, reviewer_role }) {
  const { data, error } = await supabase
    .from('human_reviews')
    .insert({ org_id, workflow_run_id, review_status: 'pending' })
    .select('*')
    .single();
  if (error) throw new Error(`createReviewTask: ${error.message}`);
  // Update workflow to needs_review
  await supabase.from('workflow_runs')
    .update({ status: 'needs_review', updated_at: new Date().toISOString() })
    .eq('id', workflow_run_id);
  return data;
}

/**
 * Log an agent step for auditability. Immutable once written.
 */
async function logAgentStep({ org_id, workflow_run_id, agent_name, step_name, input_payload, output_payload }) {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('agent_steps')
    .insert({
      org_id,
      workflow_run_id,
      agent_name,
      step_name,
      status: 'completed',
      input_payload: input_payload || {},
      output_payload: output_payload || {},
      started_at: now,
      completed_at: now,
    })
    .select('*')
    .single();
  if (error) throw new Error(`logAgentStep: ${error.message}`);
  return data;
}

/**
 * Upsert the agent memory for a loan. Preserves historical facts via merge.
 */
async function upsertAgentMemory({ org_id, loan_id, memory_type, summary, facts }) {
  const now = new Date().toISOString();
  const { data: existing } = await supabase
    .from('agent_memories')
    .select('id, facts')
    .eq('org_id', org_id)
    .eq('loan_id', loan_id)
    .eq('memory_type', memory_type)
    .maybeSingle();

  if (existing) {
    const merged = { ...existing.facts, ...facts };
    const { data, error } = await supabase
      .from('agent_memories')
      .update({ summary, facts: merged, last_updated_at: now })
      .eq('id', existing.id)
      .select('*')
      .single();
    if (error) throw new Error(`upsertAgentMemory (update): ${error.message}`);
    return data;
  }

  const { data, error } = await supabase
    .from('agent_memories')
    .insert({ org_id, loan_id, memory_type, summary, facts, last_updated_at: now })
    .select('*')
    .single();
  if (error) throw new Error(`upsertAgentMemory (insert): ${error.message}`);
  return data;
}

/**
 * Save workflow evidence (source citations) for a workflow run.
 */
async function saveEvidence({ org_id, workflow_run_id, items }) {
  if (!items || items.length === 0) return [];
  const rows = items.map((item) => ({
    org_id,
    workflow_run_id,
    file_id: item.file_id || null,
    source_type: item.source_type || null,
    source_reference: item.source_reference || null,
    excerpt: item.excerpt || null,
    page_number: item.page_number || null,
    confidence: item.confidence || null,
  }));
  const { data, error } = await supabase.from('workflow_evidence').insert(rows).select('*');
  if (error) throw new Error(`saveEvidence: ${error.message}`);
  return data;
}

/**
 * Calculate DSCR from NOI and annual debt service.
 */
function calculateDscr({ noi, annual_debt_service }) {
  if (!annual_debt_service || annual_debt_service === 0) return null;
  return Math.round((noi / annual_debt_service) * 100) / 100;
}

/**
 * Compare actuals to underwriting for a given loan.
 */
async function compareToUnderwriting({ org_id, loan_id, actuals }) {
  const { data: loan } = await supabase
    .from('loans')
    .select('data')
    .eq('org_id', org_id)
    .eq('id', loan_id)
    .maybeSingle();

  const underwritten = loan?.data?.underwriting || {};
  const variances = {};

  ['noi', 'occupancy', 'egi', 'expenses'].forEach((key) => {
    if (actuals[key] !== undefined && underwritten[key] !== undefined) {
      const uwVal = Number(underwritten[key]);
      const actVal = Number(actuals[key]);
      if (uwVal !== 0) {
        variances[key] = {
          actual: actVal,
          underwritten: uwVal,
          variance_pct: Math.round(((actVal - uwVal) / Math.abs(uwVal)) * 10000) / 100,
        };
      }
    }
  });

  return variances;
}

module.exports = {
  getLoanSummary,
  getLoanDocuments,
  readDocument,
  getAgentMemory,
  getPropertyTimeline,
  saveArtifact,
  createReviewTask,
  logAgentStep,
  upsertAgentMemory,
  saveEvidence,
  calculateDscr,
  compareToUnderwriting,
};
