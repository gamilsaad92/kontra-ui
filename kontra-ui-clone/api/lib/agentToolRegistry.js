/**
 * Kontra Agent Tool Registry — Phase 2
 *
 * 8 structured tools that AI agents call as tool-using workers.
 * Each tool has:
 *   definition  — OpenAI function calling schema
 *   execute()   — actual implementation with Supabase query + graceful fallback
 *
 * WRITE TOOLS (createBorrowerRequest, publishTokenizationSnapshot) are gated:
 *   they do NOT execute until a human approves the agent's recommended action.
 *   They record intent + return a pending_approval record instead.
 */

const { supabase } = require('../db');
const { evaluateRule: policyEvaluateRule } = require('./policyEngine');

// ── Legacy hardcoded rule registry (used for type lookups only) ───────────────
// Real evaluation now goes through policyEngine.evaluateRule() which queries
// the kontra_rules DB first, then falls back to this map.

const FREDDIE_RULES = {
  'GSE-INSP-01':     { description:'Critical structural deficiency: 30-day cure notice required; active draws held', threshold:null, operator:'flag' },
  'GSE-INSP-02':     { description:'High-severity deficiency: 60-day cure window; notify borrower', threshold:null, operator:'flag' },
  'FREDDIE-5.3.2':   { description:'Hazard insurance must cover structural damage at replacement cost value', threshold:null, operator:'flag' },
  'FREDDIE-ANNUAL':  { description:'Annual financial review required within 120 days of fiscal year-end', threshold:120, operator:'days_since' },
  'FREDDIE-INS-MIN': { description:'Insurance coverage minimum: replacement cost value of improvements', threshold:null, operator:'flag' },
  'COV-DSCR-01':     { description:'DSCR minimum 1.25x — tested quarterly', threshold:1.25, operator:'>=' },
  'COV-LTV-MAX':     { description:'LTV maximum 80% — tested at annual review', threshold:80, operator:'<=' },
  'COV-OCC-MIN':     { description:'Occupancy minimum 85% — tested quarterly', threshold:85, operator:'>=' },
  'COV-CURE-30':     { description:'Material covenant breach: 30-day cure period', threshold:null, operator:'flag' },
  'PSA-INVESTOR-NOTIFY': { description:'Material covenant breach: investor notification within 5 business days', threshold:null, operator:'flag' },
  'HAZARD-HOLD-50PCT':   { description:'Insurance proceeds >$100K: 50% holdback until repairs 50% complete', threshold:100000, operator:'>' },
  'HAZARD-PSA-NOTIFY':   { description:'Material hazard loss >$50K: PSA investor notification required', threshold:50000, operator:'>' },
  'HAZARD-INSPECT-REQ':  { description:'Disbursement requires post-repair inspection sign-off', threshold:null, operator:'flag' },
  'WATCH-DQ90':          { description:'90+ day delinquency: mandatory watchlist placement', threshold:90, operator:'>=' },
  'WATCH-DSCR-SUB':      { description:'DSCR < 1.00x: substandard risk classification', threshold:1.0, operator:'<' },
  'WATCH-RESERVE-DEP':   { description:'Reserve account depletion: enhanced monitoring required', threshold:0, operator:'<=' },
  'DRAW-HOLD-CRIT':      { description:'Active draw requests held pending critical deficiency cure', threshold:null, operator:'flag' },
  'TOKEN-DSCR-MIN':      { description:'Tokenizable loans must maintain DSCR ≥ 1.20x', threshold:1.20, operator:'>=' },
  'TOKEN-LTV-MAX':       { description:'Tokenizable loans must maintain LTV ≤ 75%', threshold:75, operator:'<=' },
  'TOKEN-CURRENT':       { description:'Loan must be current (0-29 days) for token inclusion', threshold:29, operator:'<=' },
  'TOKEN-AUDIT':         { description:'Annual appraisal required for tokenized positions', threshold:365, operator:'days_since' },
  'CFPB-LOSS-MIT-REQ':   { description:'Loss mitigation procedures must be documented and available', threshold:null, operator:'flag' },
};

// ── Tool 1: fetchLoan ─────────────────────────────────────────────────────────

const fetchLoanDef = {
  type: 'function',
  function: {
    name: 'fetchLoan',
    description: 'Fetch complete loan data including borrower info, property details, payment history, current status, key financial metrics (DSCR, LTV, occupancy), and outstanding workflow runs.',
    parameters: {
      type: 'object',
      properties: {
        loan_id: { type: 'string', description: 'The UUID or reference ID of the loan (e.g. "LN-2847")' },
      },
      required: ['loan_id'],
    },
  },
};

async function fetchLoan({ loan_id }, context) {
  try {
    const { data, error } = await supabase
      .from('loans')
      .select('*')
      .eq('org_id', context.org_id)
      .or(`id.eq.${loan_id},title.ilike.%${loan_id}%`)
      .maybeSingle();
    if (data) return { loan: data, source: 'supabase' };
  } catch (_) {}

  // Demo fallback
  return {
    loan: {
      id: loan_id, title: loan_id, status: 'current',
      data: { upb: 4200000, dscr: 1.34, ltv: 68.2, occupancy: 89, rate: 6.75, maturity_date: '2026-07-12', property_type: 'multifamily', units: 48 }
    },
    source: 'demo',
    _note: 'DB unavailable — using demo data for agent analysis'
  };
}

// ── Tool 2: fetchInspectionHistory ────────────────────────────────────────────

const fetchInspectionHistoryDef = {
  type: 'function',
  function: {
    name: 'fetchInspectionHistory',
    description: 'Retrieve the complete inspection history for a loan, including all past inspection reports, deficiencies found, cure status, and outstanding open items.',
    parameters: {
      type: 'object',
      properties: {
        loan_id: { type: 'string', description: 'The loan ID to fetch inspection history for' },
        limit: { type: 'number', description: 'Number of most recent inspections to fetch (default 5)', default: 5 },
      },
      required: ['loan_id'],
    },
  },
};

async function fetchInspectionHistory({ loan_id, limit = 5 }, context) {
  try {
    const { data } = await supabase
      .from('inspections')
      .select('*')
      .eq('org_id', context.org_id)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (data?.length) return { inspections: data, count: data.length, source: 'supabase' };
  } catch (_) {}

  return {
    inspections: [
      { id: 'insp-001', date: '2026-04-11', inspector: 'Field Services Inc.', status: 'completed', deficiency_count: 7, critical_count: 1, high_count: 2, low_count: 4 },
      { id: 'insp-002', date: '2025-11-15', inspector: 'Field Services Inc.', status: 'completed', deficiency_count: 3, critical_count: 0, all_cured: true },
    ],
    count: 2, source: 'demo',
  };
}

// ── Tool 3: validateFreddieRule ───────────────────────────────────────────────

const validateFreddieRuleDef = {
  type: 'function',
  function: {
    name: 'validateFreddieRule',
    description: 'Validate a specific Freddie Mac/GSE servicing rule against a measured value. Returns whether the rule is triggered or clear, the rule description, and any required action.',
    parameters: {
      type: 'object',
      properties: {
        rule_id: { type: 'string', description: 'Rule identifier (e.g. "GSE-INSP-01", "COV-DSCR-01", "HAZARD-HOLD-50PCT")' },
        value: { description: 'The measured value to test against the rule threshold (number, string, or boolean)' },
        context: { type: 'object', description: 'Optional context data for more sophisticated validation', properties: {} },
      },
      required: ['rule_id'],
    },
  },
};

async function validateFreddieRule({ rule_id, value, context: ruleCtx = {} }, agentContext = {}) {
  // Phase 3: Route through the Policy Engine — queries DB first, then hardcoded fallback
  try {
    const evaluation = await policyEvaluateRule(rule_id, value, {
      org_id: agentContext.org_id,
      loan_id: agentContext.loan_id,
      agent_name: agentContext.agent_name,
      workflow_run_id: agentContext.workflow_run_id,
    });
    return {
      rule_id,
      description: evaluation.description,
      result: evaluation.result,
      reason: evaluation.reason,
      threshold: null,
      operator: evaluation.rule_operator || null,
      tested_value: value,
      category: evaluation.category,
      severity: evaluation.severity,
      source_reference: evaluation.source_reference,
      rule_version: evaluation.version,
      policy_source: evaluation.source, // 'db_rule' | 'hardcoded_fallback' | 'org_override'
      evaluated_at: evaluation.evaluated_at,
    };
  } catch (err) {
    // Final fallback: use legacy hardcoded registry synchronously
    const rule = FREDDIE_RULES[rule_id];
    if (!rule) return { rule_id, result: 'unknown', reason: `Rule ${rule_id} not found`, policy_source: 'not_found' };

    let result = 'unknown';
    let reason = '';

    if (rule.operator === 'flag') {
      result = 'triggered'; reason = rule.description;
    } else if (rule.operator === '>=' && value !== undefined) {
      result = Number(value) >= rule.threshold ? 'clear' : 'triggered';
      reason = result === 'triggered' ? `${value} is below minimum ${rule.threshold}. ${rule.description}` : `${value} meets minimum ${rule.threshold}.`;
    } else if (rule.operator === '<=' && value !== undefined) {
      result = Number(value) <= rule.threshold ? 'clear' : 'triggered';
      reason = result === 'triggered' ? `${value} exceeds maximum ${rule.threshold}. ${rule.description}` : `${value} within limit ${rule.threshold}.`;
    } else if (rule.operator === '<' && value !== undefined) {
      result = Number(value) < rule.threshold ? 'triggered' : 'clear';
      reason = result === 'triggered' ? `${value} below threshold ${rule.threshold}. ${rule.description}` : `${value} at or above ${rule.threshold}.`;
    } else if (rule.operator === '>' && value !== undefined) {
      result = Number(value) > rule.threshold ? 'triggered' : 'clear';
      reason = result === 'triggered' ? `${value} exceeds ${rule.threshold}. ${rule.description}` : `${value} within limit.`;
    }

    return { rule_id, description: rule.description, result, reason, tested_value: value, policy_source: 'emergency_fallback' };
  }
}

// ── Tool 4: generateWatchlistComment ─────────────────────────────────────────

const generateWatchlistCommentDef = {
  type: 'function',
  function: {
    name: 'generateWatchlistComment',
    description: 'Generate a structured watchlist comment/memo for a loan based on its risk factors. Produces a formal credit committee narrative suitable for inclusion in the watchlist report.',
    parameters: {
      type: 'object',
      properties: {
        loan_id: { type: 'string' },
        risk_rating: { type: 'string', enum: ['watch', 'substandard', 'doubtful', 'loss'], description: 'Proposed risk rating classification' },
        risk_factors: { type: 'array', items: { type: 'string' }, description: 'List of key risk drivers identified' },
        action_plan: { type: 'string', description: 'Proposed action plan for resolving the risk' },
      },
      required: ['loan_id', 'risk_rating', 'risk_factors'],
    },
  },
};

function generateWatchlistComment({ loan_id, risk_rating, risk_factors, action_plan }) {
  const ratingDesc = {
    watch: 'is exhibiting early warning indicators that warrant enhanced monitoring.',
    substandard: 'has well-defined weaknesses that jeopardize repayment. The loan is inadequately protected by current collateral value and borrower capacity.',
    doubtful: 'has characteristics that make full collection or liquidation highly questionable and improbable.',
    loss: 'is considered uncollectible and of such little value that continuation as a bankable asset is not warranted.',
  };

  const comment = [
    `WATCHLIST CLASSIFICATION: ${risk_rating.toUpperCase()}`,
    ``,
    `Loan ${loan_id} ${ratingDesc[risk_rating] || ''}`,
    ``,
    `PRIMARY RISK FACTORS:`,
    ...risk_factors.map((f, i) => `  ${i + 1}. ${f}`),
    ``,
    action_plan ? `PROPOSED ACTION PLAN:\n  ${action_plan}` : '',
    ``,
    `This classification is subject to credit committee review and lender approval. Next review: 90 days.`,
  ].filter(Boolean).join('\n');

  return { comment, risk_rating, word_count: comment.split(' ').length, requires_committee_review: ['substandard', 'doubtful', 'loss'].includes(risk_rating) };
}

// ── Tool 5: classifyInspectionItem ────────────────────────────────────────────

const classifyInspectionItemDef = {
  type: 'function',
  function: {
    name: 'classifyInspectionItem',
    description: 'Classify a property inspection deficiency item by type, severity, estimated cure cost, and required cure timeline. Uses GSE servicing standards for classification.',
    parameters: {
      type: 'object',
      properties: {
        description: { type: 'string', description: 'Textual description of the deficiency found during inspection' },
        location: { type: 'string', description: 'Location within the property (e.g. "Unit 4B roof", "Common area HVAC")' },
        photo_available: { type: 'boolean', description: 'Whether photographic evidence is available', default: false },
      },
      required: ['description'],
    },
  },
};

function classifyInspectionItem({ description, location, photo_available = false }) {
  const desc = description.toLowerCase();

  // Severity classification
  let severity = 'low';
  let deficiency_type = 'other';
  let cure_days = 90;
  let cost_estimate_usd = 5000;
  let draw_hold = false;
  let triggered_rules = [];

  if (desc.includes('structural') || desc.includes('roof deck') || desc.includes('foundation') || desc.includes('collapse') || desc.includes('unsafe')) {
    severity = 'critical'; deficiency_type = 'structural'; cure_days = 30; cost_estimate_usd = 45000; draw_hold = true;
    triggered_rules.push('GSE-INSP-01');
  } else if (desc.includes('roof') || desc.includes('hvac') || desc.includes('electrical') || desc.includes('plumbing') || desc.includes('fire')) {
    severity = 'high'; deficiency_type = desc.includes('roof') ? 'roofing' : desc.includes('hvac') ? 'mechanical' : desc.includes('electrical') ? 'electrical' : desc.includes('fire') ? 'life_safety' : 'plumbing';
    cure_days = 60; cost_estimate_usd = 22000;
    triggered_rules.push('GSE-INSP-02');
  } else if (desc.includes('deferred') || desc.includes('paint') || desc.includes('cosmetic') || desc.includes('flooring') || desc.includes('landscaping')) {
    severity = 'low'; deficiency_type = 'deferred_maintenance'; cure_days = 90; cost_estimate_usd = 3500;
  } else if (desc.includes('code') || desc.includes('permit') || desc.includes('violation')) {
    severity = 'high'; deficiency_type = 'code_violation'; cure_days = 45; cost_estimate_usd = 15000;
    triggered_rules.push('GSE-INSP-02');
  }

  const confidence = photo_available ? 0.92 : 0.76;

  return {
    severity, deficiency_type, cure_days, cost_estimate_usd, draw_hold, triggered_rules,
    confidence, location: location || 'unspecified',
    classification_note: !photo_available ? 'Photo verification recommended to confirm severity classification' : 'Classification confirmed by photographic evidence',
  };
}

// ── Tool 6: createBorrowerRequest ─────────────────────────────────────────────

const createBorrowerRequestDef = {
  type: 'function',
  function: {
    name: 'createBorrowerRequest',
    description: 'WRITE ACTION: Create a formal borrower request or notice (cure notice, deficiency letter, financial request, etc). This action is PENDING and will not execute until a human approves it. Returns an approval record.',
    parameters: {
      type: 'object',
      properties: {
        loan_id: { type: 'string' },
        request_type: { type: 'string', enum: ['cure_notice', 'deficiency_notice', 'financial_request', 'insurance_requirement', 'forbearance_offer', 'maturity_notice', 'watchlist_notice'] },
        subject: { type: 'string', description: 'Subject line of the notice' },
        body: { type: 'string', description: 'Body of the notice or request' },
        deadline_days: { type: 'number', description: 'Number of days borrower has to respond/comply' },
        references: { type: 'array', items: { type: 'string' }, description: 'Loan agreement sections or rule references' },
      },
      required: ['loan_id', 'request_type', 'subject', 'body'],
    },
  },
};

async function createBorrowerRequest({ loan_id, request_type, subject, body, deadline_days = 30, references = [] }, context) {
  // WRITE ACTION — record as pending approval, do not send
  const pending = {
    pending_approval: true,
    action_type: 'borrower_request',
    loan_id, request_type, subject, body, deadline_days, references,
    org_id: context.org_id,
    created_at: new Date().toISOString(),
    approval_required_from: 'servicer_admin',
    status: 'pending_approval',
    _note: 'This action is PENDING human approval. No notice has been sent to the borrower.',
  };

  try {
    await supabase.from('approvals').insert({
      org_id: context.org_id,
      entity_type: 'borrower_request',
      approval_type: 'other',
      step_name: `${request_type}: ${subject}`,
      description: body.slice(0, 500),
      required_role: 'servicer',
      requested_at: new Date().toISOString(),
      status: 'pending',
      data: pending,
    });
  } catch (_) {}

  return pending;
}

// ── Tool 7: approveDrawEligibility ────────────────────────────────────────────

const approveDrawEligibilityDef = {
  type: 'function',
  function: {
    name: 'approveDrawEligibility',
    description: 'Check draw request eligibility against inspection results, covenant status, and GSE draw policies. Returns eligibility determination with specific blocking conditions if any.',
    parameters: {
      type: 'object',
      properties: {
        loan_id: { type: 'string' },
        draw_amount_usd: { type: 'number', description: 'Requested draw amount in USD' },
        draw_number: { type: 'number', description: 'Draw sequence number' },
        inspection_status: { type: 'string', enum: ['passed', 'passed_with_conditions', 'failed', 'pending', 'not_required'], description: 'Current inspection status' },
        critical_deficiencies_open: { type: 'number', description: 'Number of open critical deficiencies', default: 0 },
        covenant_status: { type: 'string', enum: ['passing', 'failing', 'cure_period', 'waived'], default: 'passing' },
      },
      required: ['loan_id', 'draw_amount_usd', 'inspection_status'],
    },
  },
};

function approveDrawEligibility({ loan_id, draw_amount_usd, draw_number, inspection_status, critical_deficiencies_open = 0, covenant_status = 'passing' }) {
  const blocks = [];
  const conditions = [];

  if (critical_deficiencies_open > 0) {
    blocks.push({ rule: 'DRAW-HOLD-CRIT', reason: `${critical_deficiencies_open} critical deficiency/deficiencies must be cured before disbursement` });
  }
  if (inspection_status === 'failed') {
    blocks.push({ rule: 'GSE-INSP-01', reason: 'Inspection failed — draw held until re-inspection passes' });
  }
  if (inspection_status === 'pending') {
    blocks.push({ rule: 'GSE-INSP-01', reason: 'Inspection pending — draw held until inspection complete' });
  }
  if (covenant_status === 'failing') {
    conditions.push({ rule: 'COV-DSCR-01', condition: 'Covenant breach noted — draw may proceed only with lender_admin override' });
  }
  if (inspection_status === 'passed_with_conditions') {
    conditions.push({ rule: 'GSE-INSP-02', condition: 'Inspection passed with conditions — high-severity items must be addressed within 60 days' });
  }

  const eligible = blocks.length === 0;
  return {
    loan_id, draw_amount_usd, draw_number, eligible,
    blocking_conditions: blocks, conditions,
    determination: eligible
      ? (conditions.length ? 'eligible_with_conditions' : 'eligible')
      : 'held',
    required_approval: eligible ? (draw_amount_usd > 250000 ? ['servicer', 'lender_admin'] : ['servicer']) : [],
    recommendation: eligible
      ? `Draw #${draw_number} for $${draw_amount_usd.toLocaleString()} is eligible for disbursement${conditions.length ? ' with noted conditions' : ''}.`
      : `Draw #${draw_number} for $${draw_amount_usd.toLocaleString()} is HELD. Resolve ${blocks.length} blocking condition(s) before re-evaluation.`,
  };
}

// ── Tool 8: publishTokenizationSnapshot ──────────────────────────────────────

const publishTokenizationSnapshotDef = {
  type: 'function',
  function: {
    name: 'publishTokenizationSnapshot',
    description: 'WRITE ACTION: Publish an updated NAV/performance snapshot to token holders for a specific pool. Calculates current NAV per token based on financial metrics. PENDING until lender_admin approves.',
    parameters: {
      type: 'object',
      properties: {
        pool_id: { type: 'string', description: 'The pool or token series ID' },
        loan_id: { type: 'string', description: 'The loan whose metrics drive this NAV update' },
        nav_per_token: { type: 'number', description: 'Calculated NAV per token (e.g. 1.04 for $1.04)' },
        dscr: { type: 'number' },
        ltv: { type: 'number' },
        occupancy: { type: 'number' },
        notes: { type: 'string', description: 'Narrative note for token holders' },
      },
      required: ['pool_id', 'loan_id', 'nav_per_token'],
    },
  },
};

async function publishTokenizationSnapshot({ pool_id, loan_id, nav_per_token, dscr, ltv, occupancy, notes }, context) {
  const pending = {
    pending_approval: true,
    action_type: 'tokenization_snapshot',
    pool_id, loan_id, nav_per_token, dscr, ltv, occupancy, notes,
    org_id: context.org_id,
    created_at: new Date().toISOString(),
    approval_required_from: 'lender_admin',
    status: 'pending_approval',
    _note: 'NAV snapshot is PENDING lender_admin approval. No data has been published to token holders.',
  };

  try {
    await supabase.from('approvals').insert({
      org_id: context.org_id,
      entity_type: 'tokenization_snapshot',
      approval_type: 'other',
      step_name: `NAV Snapshot — ${pool_id} ($${nav_per_token}/token)`,
      description: `Pool: ${pool_id}. Loan: ${loan_id}. NAV: $${nav_per_token}. DSCR: ${dscr}x. LTV: ${ltv}%. Occupancy: ${occupancy}%.`,
      required_role: 'lender_admin',
      requested_at: new Date().toISOString(),
      status: 'pending',
      data: pending,
    });
  } catch (_) {}

  return pending;
}

// ── Tool registry export ──────────────────────────────────────────────────────

const TOOL_DEFINITIONS = [
  fetchLoanDef, fetchInspectionHistoryDef, validateFreddieRuleDef,
  generateWatchlistCommentDef, classifyInspectionItemDef,
  createBorrowerRequestDef, approveDrawEligibilityDef, publishTokenizationSnapshotDef,
];

const TOOL_EXECUTORS = {
  fetchLoan,
  fetchInspectionHistory,
  validateFreddieRule,
  generateWatchlistComment,
  classifyInspectionItem,
  createBorrowerRequest,
  approveDrawEligibility,
  publishTokenizationSnapshot,
};

async function executeTool(toolName, args, context) {
  const executor = TOOL_EXECUTORS[toolName];
  if (!executor) throw new Error(`Unknown tool: ${toolName}`);
  return executor(args, context);
}

module.exports = { TOOL_DEFINITIONS, TOOL_EXECUTORS, executeTool, FREDDIE_RULES };
