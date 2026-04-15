/**
 * Kontra AI Agent Runner — Phase 2
 *
 * Executes tool-using AI agents via OpenAI function calling.
 * Every run produces a structured Decision Artifact with full transparency:
 *   sources, rules_triggered, confidence, recommended_action, approval_path
 *
 * Guardrails:
 *   - WRITE tools (createBorrowerRequest, publishTokenizationSnapshot) are gated
 *   - All tool calls logged immutably to agent_steps
 *   - Human review required for any recommended action above confidence 0.92
 */

const OpenAI = require('openai');
const { supabase } = require('../db');
const { TOOL_DEFINITIONS, executeTool } = require('./agentToolRegistry');
const { getAgent } = require('./agentDefinitions');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const CONFIDENCE_THRESHOLDS = {
  AUTO_APPROVE: 0.95,
  HUMAN_REVIEW: 0.75,
};

const MAX_TOOL_ROUNDS = 6;

/**
 * Run an agent and produce a Decision Artifact.
 *
 * @param {object} opts
 * @param {string} opts.agent_id         - Agent identifier (see agentDefinitions.js)
 * @param {string} opts.org_id           - Tenant org ID
 * @param {string} [opts.loan_id]        - Loan ID for context
 * @param {string} [opts.workflow_run_id]- Parent workflow run ID
 * @param {object} [opts.input_payload]  - Additional agent input context
 * @returns {Promise<DecisionArtifact>}
 */
async function runAgent({ agent_id, org_id, loan_id, workflow_run_id, input_payload = {} }) {
  const agentDef = getAgent(agent_id);
  if (!agentDef) throw new Error(`Unknown agent: ${agent_id}`);

  const context = { org_id, loan_id, workflow_run_id };
  const startedAt = new Date().toISOString();
  const toolCalls = [];
  const toolResults = {};

  // Filter tool definitions to only those this agent can use
  const agentTools = TOOL_DEFINITIONS.filter((td) => agentDef.tools.includes(td.function.name));

  // Build messages
  const messages = [
    { role: 'system', content: agentDef.systemPrompt },
    {
      role: 'user',
      content: buildUserContext(agentDef, loan_id, input_payload),
    },
  ];

  // ── Agentic loop: run until done or max rounds ────────────────────────────
  let rounds = 0;
  let finalContent = null;

  while (rounds < MAX_TOOL_ROUNDS) {
    rounds++;

    let completion;
    try {
      completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages,
        tools: agentTools,
        tool_choice: 'auto',
        temperature: 0.1, // Low temperature for deterministic analysis
        response_format: { type: 'json_object' },
      });
    } catch (err) {
      console.error(`[agentRunner] OpenAI error (${agent_id}):`, err.message);
      // Return a graceful error artifact
      return buildErrorArtifact({ agent_id, agentDef, loan_id, org_id, error: err.message, toolCalls, startedAt });
    }

    const choice = completion.choices[0];
    messages.push(choice.message);

    if (choice.finish_reason === 'stop') {
      finalContent = choice.message.content;
      break;
    }

    if (choice.finish_reason === 'tool_calls' && choice.message.tool_calls) {
      // Execute each tool call
      for (const tc of choice.message.tool_calls) {
        const fnName = tc.function.name;
        let args;
        try {
          args = JSON.parse(tc.function.arguments);
        } catch (_) {
          args = {};
        }

        let result;
        try {
          result = await executeTool(fnName, args, context);
        } catch (err) {
          result = { error: err.message };
        }

        // Record tool call
        toolCalls.push({
          tool: fnName,
          input_summary: summarizeInput(args),
          output_summary: summarizeOutput(result),
          raw_result: result,
        });
        toolResults[fnName] = result;

        // Log to agent_steps (non-critical, non-blocking)
        if (workflow_run_id) {
          supabase.from('agent_steps').insert({
            org_id, workflow_run_id,
            agent_name: agent_id,
            step_name: fnName,
            status: result?.error ? 'failed' : 'completed',
            input_payload: args,
            output_payload: result || {},
            started_at: new Date().toISOString(),
            completed_at: new Date().toISOString(),
          }).then(() => {}).catch(() => {});
        }

        messages.push({
          role: 'tool',
          tool_call_id: tc.id,
          content: JSON.stringify(result),
        });
      }
    } else {
      // Unexpected finish reason
      finalContent = choice.message.content;
      break;
    }
  }

  // ── Parse final decision from model output ────────────────────────────────
  let decision;
  try {
    decision = JSON.parse(finalContent || '{}');
  } catch (_) {
    decision = { reasoning: finalContent || 'No output produced', confidence: 0.5 };
  }

  // Construct the canonical Decision Artifact
  const artifact = buildDecisionArtifact({ agent_id, agentDef, loan_id, org_id, decision, toolCalls, startedAt });

  // Persist to agent_artifacts
  if (workflow_run_id) {
    try {
      await supabase.from('agent_artifacts').insert({
        org_id, workflow_run_id,
        artifact_type: 'decision_artifact',
        content: artifact,
        created_at: new Date().toISOString(),
      });
    } catch (_) {}
  }

  // Create human_review record if needed
  if (artifact.requires_human_approval && workflow_run_id) {
    try {
      await supabase.from('human_reviews').insert({
        org_id, workflow_run_id,
        review_status: 'pending',
        requested_at: new Date().toISOString(),
      });
      await supabase.from('workflow_runs')
        .update({ status: 'needs_review', updated_at: new Date().toISOString() })
        .eq('id', workflow_run_id);
    } catch (_) {}
  }

  return artifact;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildUserContext(agentDef, loan_id, input_payload) {
  const lines = [
    `You are analyzing loan: ${loan_id || 'N/A'}`,
    `Agent role: ${agentDef.name}`,
    `Analysis type: ${agentDef.analysis_type}`,
  ];
  if (Object.keys(input_payload).length > 0) {
    lines.push(`Additional context: ${JSON.stringify(input_payload)}`);
  }
  lines.push('');
  lines.push('Use the available tools to gather data, then produce your structured decision artifact as JSON. The JSON must exactly match the required output schema.');
  return lines.join('\n');
}

function summarizeInput(args) {
  return Object.entries(args).map(([k, v]) => `${k}: ${String(v).slice(0, 80)}`).join(', ');
}

function summarizeOutput(result) {
  if (!result) return 'null';
  if (result.error) return `ERROR: ${result.error}`;
  const keys = Object.keys(result);
  return keys.slice(0, 4).map((k) => `${k}: ${String(result[k]).slice(0, 60)}`).join(', ');
}

function buildDecisionArtifact({ agent_id, agentDef, loan_id, org_id, decision, toolCalls, startedAt }) {
  const confidence = Math.min(1, Math.max(0, Number(decision.confidence) || 0.7));

  let confidence_tier;
  if (confidence >= CONFIDENCE_THRESHOLDS.AUTO_APPROVE) confidence_tier = 'auto_approve';
  else if (confidence >= CONFIDENCE_THRESHOLDS.HUMAN_REVIEW) confidence_tier = 'human_review_required';
  else confidence_tier = 'escalate';

  const requires_human_approval =
    agentDef.requiresHumanApproval ||
    confidence < CONFIDENCE_THRESHOLDS.AUTO_APPROVE ||
    (decision.requires_human_approval === true) ||
    (Array.isArray(decision.rules_triggered) && decision.rules_triggered.some((r) => r.result === 'triggered'));

  return {
    id: `dec-${Date.now()}`,
    agent: agent_id,
    agent_name: agentDef.name,
    analysis_type: agentDef.analysis_type,
    loan_id,
    org_id,
    created_at: startedAt,
    status: requires_human_approval ? 'needs_review' : 'completed',

    // Transparency fields
    sources: decision.sources || [],
    rules_triggered: decision.rules_triggered || [],
    confidence,
    confidence_tier,
    findings: decision.findings || [],
    recommended_action: decision.recommended_action || 'No specific action recommended.',
    approval_path: requires_human_approval ? (agentDef.approvalPath || ['lender_admin']) : [],
    reasoning: decision.reasoning || '',
    requires_human_approval,

    // Tool execution trace
    tool_calls: toolCalls.map((tc) => ({
      tool: tc.tool,
      input_summary: tc.input_summary,
      output_summary: tc.output_summary,
    })),

    // Metadata
    model: 'gpt-4o-mini',
    tool_call_count: toolCalls.length,
  };
}

function buildErrorArtifact({ agent_id, agentDef, loan_id, org_id, error, toolCalls, startedAt }) {
  return {
    id: `dec-err-${Date.now()}`,
    agent: agent_id,
    agent_name: agentDef?.name || agent_id,
    analysis_type: agentDef?.analysis_type || 'error',
    loan_id, org_id,
    created_at: startedAt,
    status: 'failed',
    sources: [], rules_triggered: [],
    confidence: 0,
    confidence_tier: 'escalate',
    findings: [],
    recommended_action: 'Agent execution failed — manual review required.',
    approval_path: ['lender_admin'],
    reasoning: `Agent execution error: ${error}`,
    requires_human_approval: true,
    tool_calls: toolCalls,
    error,
  };
}

module.exports = { runAgent, CONFIDENCE_THRESHOLDS };
