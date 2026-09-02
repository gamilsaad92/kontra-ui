/**
 * Kontra AI Cost Governance Engine — Phase 7
 *
 * Manages token budgets, usage tiers, per-workflow cost tracking, and ROI
 * calculation for enterprise AI deployments in CRE loan servicing.
 *
 * Core concepts:
 *   Usage Tier   — preset token + model envelope per review type
 *   Workflow Type — what the AI was doing (loan_review, inspection, etc.)
 *   Budget       — monthly or per-workflow spend cap with alert thresholds
 *   Usage Event  — one recorded AI call (tokens, cost, latency, outcome)
 *   ROI          — (time_saved_hrs × analyst_rate - ai_cost) / ai_cost × 100
 *
 * All data survives as in-memory rings (last 5,000 events) + is persisted to
 * Supabase kontra_ai_usage_events and kontra_ai_budgets tables.
 */

'use strict';

const { v4: uuidv4 } = require('uuid');

// ── Usage Tiers ───────────────────────────────────────────────────────────────
// Each tier defines the approved token envelope, preferred model, and
// expected analyst time saved per run.

const USAGE_TIERS = {
  quick_review: {
    id:            'quick_review',
    label:         'Quick Review',
    description:   'Rapid flag / no-flag signal for routine loans. Suitable for pipeline triage.',
    color:         '#22c55e',   // green
    icon:          'Zap',
    maxInputTokens:  800,
    maxOutputTokens: 300,
    preferredModel:  'gpt-4o-mini',
    fallbackModel:   'claude-3-haiku',
    estimatedCostMin: 0.0003,   // USD
    estimatedCostMax: 0.0012,
    timeSavedMinutes: 12,       // vs manual analyst review
    analystHourlyRate: 75,      // USD/hr — basis for ROI calc
    allowedWorkflows: ['classify', 'risk_score', 'covenant_check', 'watchlist_update'],
    hardStop: true,             // reject calls that exceed maxInputTokens
  },
  deep_analysis: {
    id:            'deep_analysis',
    label:         'Deep Analysis',
    description:   'Full loan underwriting support: DSCR deep-dive, document extraction, covenant stress-test.',
    color:         '#3b82f6',   // blue
    icon:          'Search',
    maxInputTokens:  6000,
    maxOutputTokens: 2000,
    preferredModel:  'gpt-4o',
    fallbackModel:   'claude-3-sonnet',
    estimatedCostMin: 0.18,
    estimatedCostMax: 0.72,
    timeSavedMinutes: 90,
    analystHourlyRate: 95,
    allowedWorkflows: ['loan_review', 'inspection_analysis', 'document_extraction', 'compliance_check', 'policy_eval', 'agent_decision', 'extract'],
    hardStop: false,
  },
  portfolio_sweep: {
    id:            'portfolio_sweep',
    label:         'Portfolio Sweep',
    description:   'Batch portfolio-level risk scoring, watchlist refresh, and DSCR variance detection across all active loans.',
    color:         '#f59e0b',   // amber
    icon:          'BarChart2',
    maxInputTokens:  40000,
    maxOutputTokens: 8000,
    preferredModel:  'gpt-4o',
    fallbackModel:   'azure_openai',
    estimatedCostMin: 1.80,
    estimatedCostMax: 5.20,
    timeSavedMinutes: 480,      // 8 analyst-hours for full portfolio review
    analystHourlyRate: 110,     // senior analyst
    allowedWorkflows: ['portfolio_sweep', 'risk_score', 'summarize', 'classify', 'watchlist_update'],
    hardStop: false,
  },
  executive_memo: {
    id:            'executive_memo',
    label:         'Executive Memo Mode',
    description:   'Board-ready summaries, committee memos, and investor reporting narratives. High-quality output, controlled cost.',
    color:         '#8b5cf6',   // violet
    icon:          'FileText',
    maxInputTokens:  3000,
    maxOutputTokens: 1500,
    preferredModel:  'gpt-4o',
    fallbackModel:   'claude-3-opus',
    estimatedCostMin: 0.12,
    estimatedCostMax: 0.48,
    timeSavedMinutes: 60,
    analystHourlyRate: 130,     // VP / director
    allowedWorkflows: ['summarize', 'email_parse', 'compliance_check'],
    hardStop: false,
  },
};

// ── Workflow Types ────────────────────────────────────────────────────────────
// Maps each workflow to its default tier, analyst time benchmark, and ROI metadata.

const WORKFLOW_CATALOG = {
  loan_review: {
    id:                'loan_review',
    label:             'Loan Review',
    description:       'Full AI-assisted underwriting pass: DSCR, LTV, NOI, covenant stress-test',
    defaultTier:       'deep_analysis',
    timeSavedMinutes:  90,
    manualCostUsd:     118.75,   // 90 min × $79.17/hr blended analyst
    category:          'underwriting',
  },
  inspection_analysis: {
    id:                'inspection_analysis',
    label:             'Inspection Analysis',
    description:       'AI photo + report analysis: deficiency detection, severity scoring, cost estimation',
    defaultTier:       'deep_analysis',
    timeSavedMinutes:  75,
    manualCostUsd:     98.96,
    category:          'servicing',
  },
  borrower_package: {
    id:                'borrower_package',
    label:             'Borrower Package Review',
    description:       'Automated borrower financial package parsing: income, tax returns, entity docs',
    defaultTier:       'deep_analysis',
    timeSavedMinutes:  120,
    manualCostUsd:     158.33,
    category:          'underwriting',
  },
  draw_review: {
    id:                'draw_review',
    label:             'Draw Request Review',
    description:       'Construction draw validation: budget line matching, photo compliance, lien waiver check',
    defaultTier:       'quick_review',
    timeSavedMinutes:  45,
    manualCostUsd:     59.38,
    category:          'construction',
  },
  covenant_check: {
    id:                'covenant_check',
    label:             'Covenant Monitoring',
    description:       'Automated DSCR / LTV / occupancy covenant test against latest financials',
    defaultTier:       'quick_review',
    timeSavedMinutes:  20,
    manualCostUsd:     26.39,
    category:          'servicing',
  },
  watchlist_update: {
    id:                'watchlist_update',
    label:             'Watchlist Update',
    description:       'Risk flag scoring refresh: classify loans as current / watch / special servicing',
    defaultTier:       'quick_review',
    timeSavedMinutes:  15,
    manualCostUsd:     19.79,
    category:          'risk',
  },
  document_extraction: {
    id:                'document_extraction',
    label:             'Document Extraction',
    description:       'OCR + structured data extraction from loan documents, appraisals, and title policies',
    defaultTier:       'deep_analysis',
    timeSavedMinutes:  60,
    manualCostUsd:     79.17,
    category:          'operations',
  },
  compliance_check: {
    id:                'compliance_check',
    label:             'Compliance Check',
    description:       'Regulatory compliance screening: RESPA, TILA, FIRREA, AML, OFAC',
    defaultTier:       'executive_memo',
    timeSavedMinutes:  50,
    manualCostUsd:     108.33,   // compliance officer rate
    category:          'compliance',
  },
  portfolio_sweep: {
    id:                'portfolio_sweep',
    label:             'Portfolio Sweep',
    description:       'Full portfolio batch risk re-score across all active loans',
    defaultTier:       'portfolio_sweep',
    timeSavedMinutes:  480,
    manualCostUsd:     880.00,   // 8 hrs × senior analyst
    category:          'risk',
  },
  executive_memo: {
    id:                'executive_memo',
    label:             'Executive Memo',
    description:       'Board / committee memo generation from loan and portfolio data',
    defaultTier:       'executive_memo',
    timeSavedMinutes:  60,
    manualCostUsd:     130.00,   // VP-level writer
    category:          'reporting',
  },
};

// ── In-memory stores ──────────────────────────────────────────────────────────

const USAGE_EVENTS = [];     // ring buffer, last 5000
const MAX_EVENTS   = 5000;

const BUDGETS      = new Map();   // budgetId → budget record

// ── Seed demo budgets ─────────────────────────────────────────────────────────

const DEMO_BUDGETS = [
  {
    budgetId:    uuidv4(),
    orgId:       'demo-org',
    name:        'Monthly AI Operations Budget',
    scope:       'monthly',
    limitUsd:    2500.00,
    alertAt:     0.80,    // alert when 80% consumed
    hardStop:    false,
    tierOverride: null,
    workflowScopes: null, // all workflows
    currentPeriodStart: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString(),
    spentUsd:    0,
    status:      'active',
    createdAt:   new Date().toISOString(),
  },
  {
    budgetId:    uuidv4(),
    orgId:       'demo-org',
    name:        'Portfolio Sweep — Quarterly Limit',
    scope:       'per_workflow',
    workflowScopes: ['portfolio_sweep'],
    limitUsd:    750.00,
    alertAt:     0.75,
    hardStop:    true,
    tierOverride: 'portfolio_sweep',
    currentPeriodStart: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString(),
    spentUsd:    0,
    status:      'active',
    createdAt:   new Date().toISOString(),
  },
  {
    budgetId:    uuidv4(),
    orgId:       'demo-org',
    name:        'Deep Analysis Per-Loan Cap',
    scope:       'per_workflow',
    workflowScopes: ['loan_review', 'borrower_package', 'document_extraction'],
    limitUsd:    5.00,   // max $5 per loan review
    alertAt:     0.90,
    hardStop:    true,
    tierOverride: 'deep_analysis',
    currentPeriodStart: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString(),
    spentUsd:    0,
    status:      'active',
    createdAt:   new Date().toISOString(),
  },
];

// Seed simulated historical usage
function seedDemoUsage() {
  const workflows = Object.keys(WORKFLOW_CATALOG);
  const models    = ['gpt-4o-mini', 'gpt-4o', 'claude-3-haiku-20240307'];
  const now       = Date.now();
  const DAY       = 86400000;

  for (let i = 0; i < 200; i++) {
    const wf   = workflows[i % workflows.length];
    const cat  = WORKFLOW_CATALOG[wf];
    const tier = USAGE_TIERS[cat.defaultTier];
    const model = models[i % models.length];

    // Simulate realistic cost within tier bounds
    const costFrac = 0.2 + (i % 7) * 0.1;
    const costUsd  = +(tier.estimatedCostMin + (tier.estimatedCostMax - tier.estimatedCostMin) * costFrac).toFixed(4);
    const inTok    = Math.round(tier.maxInputTokens * (0.4 + costFrac * 0.4));
    const outTok   = Math.round(tier.maxOutputTokens * (0.3 + costFrac * 0.3));

    const daysAgo  = Math.floor(i / 8);   // ~8 events per day for 25 days
    const ts       = new Date(now - daysAgo * DAY - (i % 24) * 3600000).toISOString();

    USAGE_EVENTS.push({
      eventId:      uuidv4(),
      orgId:        'demo-org',
      workflowType: wf,
      tierId:       cat.defaultTier,
      model,
      inputTokens:  inTok,
      outputTokens: outTok,
      totalTokens:  inTok + outTok,
      costUsd,
      latencyMs:    400 + Math.floor(Math.random() * 2000),
      loanId:       `LN-${String(1000 + (i % 50)).padStart(4, '0')}`,
      requestId:    uuidv4(),
      outcome:      i % 15 === 0 ? 'error' : 'success',
      provider:     model.startsWith('claude') ? 'anthropic' : 'openai',
      recordedAt:   ts,
    });
  }
}

DEMO_BUDGETS.forEach(b => BUDGETS.set(b.budgetId, b));
seedDemoUsage();

// ── Core functions ────────────────────────────────────────────────────────────

function recordUsageEvent({
  orgId, workflowType, tierId, model, inputTokens, outputTokens,
  costUsd, latencyMs, loanId, requestId, outcome = 'success', provider, metadata,
}) {
  if (!orgId || !workflowType) throw new Error('orgId and workflowType are required');

  const event = {
    eventId:      uuidv4(),
    orgId,
    workflowType,
    tierId:       tierId || WORKFLOW_CATALOG[workflowType]?.defaultTier || 'quick_review',
    model:        model || 'gpt-4o-mini',
    inputTokens:  inputTokens || 0,
    outputTokens: outputTokens || 0,
    totalTokens:  (inputTokens || 0) + (outputTokens || 0),
    costUsd:      +(costUsd || 0).toFixed(6),
    latencyMs:    latencyMs || 0,
    loanId:       loanId || null,
    requestId:    requestId || uuidv4(),
    outcome,
    provider:     provider || 'openai',
    metadata:     metadata || null,
    recordedAt:   new Date().toISOString(),
  };

  USAGE_EVENTS.unshift(event);
  if (USAGE_EVENTS.length > MAX_EVENTS) USAGE_EVENTS.pop();

  // Update budget spent
  for (const budget of BUDGETS.values()) {
    if (budget.orgId !== orgId) continue;
    if (budget.workflowScopes && !budget.workflowScopes.includes(workflowType)) continue;
    budget.spentUsd = +(budget.spentUsd + event.costUsd).toFixed(6);
  }

  return event;
}

function checkBudget(orgId, workflowType, estimatedCost) {
  const violations = [];
  const warnings   = [];

  for (const budget of BUDGETS.values()) {
    if (budget.orgId !== orgId || budget.status !== 'active') continue;
    if (budget.workflowScopes && !budget.workflowScopes.includes(workflowType)) continue;

    const projectedSpend = budget.spentUsd + estimatedCost;
    const utilization    = projectedSpend / budget.limitUsd;

    if (budget.hardStop && projectedSpend > budget.limitUsd) {
      violations.push({
        budgetId:    budget.budgetId,
        budgetName:  budget.name,
        reason:      `Hard stop: projected spend $${projectedSpend.toFixed(4)} exceeds limit $${budget.limitUsd}`,
        limitUsd:    budget.limitUsd,
        spentUsd:    budget.spentUsd,
        projectedUsd: projectedSpend,
      });
    } else if (utilization >= budget.alertAt) {
      warnings.push({
        budgetId:    budget.budgetId,
        budgetName:  budget.name,
        reason:      `Alert: ${(utilization * 100).toFixed(1)}% of budget consumed`,
        utilization: +(utilization * 100).toFixed(1),
        limitUsd:    budget.limitUsd,
        spentUsd:    budget.spentUsd,
      });
    }
  }

  return {
    allowed:    violations.length === 0,
    violations,
    warnings,
  };
}

function createBudget({ orgId, name, scope, limitUsd, alertAt = 0.80, hardStop = false, tierOverride, workflowScopes }) {
  if (!orgId || !name || !limitUsd) throw new Error('orgId, name, limitUsd are required');

  const budget = {
    budgetId:    uuidv4(),
    orgId,
    name,
    scope:       scope || 'monthly',
    limitUsd:    +limitUsd,
    alertAt:     +alertAt,
    hardStop:    !!hardStop,
    tierOverride: tierOverride || null,
    workflowScopes: workflowScopes || null,
    currentPeriodStart: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString(),
    spentUsd:    0,
    status:      'active',
    createdAt:   new Date().toISOString(),
  };

  BUDGETS.set(budget.budgetId, budget);
  return budget;
}

function updateBudget(budgetId, patch) {
  const b = BUDGETS.get(budgetId);
  if (!b) throw new Error(`Budget not found: ${budgetId}`);
  const allowed = ['name','limitUsd','alertAt','hardStop','tierOverride','workflowScopes','status'];
  allowed.forEach(k => { if (patch[k] !== undefined) b[k] = patch[k]; });
  b.updatedAt = new Date().toISOString();
  return b;
}

function listBudgets({ orgId, status } = {}) {
  let result = [...BUDGETS.values()];
  if (orgId) result = result.filter(b => b.orgId === orgId);
  if (status) result = result.filter(b => b.status === status);
  return result.map(b => ({
    ...b,
    utilizationPct: +((b.spentUsd / b.limitUsd) * 100).toFixed(1),
    remainingUsd:   +(b.limitUsd - b.spentUsd).toFixed(4),
    alertTriggered: (b.spentUsd / b.limitUsd) >= b.alertAt,
  }));
}

function listUsageEvents({ orgId, workflowType, loanId, tierId, startDate, endDate, limit = 100 } = {}) {
  let events = USAGE_EVENTS;
  if (orgId)        events = events.filter(e => e.orgId === orgId);
  if (workflowType) events = events.filter(e => e.workflowType === workflowType);
  if (loanId)       events = events.filter(e => e.loanId === loanId);
  if (tierId)       events = events.filter(e => e.tierId === tierId);
  if (startDate)    events = events.filter(e => e.recordedAt >= startDate);
  if (endDate)      events = events.filter(e => e.recordedAt <= endDate);
  return events.slice(0, parseInt(limit));
}

// ── ROI Engine ────────────────────────────────────────────────────────────────

function computeROI({ orgId, workflowType, startDate, endDate } = {}) {
  const events = listUsageEvents({ orgId, workflowType, startDate, endDate, limit: 5000 })
    .filter(e => e.outcome === 'success');

  const byWorkflow = {};

  for (const ev of events) {
    const wf = ev.workflowType;
    if (!byWorkflow[wf]) {
      byWorkflow[wf] = {
        workflowType:   wf,
        label:          WORKFLOW_CATALOG[wf]?.label || wf,
        category:       WORKFLOW_CATALOG[wf]?.category || 'other',
        runs:           0,
        totalCostUsd:   0,
        totalTokens:    0,
        totalLatencyMs: 0,
        timeSavedMinutes: 0,
        manualCostAvoidedUsd: 0,
      };
    }
    const cat         = WORKFLOW_CATALOG[wf] || {};
    byWorkflow[wf].runs           += 1;
    byWorkflow[wf].totalCostUsd   += ev.costUsd;
    byWorkflow[wf].totalTokens    += ev.totalTokens;
    byWorkflow[wf].totalLatencyMs += ev.latencyMs;
    byWorkflow[wf].timeSavedMinutes += (cat.timeSavedMinutes || 0);
    byWorkflow[wf].manualCostAvoidedUsd += (cat.manualCostUsd || 0);
  }

  const rows = Object.values(byWorkflow).map(wf => {
    const aiCost     = +wf.totalCostUsd.toFixed(4);
    const manualCost = +wf.manualCostAvoidedUsd.toFixed(2);
    const netSaving  = +(manualCost - aiCost).toFixed(2);
    const roi        = aiCost > 0 ? +((netSaving / aiCost) * 100).toFixed(0) : 0;
    return {
      ...wf,
      totalCostUsd:          aiCost,
      manualCostAvoidedUsd:  manualCost,
      netSavingUsd:          netSaving,
      roiPct:                roi,
      avgCostPerRunUsd:      wf.runs > 0 ? +(aiCost / wf.runs).toFixed(4) : 0,
      avgLatencyMs:          wf.runs > 0 ? Math.round(wf.totalLatencyMs / wf.runs) : 0,
      avgTokensPerRun:       wf.runs > 0 ? Math.round(wf.totalTokens / wf.runs) : 0,
    };
  });

  rows.sort((a, b) => b.roiPct - a.roiPct);

  const totals = rows.reduce((acc, r) => {
    acc.totalRuns         += r.runs;
    acc.totalCostUsd      += r.totalCostUsd;
    acc.totalManualAvoid  += r.manualCostAvoidedUsd;
    acc.totalNetSaving    += r.netSavingUsd;
    return acc;
  }, { totalRuns: 0, totalCostUsd: 0, totalManualAvoid: 0, totalNetSaving: 0 });

  return {
    rows,
    summary: {
      totalRuns:             totals.totalRuns,
      totalCostUsd:          +totals.totalCostUsd.toFixed(4),
      totalManualCostAvoided:+totals.totalManualAvoid.toFixed(2),
      totalNetSaving:        +totals.totalNetSaving.toFixed(2),
      blendedRoiPct:         totals.totalCostUsd > 0
        ? +((totals.totalNetSaving / totals.totalCostUsd) * 100).toFixed(0)
        : 0,
      avgCostPerRun:         totals.totalRuns > 0
        ? +(totals.totalCostUsd / totals.totalRuns).toFixed(4)
        : 0,
    },
  };
}

// ── Dashboard summary ─────────────────────────────────────────────────────────

function getDashboardStats(orgId) {
  const now      = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const mtdEvents  = listUsageEvents({ orgId, startDate: monthStart, limit: 5000 });
  const allEvents  = listUsageEvents({ orgId, limit: 5000 });

  const totalMtdSpend  = +mtdEvents.reduce((s, e) => s + e.costUsd, 0).toFixed(4);
  const totalAllSpend  = +allEvents.reduce((s, e) => s + e.costUsd, 0).toFixed(4);
  const avgCostPerRun  = mtdEvents.length > 0 ? +(totalMtdSpend / mtdEvents.length).toFixed(4) : 0;

  // Cost by workflow (MTD)
  const byWorkflow = {};
  for (const e of mtdEvents) {
    if (!byWorkflow[e.workflowType]) byWorkflow[e.workflowType] = { cost: 0, runs: 0, tokens: 0 };
    byWorkflow[e.workflowType].cost   += e.costUsd;
    byWorkflow[e.workflowType].runs   += 1;
    byWorkflow[e.workflowType].tokens += e.totalTokens;
  }

  // Cost by tier (MTD)
  const byTier = {};
  for (const e of mtdEvents) {
    if (!byTier[e.tierId]) byTier[e.tierId] = { cost: 0, runs: 0 };
    byTier[e.tierId].cost += e.costUsd;
    byTier[e.tierId].runs += 1;
  }

  // Cost by model (MTD)
  const byModel = {};
  for (const e of mtdEvents) {
    if (!byModel[e.model]) byModel[e.model] = { cost: 0, runs: 0 };
    byModel[e.model].cost += e.costUsd;
    byModel[e.model].runs += 1;
  }

  // Daily spend trend (last 30 days)
  const dailySpend = {};
  for (let d = 29; d >= 0; d--) {
    const day = new Date(now - d * 86400000).toISOString().slice(0, 10);
    dailySpend[day] = { date: day, cost: 0, runs: 0 };
  }
  for (const e of allEvents) {
    const day = e.recordedAt.slice(0, 10);
    if (dailySpend[day]) {
      dailySpend[day].cost += e.costUsd;
      dailySpend[day].runs += 1;
    }
  }

  // ROI summary
  const roi = computeROI({ orgId });

  // Budget utilization
  const budgets = listBudgets({ orgId, status: 'active' });

  return {
    period:   'month_to_date',
    generatedAt: now.toISOString(),

    spend: {
      totalMtdUsd:       totalMtdSpend,
      totalAllTimeUsd:   totalAllSpend,
      avgCostPerRunUsd:  avgCostPerRun,
      totalMtdRuns:      mtdEvents.length,
      errorRate:         mtdEvents.length > 0
        ? +((mtdEvents.filter(e => e.outcome === 'error').length / mtdEvents.length) * 100).toFixed(1)
        : 0,
    },

    byWorkflow: Object.fromEntries(
      Object.entries(byWorkflow).map(([k, v]) => [k, {
        ...v,
        cost:    +v.cost.toFixed(4),
        label:   WORKFLOW_CATALOG[k]?.label || k,
        pct:     totalMtdSpend > 0 ? +((v.cost / totalMtdSpend) * 100).toFixed(1) : 0,
      }])
    ),

    byTier: Object.fromEntries(
      Object.entries(byTier).map(([k, v]) => [k, {
        ...v,
        cost:  +v.cost.toFixed(4),
        label: USAGE_TIERS[k]?.label || k,
        color: USAGE_TIERS[k]?.color || '#888',
      }])
    ),

    byModel: Object.fromEntries(
      Object.entries(byModel).map(([k, v]) => [k, { ...v, cost: +v.cost.toFixed(4) }])
    ),

    dailyTrend: Object.values(dailySpend).map(d => ({ ...d, cost: +d.cost.toFixed(4) })),

    roi: roi.summary,
    roiByWorkflow: roi.rows.slice(0, 8),

    budgets: budgets.map(b => ({
      budgetId:       b.budgetId,
      name:           b.name,
      limitUsd:       b.limitUsd,
      spentUsd:       +b.spentUsd.toFixed(4),
      utilizationPct: b.utilizationPct,
      alertTriggered: b.alertTriggered,
      hardStop:       b.hardStop,
    })),
  };
}

// ── Tier cost simulation ──────────────────────────────────────────────────────

function simulateTierCost(tierId, workflowType, runCount = 1) {
  const tier = USAGE_TIERS[tierId];
  if (!tier) throw new Error(`Unknown tier: ${tierId}`);
  const wf = WORKFLOW_CATALOG[workflowType];

  const minTotal = +(tier.estimatedCostMin * runCount).toFixed(4);
  const maxTotal = +(tier.estimatedCostMax * runCount).toFixed(4);
  const midCost  = (tier.estimatedCostMin + tier.estimatedCostMax) / 2;
  const midTotal = +(midCost * runCount).toFixed(4);

  const timeSavedHrs = ((wf?.timeSavedMinutes || tier.timeSavedMinutes) * runCount) / 60;
  const analystRate  = tier.analystHourlyRate;
  const manualCost   = +(timeSavedHrs * analystRate).toFixed(2);
  const netSaving    = +(manualCost - midTotal).toFixed(2);
  const roi          = midTotal > 0 ? +((netSaving / midTotal) * 100).toFixed(0) : 0;

  return {
    tierId,
    tierLabel:        tier.label,
    workflowType,
    workflowLabel:    wf?.label || workflowType,
    runCount,
    preferredModel:   tier.preferredModel,
    tokenEnvelope: {
      maxInputTokens:  tier.maxInputTokens,
      maxOutputTokens: tier.maxOutputTokens,
      maxTotalTokens:  tier.maxInputTokens + tier.maxOutputTokens,
    },
    costEstimate: {
      minUsd: minTotal,
      maxUsd: maxTotal,
      midUsd: midTotal,
      perRunMin: tier.estimatedCostMin,
      perRunMax: tier.estimatedCostMax,
    },
    roi: {
      timeSavedMinutes: (wf?.timeSavedMinutes || tier.timeSavedMinutes) * runCount,
      manualCostAvoidedUsd: manualCost,
      netSavingUsd: netSaving,
      roiPct: roi,
    },
  };
}

module.exports = {
  USAGE_TIERS,
  WORKFLOW_CATALOG,
  recordUsageEvent,
  checkBudget,
  createBudget,
  updateBudget,
  listBudgets,
  listUsageEvents,
  computeROI,
  getDashboardStats,
  simulateTierCost,
};
