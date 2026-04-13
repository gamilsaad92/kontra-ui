/**
 * Agent Console API Routes — Phase 2
 *
 * Endpoints for the Kontra Agent Console UI:
 *   GET  /api/agent-console/agents                  — list all 6 agents with status
 *   POST /api/agent-console/agents/:agentId/run     — run an agent analysis on a loan
 *   GET  /api/agent-console/decisions               — list recent decision artifacts
 *   GET  /api/agent-console/decisions/:id           — get decision detail with full transparency
 *   GET  /api/agent-console/loans/:loanId/decisions — all AI decisions for a loan
 */

const express = require('express');
const router = express.Router();
const { supabase } = require('../../db');
const { runAgent } = require('../../lib/agentRunner');
const { listAgents, getAgent } = require('../../lib/agentDefinitions');

// ── GET /api/agent-console/agents ─────────────────────────────────────────────

router.get('/agents', async (req, res) => {
  try {
    const agents = listAgents();

    // Try to enrich with last-run timestamps from DB
    let lastRuns = {};
    try {
      const { data } = await supabase
        .from('agent_steps')
        .select('agent_name, created_at')
        .eq('org_id', req.orgId)
        .order('created_at', { ascending: false })
        .limit(100);
      if (data) {
        data.forEach((row) => {
          if (!lastRuns[row.agent_name]) lastRuns[row.agent_name] = row.created_at;
        });
      }
    } catch (_) {}

    const enriched = agents.map((a) => ({
      ...a,
      status: 'idle',
      last_run: lastRuns[a.id] || null,
      decision_count: 0,
    }));

    res.json({ agents: enriched, total: enriched.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/agent-console/agents/:agentId/run ───────────────────────────────

router.post('/agents/:agentId/run', async (req, res) => {
  const { agentId } = req.params;
  const { loan_id, workflow_run_id, input_payload = {} } = req.body;

  if (!loan_id) return res.status(400).json({ error: 'loan_id is required' });

  const agentDef = getAgent(agentId);
  if (!agentDef) return res.status(404).json({ error: `Unknown agent: ${agentId}` });

  if (!process.env.OPENAI_API_KEY) {
    // Return demo decision artifact
    return res.json({
      ok: true,
      demo_mode: true,
      decision: buildDemoDecision(agentId, agentDef, loan_id),
    });
  }

  try {
    const decision = await runAgent({
      agent_id: agentId,
      org_id: req.orgId,
      loan_id,
      workflow_run_id,
      input_payload,
    });
    res.json({ ok: true, decision });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/agent-console/decisions ─────────────────────────────────────────

router.get('/decisions', async (req, res) => {
  const { limit = 20, agent_id, status } = req.query;

  try {
    let query = supabase
      .from('agent_artifacts')
      .select('*')
      .eq('org_id', req.orgId)
      .eq('artifact_type', 'decision_artifact')
      .order('created_at', { ascending: false })
      .limit(Number(limit));

    const { data, error } = await query;
    if (error) throw error;

    let decisions = (data || []).map((row) => row.content);
    if (agent_id) decisions = decisions.filter((d) => d.agent === agent_id);
    if (status) decisions = decisions.filter((d) => d.status === status);

    // If no DB data, return demo decisions
    if (decisions.length === 0) {
      decisions = getDemoDecisions();
    }

    res.json({ decisions, total: decisions.length });
  } catch (_) {
    res.json({ decisions: getDemoDecisions(), total: 6, demo_mode: true });
  }
});

// ── GET /api/agent-console/decisions/:id ─────────────────────────────────────

router.get('/decisions/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const { data } = await supabase
      .from('agent_artifacts')
      .select('*')
      .eq('org_id', req.orgId)
      .eq('artifact_type', 'decision_artifact')
      .filter('content->>id', 'eq', id)
      .maybeSingle();

    if (data) return res.json({ decision: data.content });
  } catch (_) {}

  // Try demo data
  const demo = getDemoDecisions().find((d) => d.id === id);
  if (demo) return res.json({ decision: demo });

  res.status(404).json({ error: 'Decision not found' });
});

// ── GET /api/agent-console/loans/:loanId/decisions ───────────────────────────

router.get('/loans/:loanId/decisions', async (req, res) => {
  const { loanId } = req.params;

  try {
    const { data } = await supabase
      .from('agent_artifacts')
      .select('*')
      .eq('org_id', req.orgId)
      .eq('artifact_type', 'decision_artifact')
      .filter('content->>loan_id', 'eq', loanId)
      .order('created_at', { ascending: false });

    const decisions = (data || []).map((r) => r.content);
    res.json({ decisions, loan_id: loanId, total: decisions.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Demo data helpers ─────────────────────────────────────────────────────────

function getDemoDecisions() {
  return [
    {
      id: 'dec-001', agent: 'inspection_agent', agent_name: 'Inspection Agent',
      analysis_type: 'inspection_review', loan_ref: 'LN-3301', loan_id: 'ln-3301',
      created_at: '2026-04-11T14:12:00Z', status: 'needs_review',
      sources: [
        { id: 'doc-1', type: 'inspection_report', label: 'Q1 2026 Site Inspection — LN-3301', date: '2026-04-11' },
        { id: 'doc-2', type: 'prior_inspection', label: 'Q4 2025 Site Inspection — LN-3301', date: '2025-11-15' },
      ],
      rules_triggered: [
        { rule_id: 'GSE-INSP-01', description: 'Critical structural deficiency: 30-day cure notice required; draws held', result: 'triggered' },
        { rule_id: 'FREDDIE-5.3.2', description: 'Hazard insurance must cover structural damage at replacement cost', result: 'triggered' },
        { rule_id: 'DRAW-HOLD-CRIT', description: 'Active draw requests held pending critical deficiency cure', result: 'triggered' },
      ],
      confidence: 0.87, confidence_tier: 'human_review_required',
      findings: [
        'Critical structural deficiency: Roof deck failure at Unit 4B — estimated $45,000 cure cost',
        '2 high-severity HVAC issues requiring replacement (est. $28,000 each)',
        '4 low-severity cosmetic deficiencies — 90-day cure window',
        'All Q4 2025 deficiencies confirmed cured — positive trend noted',
      ],
      recommended_action: 'Issue 30-day cure notice for critical roof deficiency. Hold Draw #5 ($310,000) until cure confirmed. Update property reserve with $45,000 holdback.',
      approval_path: ['servicer_review', 'lender_admin'],
      reasoning: 'Q1 2026 inspection identified critical structural deficiency (roof deck failure, Unit 4B) triggering GSE Rule INSP-01. Active Draw #5 for $310,000 must be held. Confidence 0.87 — below auto-draft threshold due to ambiguous HVAC photo documentation. Manual verification recommended.',
      requires_human_approval: true,
      tool_calls: [
        { tool: 'fetchLoan', input_summary: 'loan_id: ln-3301', output_summary: 'LN-3301, $4.2M UPB, Multifamily 48-units, DSCR: 1.34x, Current' },
        { tool: 'fetchInspectionHistory', input_summary: 'loan_id: ln-3301', output_summary: '2 inspections. Q1 2026: 7 deficiencies (1 critical). Q4 2025: All prior cured.' },
        { tool: 'classifyInspectionItem', input_summary: 'roof deck failure unit 4B', output_summary: 'structural/critical, $45,000 est., 30-day cure, draw hold triggered' },
        { tool: 'validateFreddieRule', input_summary: 'GSE-INSP-01, critical_deficiency', output_summary: 'TRIGGERED: 30-day cure required, draw hold mandatory' },
      ],
    },
    {
      id: 'dec-002', agent: 'covenant_agent', agent_name: 'Covenant Agent',
      analysis_type: 'covenant_monitoring', loan_ref: 'LN-0094', loan_id: 'ln-0094',
      created_at: '2026-04-11T10:00:00Z', status: 'needs_review',
      sources: [
        { id: 'doc-3', type: 'financial_statement', label: 'Q1 2026 Operating Statement — LN-0094', date: '2026-04-09' },
        { id: 'doc-4', type: 'loan_agreement', label: 'Loan Agreement — LN-0094 (Section 6.2)', date: '2024-03-15' },
      ],
      rules_triggered: [
        { rule_id: 'COV-DSCR-01', description: 'DSCR minimum 1.25x — tested quarterly', result: 'triggered' },
        { rule_id: 'COV-CURE-30', description: '30-day cure period for material covenant breach', result: 'triggered' },
        { rule_id: 'PSA-INVESTOR-NOTIFY', description: 'Investor notification required within 5 business days', result: 'triggered' },
      ],
      confidence: 0.93, confidence_tier: 'human_review_required',
      findings: [
        'DSCR tested at 1.08x — below 1.25x threshold by 136 bps',
        '3rd consecutive quarter below threshold — material breach',
        'Borrower cure plan submitted: rent increase + expense reduction targeting 1.31x by Q3 2026',
        'Operating reserves: $180,000 (above $150,000 required minimum)',
      ],
      recommended_action: 'Initiate 30-day formal cure period. Require quarterly DSCR reporting. Trigger PSA investor notification within 5 business days. Monitor reserve account monthly.',
      approval_path: ['lender_admin'],
      reasoning: 'Q1 2026 DSCR of 1.08x triggers material covenant breach (3rd consecutive quarter). Investor notification mandatory per PSA Section 8.4. Borrower cure plan reasonable but requires monitoring. Confidence 0.93 — clean financial data, straightforward rule application.',
      requires_human_approval: true,
      tool_calls: [
        { tool: 'fetchLoan', input_summary: 'loan_id: ln-0094', output_summary: 'LN-0094, $6.8M UPB, Retail 12,000sf, DSCR: 1.08x, Watch' },
        { tool: 'validateFreddieRule', input_summary: 'COV-DSCR-01, 1.08', output_summary: 'TRIGGERED: 1.08x < 1.25x. Cure: 30 days.' },
        { tool: 'validateFreddieRule', input_summary: 'PSA-INVESTOR-NOTIFY, material_breach', output_summary: 'TRIGGERED: Notification required within 5 business days.' },
      ],
    },
    {
      id: 'dec-003', agent: 'surveillance_agent', agent_name: 'Servicing Surveillance Agent',
      analysis_type: 'watchlist_review', loan_ref: 'LN-7734', loan_id: 'ln-7734',
      created_at: '2026-04-08T08:10:00Z', status: 'completed',
      sources: [
        { id: 'doc-5', type: 'financial_statement', label: 'Q4 2025 Financial Package — LN-7734', date: '2026-01-15' },
        { id: 'doc-6', type: 'payment_history', label: '24-Month Payment History — LN-7734', date: '2026-04-01' },
        { id: 'doc-7', type: 'market_data', label: 'Submarket Vacancy Report — Downtown Q1 2026', date: '2026-04-05' },
      ],
      rules_triggered: [
        { rule_id: 'WATCH-DQ90', description: '90+ day delinquency: mandatory watchlist placement', result: 'triggered' },
        { rule_id: 'WATCH-DSCR-SUB', description: 'DSCR < 1.00x: substandard risk classification', result: 'triggered' },
        { rule_id: 'WATCH-RESERVE-DEP', description: 'Capital reserve depletion: enhanced monitoring required', result: 'triggered' },
      ],
      confidence: 0.91, confidence_tier: 'human_review_required',
      findings: [
        'Loan 94 days delinquent — 3 missed payments totaling $89,400',
        'DSCR: 0.98x — below breakeven (insufficient to cover debt service)',
        'Capital reserve account: $0 (fully depleted February 2026)',
        'Submarket vacancy increased to 18.4% — negative absorption trend',
        'Sponsor holds 2 other portfolio assets performing well',
      ],
      recommended_action: 'Risk rating: Substandard. Bi-weekly enhanced monitoring. Engage borrower for forbearance or debt restructuring. Do not escalate to REO given sponsor track record on other assets.',
      approval_path: ['lender_admin'],
      reasoning: 'Three converging risk factors (94-day DQ, sub-1.00x DSCR, reserve depletion) require Substandard classification. Market headwinds reduce near-term recovery probability. Sponsor quality supports workout approach. Confidence 0.91 — uncertainty around borrower capital position.',
      requires_human_approval: false,
      tool_calls: [
        { tool: 'fetchLoan', input_summary: 'loan_id: ln-7734', output_summary: 'LN-7734, $3.1M UPB, Office 8,500sf, 94 days DQ, Status: Delinquent' },
        { tool: 'generateWatchlistComment', input_summary: 'LN-7734, substandard, delinquency/DSCR/reserve', output_summary: 'Substandard memo generated, bi-weekly review recommended' },
      ],
    },
    {
      id: 'dec-004', agent: 'hazard_loss_agent', agent_name: 'Hazard Loss Agent',
      analysis_type: 'hazard_loss_disbursement', loan_ref: 'LN-5578', loan_id: 'ln-5578',
      created_at: '2026-04-08T10:05:00Z', status: 'needs_review',
      sources: [
        { id: 'doc-8', type: 'adjuster_report', label: 'Insurance Adjuster Report — Hail Event', date: '2026-04-07' },
        { id: 'doc-9', type: 'insurance_policy', label: 'Property Insurance Policy — LN-5578', date: '2025-01-01' },
        { id: 'doc-10', type: 'inspection_report', label: 'Emergency Inspection — Hail Damage Assessment', date: '2026-04-06' },
      ],
      rules_triggered: [
        { rule_id: 'HAZARD-HOLD-50PCT', description: 'Insurance proceeds >$100K: 50% holdback until repairs 50% complete', result: 'triggered' },
        { rule_id: 'HAZARD-PSA-NOTIFY', description: 'Material hazard loss >$50K: PSA investor notification required', result: 'triggered' },
        { rule_id: 'HAZARD-INSPECT-REQ', description: 'Disbursement requires post-repair inspection sign-off', result: 'triggered' },
      ],
      confidence: 0.89, confidence_tier: 'human_review_required',
      findings: [
        'Adjuster approved claim: $262,000 net of $18,000 deductible',
        'Damage: Roof replacement, HVAC rooftop units, exterior façade',
        'Contractor bid: $248,000 (within 5% of adjuster estimate — acceptable)',
        '50% holdback triggered: $131,000 initial disbursement, $131,000 holdback',
        'Repair timeline: 6–8 weeks per contractor',
      ],
      recommended_action: 'Approve initial disbursement of $131,000. Hold $131,000 pending 50% repair inspection (schedule Week 4). Notify investors within 5 business days.',
      approval_path: ['servicer_review', 'lender_admin'],
      reasoning: 'Adjuster confirms $262,000 covered losses. Contractor bid within acceptable variance. GSE holdback rule triggers 50/50 split. Investor PSA notification mandatory for >$50K loss. Post-repair inspection required for holdback release.',
      requires_human_approval: true,
      tool_calls: [
        { tool: 'fetchLoan', input_summary: 'loan_id: ln-5578', output_summary: 'LN-5578, $5.8M UPB, Multifamily 96-units, Current, Reserve: $420K' },
        { tool: 'validateFreddieRule', input_summary: 'HAZARD-HOLD-50PCT, 262000', output_summary: 'TRIGGERED: >$100K. Initial: $131K, Holdback: $131K.' },
      ],
    },
    {
      id: 'dec-005', agent: 'compliance_agent', agent_name: 'Compliance Agent',
      analysis_type: 'compliance_review', loan_ref: 'LN-2847', loan_id: 'ln-2847',
      created_at: '2026-04-10T09:30:00Z', status: 'completed',
      sources: [
        { id: 'doc-11', type: 'financial_statement', label: 'Q1 2026 Financial Analysis — LN-2847', date: '2026-04-10' },
        { id: 'doc-12', type: 'regulatory_scan', label: 'CFPB Compliance Scan — April 2026', date: '2026-04-09' },
      ],
      rules_triggered: [
        { rule_id: 'FREDDIE-ANNUAL', description: 'Annual review required within 120 days of fiscal year-end', result: 'clear' },
        { rule_id: 'FREDDIE-INS-MIN', description: 'Insurance coverage minimum: replacement cost value', result: 'clear' },
        { rule_id: 'CFPB-LOSS-MIT-REQ', description: 'Loss mitigation procedures must be documented', result: 'clear' },
      ],
      confidence: 0.96, confidence_tier: 'auto_approve',
      findings: [
        'Annual financial review completed within 120-day window — COMPLIANT',
        'Insurance: $8.4M coverage (exceeds $7.1M replacement cost) — COMPLIANT',
        'Loss mitigation documentation current and on file — COMPLIANT',
        'No open CFPB findings',
      ],
      recommended_action: 'No immediate action required. All Freddie Mac compliance requirements met. Schedule next review for Q2 2026.',
      approval_path: [],
      reasoning: 'Full compliance scan shows all Freddie Mac servicing requirements met. Annual review submitted and approved. Insurance exceeds minimum. No CFPB findings. Confidence 0.96 — no human review required.',
      requires_human_approval: false,
      tool_calls: [
        { tool: 'fetchLoan', input_summary: 'loan_id: ln-2847', output_summary: 'LN-2847, $7.1M UPB, Multifamily 128-units, DSCR: 1.34x, Current' },
        { tool: 'validateFreddieRule', input_summary: 'FREDDIE-ANNUAL, 85 days since year-end', output_summary: 'CLEAR: 85 days within 120-day window.' },
        { tool: 'validateFreddieRule', input_summary: 'FREDDIE-INS-MIN, 8400000', output_summary: 'CLEAR: $8.4M > $7.1M replacement cost.' },
      ],
    },
    {
      id: 'dec-006', agent: 'tokenization_agent', agent_name: 'Tokenization Readiness Agent',
      analysis_type: 'tokenization_readiness', loan_ref: 'LN-2847', loan_id: 'ln-2847',
      created_at: '2026-04-10T11:00:00Z', status: 'needs_review',
      sources: [
        { id: 'doc-13', type: 'financial_statement', label: 'Q1 2026 Financial Analysis — LN-2847', date: '2026-04-10' },
        { id: 'doc-14', type: 'appraisal', label: 'Property Appraisal — 128-Unit Asset (Jan 2026)', date: '2026-01-20' },
        { id: 'doc-15', type: 'token_ledger', label: 'Pool Token Ledger — KONTRA-POOL-003', date: '2026-04-10' },
      ],
      rules_triggered: [
        { rule_id: 'TOKEN-DSCR-MIN', description: 'Tokenizable loans must maintain DSCR ≥ 1.20x', result: 'clear' },
        { rule_id: 'TOKEN-LTV-MAX', description: 'Tokenizable loans must maintain LTV ≤ 75%', result: 'clear' },
        { rule_id: 'TOKEN-CURRENT', description: 'Loan must be current (0-29 days) for token inclusion', result: 'clear' },
        { rule_id: 'TOKEN-AUDIT', description: 'Annual appraisal required for tokenized positions', result: 'clear' },
      ],
      confidence: 0.95, confidence_tier: 'auto_approve',
      findings: [
        'DSCR: 1.34x — above 1.20x tokenization threshold',
        'LTV: 68.2% — below 75% maximum',
        'Loan status: Current (0 days delinquent)',
        'Appraisal: January 2026 — within 12-month window',
        'Calculated token NAV: $1.04 (4% premium to $1.00 par)',
      ],
      recommended_action: 'Publish updated NAV snapshot to KONTRA-POOL-003 token holders. NAV reflects Q1 2026 financial improvement. No changes to token eligibility.',
      approval_path: ['lender_admin'],
      reasoning: 'LN-2847 meets all tokenization eligibility requirements. NAV calculation: (NOI/cap_rate) × loan weight = $1.04/token. Snapshot ready for publication pending lender approval.',
      requires_human_approval: true,
      tool_calls: [
        { tool: 'fetchLoan', input_summary: 'loan_id: ln-2847', output_summary: 'LN-2847, $7.1M UPB, DSCR: 1.34x, LTV: 68.2%, Current' },
        { tool: 'publishTokenizationSnapshot', input_summary: 'pool: kontra-pool-003, nav: 1.04', output_summary: 'PENDING APPROVAL: NAV snapshot ready for 847 token holders' },
      ],
    },
  ];
}

function buildDemoDecision(agentId, agentDef, loan_id) {
  return {
    id: `dec-demo-${Date.now()}`,
    agent: agentId,
    agent_name: agentDef.name,
    analysis_type: agentDef.analysis_type,
    loan_id,
    created_at: new Date().toISOString(),
    status: 'needs_review',
    demo_mode: true,
    sources: [{ id: 'doc-demo', type: 'financial_statement', label: `Demo Analysis — ${loan_id}`, date: new Date().toISOString().slice(0, 10) }],
    rules_triggered: [{ rule_id: 'DEMO-RULE', description: 'Demo mode — connect OpenAI API key for live analysis', result: 'triggered' }],
    confidence: 0.85,
    confidence_tier: 'human_review_required',
    findings: [`Demo analysis for ${loan_id} via ${agentDef.name}. Connect OPENAI_API_KEY environment variable to enable live AI analysis.`],
    recommended_action: 'Configure OPENAI_API_KEY to enable live AI agent execution.',
    approval_path: agentDef.approvalPath,
    reasoning: 'This is a demo decision artifact. Set OPENAI_API_KEY to enable real OpenAI function-calling agent execution.',
    requires_human_approval: true,
    tool_calls: [],
  };
}

module.exports = router;
